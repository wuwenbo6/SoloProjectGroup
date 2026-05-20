import numpy as np
from dtaidistance import dtw
from typing import List, Dict, Tuple

class DTWCalculator:
    def __init__(self):
        self.standard_poses = self._load_standard_poses()
    
    def _load_standard_poses(self) -> Dict[str, List[Dict]]:
        return {
            "起势": self._generate_standard_qishi(),
            "野马分鬃": self._generate_standard_yemafenzhong(),
            "云手": self._generate_standard_yunshou()
        }
    
    def _generate_standard_qishi(self) -> List[Dict]:
        frames = []
        for t in np.linspace(0, 1, 30):
            left_shoulder_y = 0.3 + 0.1 * t
            right_shoulder_y = 0.3 + 0.1 * t
            left_elbow_y = 0.5 + 0.15 * t
            right_elbow_y = 0.5 + 0.15 * t
            left_wrist_y = 0.7 + 0.2 * t
            right_wrist_y = 0.7 + 0.2 * t
            
            frames.append({
                "left_shoulder": {"y": left_shoulder_y},
                "right_shoulder": {"y": right_shoulder_y},
                "left_elbow": {"y": left_elbow_y},
                "right_elbow": {"y": right_elbow_y},
                "left_wrist": {"y": left_wrist_y},
                "right_wrist": {"y": right_wrist_y},
                "left_hip": {"y": 0.8},
                "right_hip": {"y": 0.8},
                "left_knee": {"y": 0.9},
                "right_knee": {"y": 0.9},
                "left_ankle": {"y": 1.0},
                "right_ankle": {"y": 1.0}
            })
        return frames
    
    def _generate_standard_yemafenzhong(self) -> List[Dict]:
        frames = []
        for t in np.linspace(0, 1, 30):
            left_shoulder_y = 0.3 + 0.05 * np.sin(t * np.pi)
            right_shoulder_y = 0.3 + 0.05 * np.sin(t * np.pi)
            left_elbow_y = 0.5 + 0.2 * np.sin(t * np.pi)
            right_elbow_y = 0.5 + 0.2 * np.sin(t * np.pi)
            left_wrist_y = 0.7 + 0.25 * np.sin(t * np.pi)
            right_wrist_y = 0.7 + 0.25 * np.sin(t * np.pi)
            
            frames.append({
                "left_shoulder": {"y": left_shoulder_y},
                "right_shoulder": {"y": right_shoulder_y},
                "left_elbow": {"y": left_elbow_y},
                "right_elbow": {"y": right_elbow_y},
                "left_wrist": {"y": left_wrist_y},
                "right_wrist": {"y": right_wrist_y},
                "left_hip": {"y": 0.8},
                "right_hip": {"y": 0.8},
                "left_knee": {"y": 0.9},
                "right_knee": {"y": 0.9},
                "left_ankle": {"y": 1.0},
                "right_ankle": {"y": 1.0}
            })
        return frames
    
    def _generate_standard_yunshou(self) -> List[Dict]:
        frames = []
        for t in np.linspace(0, 1, 30):
            left_shoulder_y = 0.3 + 0.03 * np.sin(t * 2 * np.pi)
            right_shoulder_y = 0.3 + 0.03 * np.sin(t * 2 * np.pi)
            left_elbow_y = 0.5 + 0.15 * np.sin(t * 2 * np.pi)
            right_elbow_y = 0.5 + 0.15 * np.cos(t * 2 * np.pi)
            left_wrist_y = 0.7 + 0.2 * np.sin(t * 2 * np.pi)
            right_wrist_y = 0.7 + 0.2 * np.cos(t * 2 * np.pi)
            
            frames.append({
                "left_shoulder": {"y": left_shoulder_y},
                "right_shoulder": {"y": right_shoulder_y},
                "left_elbow": {"y": left_elbow_y},
                "right_elbow": {"y": right_elbow_y},
                "left_wrist": {"y": left_wrist_y},
                "right_wrist": {"y": right_wrist_y},
                "left_hip": {"y": 0.8},
                "right_hip": {"y": 0.8},
                "left_knee": {"y": 0.9},
                "right_knee": {"y": 0.9},
                "left_ankle": {"y": 1.0},
                "right_ankle": {"y": 1.0}
            })
        return frames
    
    def _pose_to_sequence(self, pose_frames: List[Dict]) -> np.ndarray:
        features = []
        for frame in pose_frames:
            frame_features = []
            keypoints = [
                "left_shoulder", "right_shoulder",
                "left_elbow", "right_elbow",
                "left_wrist", "right_wrist",
                "left_hip", "right_hip",
                "left_knee", "right_knee",
                "left_ankle", "right_ankle"
            ]
            for kp in keypoints:
                if kp in frame and "y" in frame[kp]:
                    frame_features.append(frame[kp]["y"])
                else:
                    frame_features.append(0.0)
            features.append(frame_features)
        return np.array(features, dtype=np.double)
    
    def calculate_similarity(self, user_poses: List[Dict], movement_name: str) -> Tuple[float, Dict]:
        if movement_name not in self.standard_poses:
            return 0.0, {}
        
        standard_poses = self.standard_poses[movement_name]
        
        user_seq = self._pose_to_sequence(user_poses)
        standard_seq = self._pose_to_sequence(standard_poses)
        
        if len(user_seq) < 2 or len(standard_seq) < 2:
            return 0.0, {}
        
        try:
            distance = dtw.distance_fast(user_seq, standard_seq)
            max_possible_distance = len(standard_seq) * 5.0
            similarity = max(0, 100 - (distance / max_possible_distance) * 100)
            
            path = dtw.warping_path(user_seq, standard_seq)
            frame_mapping = {u: s for u, s in path}
            
            return min(100, similarity), frame_mapping
        except Exception as e:
            print(f"DTW calculation error: {e}")
            return 0.0, {}
    
    def get_available_movements(self) -> List[str]:
        return list(self.standard_poses.keys())
