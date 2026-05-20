import sys
import os
import librosa
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count
from django.utils import timezone
from django.conf import settings

from .models import MicrophoneNode, AudioDetection, PestLocation
from .serializers import (
    MicrophoneNodeSerializer,
    AudioDetectionSerializer,
    AudioDetectionListSerializer,
    PestLocationSerializer,
    HeatmapPointSerializer
)

from acoustic.pest_classifier import SimplePestDetector
from acoustic.adaptive_threshold import AdaptivePestDetector
from localization.tdoa import MicrophoneNetwork


adaptive_detector = AdaptivePestDetector()
is_calibrated = False
calibration_count = 0
CALIBRATION_THRESHOLD = 10  # 需要多少样本完成校准


def calibrate_with_signal(signal):
    """使用信号进行校准"""
    global is_calibrated, calibration_count
    adaptive_detector.calibrate(signal)
    calibration_count += 1
    if calibration_count >= CALIBRATION_THRESHOLD:
        is_calibrated = True
        print(f"Adaptive detector calibrated with {calibration_count} samples")


class MicrophoneNodeViewSet(viewsets.ModelViewSet):
    queryset = MicrophoneNode.objects.all()
    serializer_class = MicrophoneNodeSerializer
    
    @action(detail=False, methods=['POST'])
    def register(self, request):
        node_id = request.data.get('node_id')
        lat = request.data.get('lat')
        lng = request.data.get('lng')
        height = request.data.get('height', 0.0)
        
        if not node_id or lat is None or lng is None:
            return Response(
                {'error': 'node_id, lat, lng are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        node, created = MicrophoneNode.objects.update_or_create(
            node_id=node_id,
            defaults={'lat': lat, 'lng': lng, 'height': height, 'is_active': True}
        )
        
        serializer = self.get_serializer(node)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AudioDetectionViewSet(viewsets.ModelViewSet):
    queryset = AudioDetection.objects.select_related('node').all()
    serializer_class = AudioDetectionListSerializer
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AudioDetectionSerializer
        return AudioDetectionListSerializer
    
    def create(self, request, *args, **kwargs):
        node_id = request.data.get('node_id')
        try:
            node = MicrophoneNode.objects.get(node_id=node_id)
        except MicrophoneNode.DoesNotExist:
            return Response(
                {'error': f'Node {node_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        mutable_data = request.data.copy()
        mutable_data['node'] = node.id
        
        serializer = AudioDetectionSerializer(data=mutable_data)
        serializer.is_valid(raise_exception=True)
        detection = serializer.save(node=node)
        
        try:
            audio_path = detection.audio_file.path
            
            y, sr = librosa.load(audio_path, sr=22050)
            
            if not is_calibrated:
                calibrate_with_signal(y)
            
            sensitivity = float(request.data.get('sensitivity', 0.5))
            use_adaptive = request.data.get('use_adaptive', 'true').lower() == 'true'
            
            if use_adaptive and is_calibrated:
                adaptive_result = adaptive_detector.detect_with_adaptive_threshold(
                    y, sensitivity=sensitivity
                )
                detection.detected_pest = adaptive_result['pest_type']
                detection.confidence = adaptive_result['confidence']
                detection.detection_details = {
                    'adaptive': True,
                    'calibrated': True,
                    'result': adaptive_result,
                    'noise_profile': adaptive_detector.get_current_noise_profile()
                }
            else:
                result = SimplePestDetector.detect_from_array(y, sr)
                detection.detected_pest = result['pest_type']
                detection.confidence = result['confidence']
                detection.detection_details = {
                    'adaptive': False,
                    'calibrated': is_calibrated,
                    'result': result
                }
            
            detection.save()
        except Exception as e:
            print(f"Error processing audio: {e}")
        
        self._trigger_localization_if_ready(detection.event_id)
        
        return Response(
            AudioDetectionListSerializer(detection, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )
    
    def _trigger_localization_if_ready(self, event_id):
        detections = AudioDetection.objects.filter(event_id=event_id)
        if detections.count() >= 3:
            if not PestLocation.objects.filter(event_id=event_id).exists():
                self._perform_localization(event_id, detections)
    
    def _perform_localization(self, event_id, detections):
        try:
            network = MicrophoneNetwork()
            
            active_nodes = MicrophoneNode.objects.filter(
                node_id__in=[d.node.node_id for d in detections]
            )
            for node in active_nodes:
                network.add_node(node.node_id, node.lat, node.lng, node.height)
            
            use_multisource = self._should_use_multisource(detections)
            
            if use_multisource:
                print(f"Using multi-source localization for event {event_id}")
                detection_dict = self._prepare_multisource_data(detections)
                locations = network.localize_multisource_event(detection_dict)
                
                sample_det = detections.first()
                true_lat = sample_det.detection_details.get('true_lat') if hasattr(sample_det, 'detection_details') else None
                true_lng = sample_det.detection_details.get('true_lng') if hasattr(sample_det, 'detection_details') else None
                
                for idx, loc in enumerate(locations):
                    if loc.get('separation_confidence', 1.0) > 0.3:
                        PestLocation.objects.create(
                            event_id=f"{event_id}_source_{idx}",
                            lat=loc['lat'],
                            lng=loc['lng'],
                            error=loc.get('error', 0),
                            localization_details=loc,
                            true_lat=true_lat,
                            true_lng=true_lng,
                        )
            else:
                detection_dict = {}
                for d in detections:
                    detection_dict[d.node.node_id] = {
                        'timestamp': d.timestamp
                    }
                
                result = network.localize_event(detection_dict)
                
                if result:
                    sample_det = detections.first()
                    
                    PestLocation.objects.create(
                        event_id=event_id,
                        lat=result['lat'],
                        lng=result['lng'],
                        error=result.get('error', 0),
                        localization_details=result,
                        true_lat=sample_det.detection_details.get('true_lat') if hasattr(sample_det, 'detection_details') else None,
                        true_lng=sample_det.detection_details.get('true_lng') if hasattr(sample_det, 'detection_details') else None,
                    )
        except Exception as e:
            print(f"Localization error: {e}")
    
    def _should_use_multisource(self, detections):
        """判断是否应该使用多声源定位"""
        if detections.count() < 3:
            return False
        
        try:
            timestamps = [d.timestamp for d in detections]
            timestamp_range = max(timestamps) - min(timestamps)
            
            if timestamp_range > 0.005:
                return True
            
            confidences = [d.confidence for d in detections]
            confidence_var = np.var(confidences)
            
            if confidence_var > 0.1:
                return True
            
            return False
        except Exception as e:
            print(f"Error in multisource decision: {e}")
            return False
    
    def _prepare_multisource_data(self, detections):
        """为多声源定位准备数据"""
        import librosa
        import soundfile as sf
        
        detection_dict = {}
        
        for d in detections:
            try:
                if d.audio_file and d.audio_file.path:
                    signal, sr = librosa.load(d.audio_file.path, sr=22050)
                else:
                    signal = np.zeros(22050)
            except Exception as e:
                print(f"Error loading audio: {e}")
                signal = np.zeros(22050)
            
            detection_dict[d.node.node_id] = {
                'signal': signal,
                'timestamp': d.timestamp
            }
        
        return detection_dict


class PestLocationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PestLocation.objects.all()
    serializer_class = PestLocationSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        pest_type = self.request.query_params.get('pest_type')
        if pest_type:
            queryset = queryset.filter(
                event_id__in=AudioDetection.objects.filter(
                    detected_pest=pest_type
                ).values('event_id')
            )
        return queryset


class HeatmapDataView(APIView):
    def get(self, request):
        locations = PestLocation.objects.all()
        
        points = []
        for loc in locations:
            detections = AudioDetection.objects.filter(event_id=loc.event_id)
            pest_type = detections.first().detected_pest if detections.exists() else 'unknown'
            avg_confidence = detections.values_list('confidence', flat=True).order_by('-confidence').first() or 0
            
            points.append({
                'lat': loc.lat,
                'lng': loc.lng,
                'count': 1,
                'pest_type': pest_type,
                'confidence': avg_confidence
            })
        
        serializer = HeatmapPointSerializer(points, many=True)
        return Response(serializer.data)


class StatsView(APIView):
    def get(self, request):
        total_detections = AudioDetection.objects.count()
        total_locations = PestLocation.objects.count()
        active_nodes = MicrophoneNode.objects.filter(is_active=True).count()
        
        pest_stats = AudioDetection.objects.exclude(
            detected_pest__in=['none', 'unknown']
        ).values('detected_pest').annotate(
            count=Count('detected_pest')
        ).order_by('-count')
        
        recent_locations = PestLocation.objects.order_by('-localized_at')[:10]
        
        return Response({
            'total_detections': total_detections,
            'total_locations': total_locations,
            'active_nodes': active_nodes,
            'pest_stats': list(pest_stats),
            'recent_locations': PestLocationSerializer(recent_locations, many=True, 
                                                       context={'request': request}).data
        })


class NoiseStatusView(APIView):
    """噪声状态API - 获取当前噪声剖面和校准状态"""
    
    def get(self, request):
        noise_profile = adaptive_detector.get_current_noise_profile()
        
        return Response({
            'is_calibrated': is_calibrated,
            'calibration_count': calibration_count,
            'calibration_threshold': CALIBRATION_THRESHOLD,
            'noise_profile': noise_profile,
            'current_thresholds': adaptive_detector.noise_analyzer.get_adaptive_threshold() if is_calibrated else None
        })
    
    def post(self, request):
        """重置校准状态"""
        global is_calibrated, calibration_count, adaptive_detector
        
        adaptive_detector = AdaptivePestDetector()
        is_calibrated = False
        calibration_count = 0
        
        return Response({
            'status': 'reset',
            'message': 'Adaptive detector calibration has been reset'
        })


class NoiseFilterTestView(APIView):
    """噪声过滤测试API - 完全内存处理，无临时文件"""
    
    def post(self, request):
        """测试音频信号的噪声类型"""
        try:
            if 'audio_file' not in request.FILES:
                return Response(
                    {'error': 'No audio file provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            audio_file = request.FILES['audio_file']
            
            from .file_utils import InMemoryAudioLoader
            y, sr = InMemoryAudioLoader.load_from_uploadedfile(audio_file, sr=22050)
            
            from acoustic.adaptive_threshold import NoiseTypeClassifier
            classifier = NoiseTypeClassifier(sr=sr)
            noise_result = classifier.classify_noise(y)
            
            signal_features = adaptive_detector.noise_analyzer._extract_features(y)
            
            return Response({
                'noise_classification': noise_result,
                'signal_features': signal_features,
                'is_interference': noise_result['is_interference'],
                'recommendation': 'FILTER' if noise_result['is_interference'] else 'PROCESS',
                'processing_info': {
                    'method': 'in_memory',
                    'audio_length': float(len(y) / sr),
                    'sample_rate': sr
                }
            })
            
        except Exception as e:
            import traceback
            return Response(
                {
                    'error': str(e),
                    'traceback': traceback.format_exc() if settings.DEBUG else None
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
