from rest_framework import serializers
from .models import MicrophoneNode, AudioDetection, PestLocation


class MicrophoneNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MicrophoneNode
        fields = ['id', 'node_id', 'lat', 'lng', 'height', 'registered_at', 'is_active']
        read_only_fields = ['id', 'registered_at']


class AudioDetectionSerializer(serializers.ModelSerializer):
    node_id = serializers.CharField(write_only=True)
    
    class Meta:
        model = AudioDetection
        fields = ['id', 'node_id', 'event_id', 'audio_file', 'timestamp', 
                  'detected_pest', 'confidence', 'detection_details', 'uploaded_at']
        read_only_fields = ['id', 'detected_pest', 'confidence', 
                           'detection_details', 'uploaded_at']


class AudioDetectionListSerializer(serializers.ModelSerializer):
    node = MicrophoneNodeSerializer(read_only=True)
    audio_url = serializers.SerializerMethodField()
    
    class Meta:
        model = AudioDetection
        fields = ['id', 'node', 'event_id', 'audio_url', 'timestamp',
                  'detected_pest', 'confidence', 'uploaded_at']
    
    def get_audio_url(self, obj):
        request = self.context.get('request')
        if obj.audio_file:
            return request.build_absolute_uri(obj.audio_file.url)
        return None


class PestLocationSerializer(serializers.ModelSerializer):
    detections = serializers.SerializerMethodField()
    
    class Meta:
        model = PestLocation
        fields = ['id', 'event_id', 'lat', 'lng', 'error', 'localized_at',
                  'localization_details', 'true_lat', 'true_lng', 'detections']
    
    def get_detections(self, obj):
        detections = AudioDetection.objects.filter(event_id=obj.event_id)
        return AudioDetectionListSerializer(detections, many=True, 
                                           context=self.context).data


class HeatmapPointSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    count = serializers.IntegerField()
    pest_type = serializers.CharField()
    confidence = serializers.FloatField()
