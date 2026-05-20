import cv2
import numpy as np
import face_recognition
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import warnings
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.memory_manager import memory_manager


class SpeakerTracker:
    def __init__(self, max_speakers: int = 2, similarity_threshold: float = 0.6):
        self.max_speakers = max_speakers
        self.similarity_threshold = similarity_threshold
        self.known_face_encodings = []
        self.known_face_names = []
        self.speaker_face_count = defaultdict(int)
        self.speech_segments = defaultdict(list)
        self.current_speaker = None
        self.frame_count = 0

    def reset(self):
        self.known_face_encodings = []
        self.known_face_names = []
        self.speaker_face_count.clear()
        self.speech_segments.clear()
        self.current_speaker = None
        self.frame_count = 0

    def detect_and_track_faces(self, frame: np.ndarray, rgb_frame: np.ndarray,
                                is_audio_active: bool = False) -> List[Dict]:
        face_locations = face_recognition.face_locations(rgb_frame)
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
        face_landmarks_list = face_recognition.face_landmarks(rgb_frame)

        detected_faces = []

        for i, (face_encoding, face_location, landmarks) in enumerate(zip(face_encodings, face_locations, face_landmarks_list)):
            speaker_id = self._identify_speaker(face_encoding)

            top, right, bottom, left = face_location
            face_center = ((left + right) // 2, (top + bottom) // 2)
            face_size = (right - left) * (bottom - top)

            mouth_openness = self._calculate_mouth_openness(landmarks)

            face_info = {
                'speaker_id': speaker_id,
                'face_location': (top, right, bottom, left),
                'face_center': face_center,
                'face_size': face_size,
                'mouth_openness': mouth_openness,
                'is_speaking': mouth_openness > 0.3 and is_audio_active,
                'landmarks': landmarks
            }

            detected_faces.append(face_info)

            if is_audio_active and face_size > 10000:
                self._update_speech_segment(speaker_id, self.frame_count, face_info)

        self.frame_count += 1
        return detected_faces

    def _identify_speaker(self, face_encoding: np.ndarray) -> int:
        if not self.known_face_encodings:
            speaker_id = 0
            self.known_face_encodings.append(face_encoding)
            self.known_face_names.append(f"Speaker_{speaker_id}")
            return speaker_id

        face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
        best_match_index = np.argmin(face_distances)

        if face_distances[best_match_index] < self.similarity_threshold:
            self.speaker_face_count[best_match_index] += 1
            return best_match_index
        elif len(self.known_face_encodings) < self.max_speakers:
            new_speaker_id = len(self.known_face_encodings)
            self.known_face_encodings.append(face_encoding)
            self.known_face_names.append(f"Speaker_{new_speaker_id}")
            self.speaker_face_count[new_speaker_id] += 1
            return new_speaker_id
        else:
            return best_match_index

    def _calculate_mouth_openness(self, landmarks: Dict) -> float:
        try:
            top_lip = np.array(landmarks['top_lip'])
            bottom_lip = np.array(landmarks['bottom_lip'])

            top_center = np.mean(top_lip[6:12], axis=0)
            bottom_center = np.mean(bottom_lip[6:12], axis=0)

            vertical_distance = np.linalg.norm(top_center - bottom_center)

            face_width = np.linalg.norm(np.array(landmarks['chin'][0]) - np.array(landmarks['chin'][-1]))

            normalized_openness = vertical_distance / face_width if face_width > 0 else 0
            return float(normalized_openness)
        except Exception as e:
            warnings.warn(f"嘴张开度计算失败: {str(e)}")
            return 0.0

    def _update_speech_segment(self, speaker_id: int, frame_num: int, face_info: Dict):
        if not self.speech_segments[speaker_id]:
            self.speech_segments[speaker_id].append({
                'start_frame': frame_num,
                'end_frame': frame_num,
                'mouth_openness_values': [face_info['mouth_openness']]
            })
        else:
            last_segment = self.speech_segments[speaker_id][-1]
            if frame_num - last_segment['end_frame'] <= 5:
                last_segment['end_frame'] = frame_num
                last_segment['mouth_openness_values'].append(face_info['mouth_openness'])
            else:
                self.speech_segments[speaker_id].append({
                    'start_frame': frame_num,
                    'end_frame': frame_num,
                    'mouth_openness_values': [face_info['mouth_openness']]
                })

    def get_speech_segments(self, fps: float) -> Dict[str, List[Dict]]:
        result = {}
        for speaker_id, segments in self.speech_segments.items():
            speaker_segments = []
            for seg in segments:
                avg_openness = np.mean(seg['mouth_openness_values'])
                duration_frames = seg['end_frame'] - seg['start_frame'] + 1
                if duration_frames >= 15:
                    speaker_segments.append({
                        'speaker_id': speaker_id,
                        'speaker_name': f"Speaker_{speaker_id}",
                        'start_time': round(seg['start_frame'] / fps, 3),
                        'end_time': round(seg['end_frame'] / fps, 3),
                        'duration_frames': duration_frames,
                        'avg_mouth_openness': round(avg_openness, 4)
                    })
            result[f"Speaker_{speaker_id}"] = speaker_segments
        return result

    def get_dominant_speaker_at_frame(self, frame_num: int) -> Optional[int]:
        for speaker_id, segments in self.speech_segments.items():
            for seg in segments:
                if seg['start_frame'] <= frame_num <= seg['end_frame']:
                    return speaker_id
        return None

    def get_speaker_statistics(self) -> Dict:
        stats = {}
        for speaker_id, segments in self.speech_segments.items():
            total_frames = sum(s['end_frame'] - s['start_frame'] + 1 for s in segments)
            stats[f"Speaker_{speaker_id}"] = {
                'speech_segments_count': len(segments),
                'total_speech_frames': total_frames,
                'detection_count': self.speaker_face_count.get(speaker_id, 0)
            }
        return stats


class MultiSpeakerSyncEvaluator:
    def __init__(self):
        self.speaker_tracker = SpeakerTracker(max_speakers=2)

    def process_video_with_speakers(self, video_path: str, audio_activity: List[Dict]) -> Dict:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        self.speaker_tracker.reset()

        frame_face_info = []
        speaker_visual_signals = defaultdict(list)

        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            current_time = frame_count / fps
            is_audio_active = self._check_audio_activity(audio_activity, current_time)

            detected_faces = self.speaker_tracker.detect_and_track_faces(frame, rgb_frame, is_audio_active)

            frame_face_info.append({
                'frame': frame_count,
                'timestamp': current_time,
                'num_faces_detected': len(detected_faces),
                'faces': detected_faces
            })

            for face in detected_faces:
                speaker_id = face['speaker_id']
                speaker_visual_signals[speaker_id].append({
                    'frame': frame_count,
                    'timestamp': current_time,
                    'mouth_openness': face['mouth_openness'],
                    'is_speaking': face['is_speaking']
                })

            if frame_count % 100 == 0:
                memory_manager.clear_numpy_arrays(rgb_frame, frame)
                memory_manager.force_gc()

            frame_count += 1

        cap.release()
        del cap

        speech_segments = self.speaker_tracker.get_speech_segments(fps)
        speaker_stats = self.speaker_tracker.get_speaker_statistics()

        visual_signals_by_speaker = {}
        for speaker_id, signals in speaker_visual_signals.items():
            visual_signals_by_speaker[f"Speaker_{speaker_id}"] = {
                'frames': [s['frame'] for s in signals],
                'timestamps': [s['timestamp'] for s in signals],
                'mouth_openness': [s['mouth_openness'] for s in signals]
            }

        return {
            'fps': fps,
            'total_frames': total_frames,
            'num_speakers_detected': len(self.speaker_tracker.known_face_encodings),
            'speaker_names': self.speaker_tracker.known_face_names,
            'frame_face_info': frame_face_info,
            'speech_segments': speech_segments,
            'speaker_statistics': speaker_stats,
            'visual_signals_by_speaker': visual_signals_by_speaker
        }

    def _check_audio_activity(self, audio_activity: List[Dict], current_time: float) -> bool:
        for segment in audio_activity:
            if segment['start'] <= current_time <= segment['end']:
                return True
        return False

    def calculate_per_speaker_sync_score(self, speaker_video_info: Dict,
                                          audio_envelope: np.ndarray, fps: float) -> Dict:
        speaker_sync_results = {}

        for speaker_name, visual_data in speaker_video_info['visual_signals_by_speaker'].items():
            mouth_openness = np.array(visual_data['mouth_openness'])
            if len(mouth_openness) < 10:
                speaker_sync_results[speaker_name] = {
                    'sync_score': 0,
                    'confidence': 'low',
                    'reason': 'Insufficient visual data'
                }
                continue

            min_len = min(len(audio_envelope), len(mouth_openness))
            audio_segment = audio_envelope[:min_len]
            visual_segment = mouth_openness[:min_len]

            if np.std(visual_segment) < 1e-6:
                speaker_sync_results[speaker_name] = {
                    'sync_score': 50,
                    'confidence': 'medium',
                    'reason': 'Low variation in visual signal'
                }
                continue

            correlation = np.corrcoef(audio_segment, visual_segment)[0, 1]
            correlation_score = max(0, min(100, (abs(correlation) * 100)))

            sync_score = round(correlation_score * 0.8 + 50 * 0.2, 2)

            speaker_sync_results[speaker_name] = {
                'sync_score': sync_score,
                'correlation': round(float(correlation), 4),
                'confidence': 'high' if sync_score > 70 else 'medium' if sync_score > 50 else 'low',
                'speech_segments': speaker_video_info['speech_segments'].get(speaker_name, []),
                'statistics': speaker_video_info['speaker_statistics'].get(speaker_name, {})
            }

        return speaker_sync_results

    def generate_timeline_view(self, speaker_sync_results: Dict, fps: float) -> List[Dict]:
        timeline = []

        for speaker_name, result in speaker_sync_results.items():
            if result.get('speech_segments'):
                for segment in result['speech_segments']:
                    timeline.append({
                        'speaker': speaker_name,
                        'start_time': segment['start_time'],
                        'end_time': segment['end_time'],
                        'duration': round(segment['end_time'] - segment['start_time'], 3),
                        'avg_mouth_openness': segment['avg_mouth_openness'],
                        'speaker_sync_score': result['sync_score'],
                        'confidence': result['confidence']
                    })

        timeline.sort(key=lambda x: x['start_time'])
        return timeline
