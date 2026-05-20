import cv2
import numpy as np
import face_recognition
from scipy.interpolate import interp1d
from typing import List, Dict, Tuple, Optional
import os
import warnings
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.memory_manager import memory_manager


class LipDetector:
    def __init__(self):
        self.lip_landmarks_indices = {
            'top_lip': [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67],
            'bottom_lip': [61, 62, 63, 64, 65, 66, 67, 56, 57, 58, 59, 60]
        }
        self.YAW_THRESHOLD = 45  # 侧脸角度阈值（度）

    def estimate_head_pose(self, landmarks: Dict) -> Tuple[float, str]:
        try:
            nose_bridge = np.array(landmarks['nose_bridge'])
            left_eye = np.array(landmarks['left_eye'])
            right_eye = np.array(landmarks['right_eye'])
            left_cheek = np.array(landmarks['chin'][4])
            right_cheek = np.array(landmarks['chin'][12])

            left_eye_center = np.mean(left_eye, axis=0)
            right_eye_center = np.mean(right_eye, axis=0)
            nose_tip = nose_bridge[-1]

            eye_midpoint = (left_eye_center + right_eye_center) / 2

            eye_distance = np.linalg.norm(left_eye_center - right_eye_center)
            nose_to_left_eye = np.linalg.norm(nose_tip - left_eye_center)
            nose_to_right_eye = np.linalg.norm(nose_tip - right_eye_center)

            nose_to_left_cheek = np.linalg.norm(nose_tip - left_cheek)
            nose_to_right_cheek = np.linalg.norm(nose_tip - right_cheek)

            if eye_distance < 1e-6:
                return 0, 'frontal'

            asymmetry_ratio = abs(nose_to_left_eye - nose_to_right_eye) / eye_distance
            cheek_asymmetry = abs(nose_to_left_cheek - nose_to_right_cheek) / eye_distance

            horizontal_offset = (nose_tip[0] - eye_midpoint[0]) / eye_distance

            yaw_estimate = abs(horizontal_offset) * 90 + asymmetry_ratio * 30 + cheek_asymmetry * 20

            if horizontal_offset > 0.3:
                face_orientation = 'left_profile'
            elif horizontal_offset < -0.3:
                face_orientation = 'right_profile'
            elif abs(horizontal_offset) > 0.15:
                face_orientation = 'partial_side'
            else:
                face_orientation = 'frontal'

            return yaw_estimate, face_orientation

        except Exception as e:
            warnings.warn(f"头部姿态估计失败: {str(e)}")
            return 0, 'unknown'

    def extract_frame_lip_landmarks(self, frame: np.ndarray) -> Optional[Dict]:
        face_landmarks_list = face_recognition.face_landmarks(frame)

        if not face_landmarks_list:
            return None

        face_landmarks = face_landmarks_list[0]

        yaw_angle, face_orientation = self.estimate_head_pose(face_landmarks)

        is_invalid_pose = yaw_angle > self.YAW_THRESHOLD

        try:
            top_lip = np.array(face_landmarks['top_lip'])
            bottom_lip = np.array(face_landmarks['bottom_lip'])

            mouth_openness = self._calculate_mouth_openness(top_lip, bottom_lip)
            lip_area = self._calculate_lip_area(top_lip, bottom_lip)
            lip_center = self._calculate_lip_center(top_lip, bottom_lip)

            return {
                'top_lip': top_lip.tolist(),
                'bottom_lip': bottom_lip.tolist(),
                'mouth_openness': mouth_openness,
                'lip_area': lip_area,
                'lip_center': lip_center,
                'yaw_angle': float(yaw_angle),
                'face_orientation': face_orientation,
                'is_invalid_pose': is_invalid_pose
            }
        except Exception as e:
            warnings.warn(f"唇形关键点提取失败: {str(e)}")
            return None

    def _calculate_mouth_openness(self, top_lip: np.ndarray, bottom_lip: np.ndarray) -> float:
        top_center = np.mean(top_lip[6:12], axis=0)
        bottom_center = np.mean(bottom_lip[6:12], axis=0)
        distance = np.linalg.norm(top_center - bottom_center)
        return float(distance)

    def _calculate_lip_area(self, top_lip: np.ndarray, bottom_lip: np.ndarray) -> float:
        all_points = np.vstack([top_lip, bottom_lip])
        x_min, y_min = np.min(all_points, axis=0)
        x_max, y_max = np.max(all_points, axis=0)
        area = (x_max - x_min) * (y_max - y_min)
        return float(area)

    def _calculate_lip_center(self, top_lip: np.ndarray, bottom_lip: np.ndarray) -> List[float]:
        all_points = np.vstack([top_lip, bottom_lip])
        center = np.mean(all_points, axis=0)
        return center.tolist()

    def _interpolate_invalid_frames(self, sequence: List[float], invalid_mask: List[bool]) -> np.ndarray:
        seq_array = np.array(sequence, dtype=float)
        mask_array = np.array(invalid_mask, dtype=bool)

        valid_indices = np.where(~mask_array)[0]
        invalid_indices = np.where(mask_array)[0]

        if len(valid_indices) == 0:
            return np.zeros_like(seq_array)

        if len(invalid_indices) == 0:
            return seq_array

        valid_values = seq_array[valid_indices]
        x = np.arange(len(seq_array))

        try:
            if len(valid_indices) >= 2:
                interpolator = interp1d(valid_indices, valid_values,
                                        kind='linear', fill_value='extrapolate',
                                        bounds_error=False)
                seq_array[invalid_indices] = interpolator(invalid_indices)
            else:
                seq_array[invalid_indices] = valid_values[0]
        except Exception as e:
            warnings.warn(f"插值失败: {str(e)}，使用前值填充")
            for idx in invalid_indices:
                if idx > 0:
                    seq_array[idx] = seq_array[idx - 1]

        return seq_array

    def process_video(self, video_path: str) -> Dict:
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        frame_landmarks = []
        mouth_openness_sequence = []
        lip_area_sequence = []
        invalid_frame_mask = []
        invalid_frames_info = []

        no_face_count = 0
        side_face_count = 0
        detection_failed_count = 0

        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            landmarks = self.extract_frame_lip_landmarks(rgb_frame)

            if frame_count % 100 == 0:
                memory_manager.clear_numpy_arrays(rgb_frame, frame)
                memory_manager.force_gc()

            frame_info = {
                'frame': frame_count,
                'timestamp': frame_count / fps if fps > 0 else 0,
                'is_valid': True,
                'invalid_reason': None
            }

            if landmarks is None:
                no_face_count += 1
                frame_info.update({
                    'is_valid': False,
                    'invalid_reason': 'no_face_detected',
                    'landmarks': None
                })
                mouth_openness_sequence.append(0)
                lip_area_sequence.append(0)
                invalid_frame_mask.append(True)
                invalid_frames_info.append({
                    'frame': frame_count,
                    'reason': '未检测到人脸',
                    'timestamp': frame_count / fps if fps > 0 else 0
                })
            elif landmarks.get('is_invalid_pose', False):
                side_face_count += 1
                frame_info.update({
                    'is_valid': False,
                    'invalid_reason': 'side_face_over_45_degrees',
                    'landmarks': landmarks
                })
                mouth_openness_sequence.append(landmarks['mouth_openness'])
                lip_area_sequence.append(landmarks['lip_area'])
                invalid_frame_mask.append(True)
                invalid_frames_info.append({
                    'frame': frame_count,
                    'reason': '侧脸超过45度（无效帧）',
                    'yaw_angle': landmarks.get('yaw_angle', 0),
                    'face_orientation': landmarks.get('face_orientation', 'unknown'),
                    'timestamp': frame_count / fps if fps > 0 else 0
                })
            else:
                frame_info['landmarks'] = landmarks
                mouth_openness_sequence.append(landmarks['mouth_openness'])
                lip_area_sequence.append(landmarks['lip_area'])
                invalid_frame_mask.append(False)

            frame_landmarks.append(frame_info)
            frame_count += 1

        cap.release()
        del cap

        memory_manager.force_gc()
        memory_manager.clear_torch_cache()

        mouth_openness_sequence = self._interpolate_invalid_frames(
            mouth_openness_sequence, invalid_frame_mask
        )
        lip_area_sequence = self._interpolate_invalid_frames(
            lip_area_sequence, invalid_frame_mask
        )

        mouth_openness_sequence = np.array(mouth_openness_sequence)
        if mouth_openness_sequence.max() > 0:
            mouth_openness_sequence = (mouth_openness_sequence - mouth_openness_sequence.min()) / \
                                      (mouth_openness_sequence.max() - mouth_openness_sequence.min() + 1e-8)

        lip_area_sequence = np.array(lip_area_sequence)
        if lip_area_sequence.max() > 0:
            lip_area_sequence = (lip_area_sequence - lip_area_sequence.min()) / \
                                (lip_area_sequence.max() - lip_area_sequence.min() + 1e-8)

        total_invalid = no_face_count + side_face_count + detection_failed_count
        valid_frame_ratio = 1.0 - (total_invalid / total_frames if total_frames > 0 else 0)

        return {
            'fps': fps,
            'total_frames': total_frames,
            'resolution': {'width': width, 'height': height},
            'duration': total_frames / fps if fps > 0 else 0,
            'frame_landmarks': frame_landmarks,
            'mouth_openness_sequence': mouth_openness_sequence.tolist(),
            'lip_area_sequence': lip_area_sequence.tolist(),
            'visual_activity_sequence': (mouth_openness_sequence * 0.7 + lip_area_sequence * 0.3).tolist(),
            'quality_metrics': {
                'total_frames': total_frames,
                'valid_frames': total_frames - total_invalid,
                'invalid_frames': total_invalid,
                'no_face_frames': no_face_count,
                'side_face_frames': side_face_count,
                'detection_failed_frames': detection_failed_count,
                'valid_frame_ratio': float(valid_frame_ratio),
                'invalid_frames_info': invalid_frames_info
            }
        }

    def get_lip_movement_signal(self, video_info: Dict) -> np.ndarray:
        return np.array(video_info['visual_activity_sequence'])
