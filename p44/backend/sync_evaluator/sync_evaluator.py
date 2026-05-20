import numpy as np
from scipy.signal import correlate
from scipy.interpolate import interp1d
from typing import Dict, List, Tuple
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from audio_vad.audio_processor import AudioProcessor
from lip_detector.lip_detector import LipDetector
from speaker_tracker.speaker_tracker import MultiSpeakerSyncEvaluator
from utils.memory_manager import memory_manager


class SyncEvaluator:
    def __init__(self):
        self.audio_processor = AudioProcessor()
        self.lip_detector = LipDetector()
        self.multi_speaker_evaluator = MultiSpeakerSyncEvaluator()

    def evaluate_sync(self, video_path: str, audio_path: str) -> Dict:
        video_info = self.lip_detector.process_video(video_path)
        y, sr = self.audio_processor.load_audio(audio_path)

        fps = video_info['fps']
        audio_envelope = self.audio_processor.compute_audio_envelope(y, sr, fps)
        visual_activity = np.array(video_info['visual_activity_sequence'])

        min_len = min(len(audio_envelope), len(visual_activity))
        audio_envelope = audio_envelope[:min_len]
        visual_activity = visual_activity[:min_len]

        quality_metrics = video_info.get('quality_metrics', {})
        valid_frame_ratio = quality_metrics.get('valid_frame_ratio', 1.0)
        invalid_frames_info = quality_metrics.get('invalid_frames_info', [])

        warnings = []
        evaluation_mode = 'visual_audio_sync'

        MIN_VALID_RATIO_THRESHOLD = 0.5
        if valid_frame_ratio < MIN_VALID_RATIO_THRESHOLD:
            warnings.append({
                'type': 'critical',
                'message': '有效帧比例过低，视频质量可能影响同步评估准确性',
                'details': f'有效帧比例: {valid_frame_ratio:.1%}, 阈值: {MIN_VALID_RATIO_THRESHOLD:.0%}'
            })
            evaluation_mode = 'acoustic_only'

        if quality_metrics.get('side_face_frames', 0) > 0:
            warnings.append({
                'type': 'warning',
                'message': '检测到侧脸帧（超过45度），已进行插值处理',
                'details': f'侧脸帧数: {quality_metrics.get("side_face_frames", 0)}, '
                          f'未检测到人脸帧数: {quality_metrics.get("no_face_frames", 0)}'
            })

        if evaluation_mode == 'visual_audio_sync':
            audio_envelope_smoothed = self._smooth_signal(audio_envelope)
            visual_activity_smoothed = self._smooth_signal(visual_activity)
            offset_frames, correlation_score = self._calculate_offset(
                audio_envelope_smoothed, visual_activity_smoothed
            )
            base_sync_score = self._calculate_sync_score(
                correlation_score, offset_frames, min_len
            )

            quality_penalty = (1.0 - valid_frame_ratio) * 20
            sync_score = max(0, min(100, base_sync_score - quality_penalty))

            sync_curve = self._generate_sync_curve(
                audio_envelope_smoothed, visual_activity_smoothed, offset_frames
            )
        else:
            offset_frames, correlation_score = 0, 0.5
            audio_rms = np.sqrt(np.mean(audio_envelope ** 2))
            voice_activity_ratio = len(self.audio_processor.detect_voice_activity(y, sr)) / max(1, len(audio_envelope) / fps)
            sync_score = min(100, 50 + voice_activity_ratio * 30 + audio_rms * 20)
            sync_curve = self._generate_acoustic_only_sync_curve(audio_envelope)

        voice_segments = self.audio_processor.detect_voice_activity(y, sr)

        multi_speaker_results = None
        try:
            speaker_video_info = self.multi_speaker_evaluator.process_video_with_speakers(
                video_path, voice_segments
            )
            if speaker_video_info['num_speakers_detected'] >= 1:
                speaker_sync_scores = self.multi_speaker_evaluator.calculate_per_speaker_sync_score(
                    speaker_video_info, audio_envelope, fps
                )
                timeline_view = self.multi_speaker_evaluator.generate_timeline_view(
                    speaker_sync_scores, fps
                )

                multi_speaker_results = {
                    'num_speakers_detected': speaker_video_info['num_speakers_detected'],
                    'speaker_names': speaker_video_info['speaker_names'],
                    'speaker_sync_scores': speaker_sync_scores,
                    'speech_segments': speaker_video_info['speech_segments'],
                    'speaker_statistics': speaker_video_info['speaker_statistics'],
                    'timeline_view': timeline_view
                }
        except Exception as e:
            warnings.append({
                'type': 'warning',
                'message': '多说话人检测失败，将使用默认模式',
                'details': str(e)
            })

        memory_manager.clear_numpy_arrays(y, audio_envelope, visual_activity)
        memory_manager.cleanup_after_video()

        return {
            'video_info': {
                'fps': fps,
                'duration': video_info['duration'],
                'total_frames': video_info['total_frames'],
                'resolution': video_info['resolution'],
                'quality_metrics': quality_metrics,
                'video_path': video_path
            },
            'audio_info': {
                'duration': len(y) / sr,
                'sample_rate': sr,
                'voice_segments': voice_segments,
                'audio_path': audio_path
            },
            'sync_analysis': {
                'offset_frames': int(offset_frames),
                'offset_seconds': offset_frames / fps if fps > 0 else 0,
                'correlation_score': float(correlation_score),
                'sync_score': round(sync_score, 2),
                'sync_level': self._get_sync_level(sync_score),
                'evaluation_mode': evaluation_mode,
                'valid_frame_ratio': float(valid_frame_ratio)
            },
            'signals': {
                'audio_envelope': audio_envelope.tolist(),
                'visual_activity': visual_activity.tolist(),
                'sync_curve': sync_curve
            },
            'multi_speaker_analysis': multi_speaker_results,
            'warnings': warnings,
            'invalid_frames_info': invalid_frames_info
        }

    def _smooth_signal(self, signal: np.ndarray, window_size: int = 5) -> np.ndarray:
        if len(signal) < window_size:
            return signal
        kernel = np.ones(window_size) / window_size
        return np.convolve(signal, kernel, mode='same')

    def _calculate_offset(self, audio_signal: np.ndarray, visual_signal: np.ndarray) -> Tuple[int, float]:
        if len(audio_signal) == 0 or len(visual_signal) == 0:
            return 0, 0.0

        corr = correlate(visual_signal, audio_signal, mode='full')
        lag = np.argmax(corr) - len(audio_signal) + 1

        norm_factor = np.linalg.norm(audio_signal) * np.linalg.norm(visual_signal) + 1e-8
        max_corr = corr[np.argmax(corr)] / norm_factor

        return lag, max_corr

    def _calculate_sync_score(self, correlation_score: float, offset_frames: int, total_frames: int) -> float:
        correlation_weight = 0.6
        offset_weight = 0.4

        correlation_component = max(0, min(100, correlation_score * 100))

        max_allowed_offset = 10
        offset_penalty = min(abs(offset_frames), max_allowed_offset) / max_allowed_offset * 100
        offset_component = 100 - offset_penalty

        final_score = correlation_component * correlation_weight + offset_component * offset_weight

        return round(final_score, 2)

    def _get_sync_level(self, score: float) -> str:
        if score >= 85:
            return 'excellent'
        elif score >= 70:
            return 'good'
        elif score >= 50:
            return 'fair'
        else:
            return 'poor'

    def _generate_sync_curve(self, audio_envelope: np.ndarray, visual_activity: np.ndarray,
                             best_offset: int) -> List[Dict]:
        window_size = 30
        sync_curve = []

        for i in range(0, len(audio_envelope), window_size):
            end = min(i + window_size, len(audio_envelope))
            audio_segment = audio_envelope[i:end]
            visual_segment = visual_activity[i:end]

            if len(audio_segment) > 0 and len(visual_segment) > 0:
                _, corr = self._calculate_offset(audio_segment, visual_segment)
                local_score = corr * 100
            else:
                local_score = 0

            sync_curve.append({
                'frame': i,
                'timestamp': i / 30,
                'local_sync_score': local_score
            })

        return sync_curve

    def _generate_acoustic_only_sync_curve(self, audio_envelope: np.ndarray) -> List[Dict]:
        window_size = 30
        sync_curve = []

        for i in range(0, len(audio_envelope), window_size):
            end = min(i + window_size, len(audio_envelope))
            audio_segment = audio_envelope[i:end]

            if len(audio_segment) > 0:
                segment_rms = np.sqrt(np.mean(audio_segment ** 2))
                local_score = 50 + segment_rms * 50
            else:
                local_score = 50

            sync_curve.append({
                'frame': i,
                'timestamp': i / 30,
                'local_sync_score': min(100, local_score),
                'is_acoustic_only': True
            })

        return sync_curve

    def batch_evaluate(self, video_files: List[str], audio_files: List[str]) -> List[Dict]:
        results = []
        for idx, (video_path, audio_path) in enumerate(zip(video_files, audio_files)):
            try:
                result = self.evaluate_sync(video_path, audio_path)
                result['video_path'] = video_path
                result['audio_path'] = audio_path
                result['status'] = 'success'
            except Exception as e:
                result = {
                    'video_path': video_path,
                    'audio_path': audio_path,
                    'status': 'error',
                    'error': str(e)
                }
            results.append(result)

            if (idx + 1) % 3 == 0:
                memory_manager.full_cleanup(force=True)

        memory_manager.full_cleanup(force=True)
        memory_manager.reset_counter()
        return results
