import numpy as np
from typing import Dict, List, Tuple

class AngleAnalyzer:
    def __init__(self):
        self.joint_pairs = {
            "left_arm": ["left_shoulder", "left_elbow", "left_wrist"],
            "right_arm": ["right_shoulder", "right_elbow", "right_wrist"],
            "left_leg": ["left_hip", "left_knee", "left_ankle"],
            "right_leg": ["right_hip", "right_knee", "right_ankle"],
            "torso_left": ["left_shoulder", "left_hip", "left_knee"],
            "torso_right": ["right_shoulder", "right_hip", "right_knee"]
        }
        
        self.angle_thresholds = {
            "left_arm": {"min": 90, "max": 160, "optimal": 135},
            "right_arm": {"min": 90, "max": 160, "optimal": 135},
            "left_leg": {"min": 150, "max": 180, "optimal": 170},
            "right_leg": {"min": 150, "max": 180, "optimal": 170},
            "torso_left": {"min": 160, "max": 180, "optimal": 175},
            "torso_right": {"min": 160, "max": 180, "optimal": 175}
        }
    
    def calculate_angle(self, p1: Dict, p2: Dict, p3: Dict) -> float:
        try:
            a = np.array([p1.get("x", 0), p1.get("y", 0)])
            b = np.array([p2.get("x", 0), p2.get("y", 0)])
            c = np.array([p3.get("x", 0), p3.get("y", 0)])
            
            ba = a - b
            bc = c - b
            
            cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
            angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
            
            return np.degrees(angle)
        except Exception:
            return 0.0
    
    def analyze_frame(self, pose_data: Dict) -> Dict:
        angles = {}
        feedback = []
        
        for joint_name, keypoints in self.joint_pairs.items():
            if all(kp in pose_data for kp in keypoints):
                p1, p2, p3 = [pose_data[kp] for kp in keypoints]
                angle = self.calculate_angle(p1, p2, p3)
                angles[joint_name] = round(angle, 1)
                
                threshold = self.angle_thresholds.get(joint_name, {})
                min_angle = threshold.get("min", 0)
                max_angle = threshold.get("max", 180)
                
                if angle < min_angle:
                    feedback.append({
                        "joint": self._get_joint_display_name(joint_name),
                        "issue": "角度过小",
                        "suggestion": self._get_correction_suggestion(joint_name, "too_small"),
                        "deviation": round(min_angle - angle, 1),
                        "severity": "warning" if angle < min_angle - 10 else "info"
                    })
                elif angle > max_angle:
                    feedback.append({
                        "joint": self._get_joint_display_name(joint_name),
                        "issue": "角度过大",
                        "suggestion": self._get_correction_suggestion(joint_name, "too_large"),
                        "deviation": round(angle - max_angle, 1),
                        "severity": "warning" if angle > max_angle + 10 else "info"
                    })
        
        return {
            "angles": angles,
            "feedback": feedback
        }
    
    def _get_joint_display_name(self, joint_name: str) -> str:
        names = {
            "left_arm": "左臂",
            "right_arm": "右臂",
            "left_leg": "左腿",
            "right_leg": "右腿",
            "torso_left": "左躯干",
            "torso_right": "右躯干"
        }
        return names.get(joint_name, joint_name)
    
    def _get_correction_suggestion(self, joint_name: str, issue_type: str) -> str:
        suggestions = {
            "left_arm": {
                "too_small": "请将左手臂伸直一些，保持自然弯曲",
                "too_large": "请稍微弯曲左手臂，不要过度伸直"
            },
            "right_arm": {
                "too_small": "请将右手臂伸直一些，保持自然弯曲",
                "too_large": "请稍微弯曲右手臂，不要过度伸直"
            },
            "left_leg": {
                "too_small": "请将左腿伸直一些，保持膝盖微屈",
                "too_large": "请稍微弯曲左膝盖，不要锁死"
            },
            "right_leg": {
                "too_small": "请将右腿伸直一些，保持膝盖微屈",
                "too_large": "请稍微弯曲右膝盖，不要锁死"
            },
            "torso_left": {
                "too_small": "请挺直上身，保持脊柱正直",
                "too_large": "请稍微放松上身，不要过度后仰"
            },
            "torso_right": {
                "too_small": "请挺直上身，保持脊柱正直",
                "too_large": "请稍微放松上身，不要过度后仰"
            }
        }
        return suggestions.get(joint_name, {}).get(issue_type, "请调整姿势")
    
    def calculate_overall_score(self, angle_history: List[Dict]) -> float:
        if not angle_history:
            return 0.0
        
        total_deviation = 0
        valid_count = 0
        
        for frame_data in angle_history:
            angles = frame_data.get("angles", {})
            for joint_name, angle in angles.items():
                threshold = self.angle_thresholds.get(joint_name, {})
                optimal = threshold.get("optimal", 90)
                deviation = abs(angle - optimal)
                total_deviation += deviation
                valid_count += 1
        
        if valid_count == 0:
            return 0.0
        
        avg_deviation = total_deviation / valid_count
        score = max(0, 100 - avg_deviation)
        
        return round(score, 1)
