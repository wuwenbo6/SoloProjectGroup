from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import math


class JointType(Enum):
    THROUGH_TENON = "through_tenon"
    BLIND_TENON = "blind_tenon"
    HALF_BLIND_TENON = "half_blind_tenon"
    OPEN_TENON = "open_tenon"
    BRIDLE_JOINT = "bridle_joint"
    MORTISE_AND_TENON = "mortise_and_tenon"
    DOVETAIL = "dovetail"
    BOX_JOINT = "box_joint"
    FINGER_JOINT = "finger_joint"
    HALF_LAP = "half_lap"
    CROSS_LAP = "cross_lap"
    T_LAP = "t_lap"
    DADO = "dado"
    RABBET = "rabbet"
    BISCUIT = "biscuit"
    DOWEL = "dowel"
    UNKNOWN = "unknown"


@dataclass
class ClassificationResult:
    primary_type: str
    confidence: float
    secondary_types: List[Tuple[str, float]]
    characteristics: Dict[str, Any]
    recommendations: List[str]


class JointClassifier:

    JOINT_PROFILES = {
        JointType.THROUGH_TENON: {
            "name": "贯通榫",
            "description": "榫头完全穿过卯眼，两端可见",
            "ratios": {
                "tenon_length_to_depth": (1.0, 1.2),
                "shoulder_length": 0,
                "aspect_ratio": (0.3, 0.8)
            },
            "weight": 1.0
        },
        JointType.BLIND_TENON: {
            "name": "闭口榫",
            "description": "榫头不穿透卯眼，外部不可见",
            "ratios": {
                "tenon_length_to_depth": (0.6, 0.95),
                "shoulder_length": (5, 20),
                "aspect_ratio": (0.4, 0.7)
            },
            "weight": 1.0
        },
        JointType.HALF_BLIND_TENON: {
            "name": "半闭口榫",
            "description": "榫头部分可见，部分隐藏",
            "ratios": {
                "tenon_length_to_depth": (0.7, 1.0),
                "shoulder_length": (2, 10),
                "aspect_ratio": (0.35, 0.75)
            },
            "weight": 0.8
        },
        JointType.BRIDLE_JOINT: {
            "name": "马牙榫",
            "description": "开口较大的榫卯连接",
            "ratios": {
                "tenon_length_to_depth": (0.8, 1.1),
                "shoulder_length": 0,
                "aspect_ratio": (0.2, 0.5)
            },
            "weight": 0.7
        },
        JointType.HALF_LAP: {
            "name": "半搭接",
            "description": "两构件各切去一半后搭接",
            "ratios": {
                "tenon_length_to_depth": (0.4, 0.6),
                "shoulder_length": (10, 50),
                "aspect_ratio": (0.8, 1.5)
            },
            "weight": 0.6
        },
        JointType.DOVETAIL: {
            "name": "燕尾榫",
            "description": "梯形截面的榫头，抗拉拔力强",
            "ratios": {
                "tenon_length_to_depth": (0.5, 1.0),
                "shoulder_length": (3, 15),
                "aspect_ratio": (0.25, 0.6)
            },
            "weight": 0.9
        }
    }

    @classmethod
    def classify(
        cls,
        mortise_width: float,
        mortise_height: float,
        mortise_depth: float,
        tenon_width: float,
        tenon_height: float,
        tenon_length: float,
        fit_clearance: float = 0.1,
        shoulder_length: float = 0
    ) -> ClassificationResult:
        characteristics = cls._extract_characteristics(
            mortise_width, mortise_height, mortise_depth,
            tenon_width, tenon_height, tenon_length,
            fit_clearance, shoulder_length
        )

        scores = []
        for joint_type, profile in cls.JOINT_PROFILES.items():
            score = cls._calculate_match_score(characteristics, profile)
            scores.append((joint_type.value, score))

        scores.sort(key=lambda x: x[1], reverse=True)

        primary_type = scores[0][0] if scores else JointType.UNKNOWN.value
        primary_confidence = scores[0][1] if scores else 0.0
        secondary_types = [(t, s) for t, s in scores[1:4] if s > 0.3]

        recommendations = cls._generate_recommendations(
            primary_type, characteristics, primary_confidence
        )

        return ClassificationResult(
            primary_type=primary_type,
            confidence=round(primary_confidence, 4),
            secondary_types=secondary_types,
            characteristics=characteristics,
            recommendations=recommendations
        )

    @classmethod
    def _extract_characteristics(
        cls,
        mortise_width: float,
        mortise_height: float,
        mortise_depth: float,
        tenon_width: float,
        tenon_height: float,
        tenon_length: float,
        fit_clearance: float,
        shoulder_length: float
    ) -> Dict[str, Any]:
        width_ratio = tenon_width / mortise_width if mortise_width > 0 else 0
        height_ratio = tenon_height / mortise_height if mortise_height > 0 else 0
        length_to_depth_ratio = tenon_length / mortise_depth if mortise_depth > 0 else 0
        aspect_ratio = tenon_width / tenon_height if tenon_height > 0 else 0

        clearance_ratio = fit_clearance / ((mortise_width + mortise_height) / 2) if (mortise_width + mortise_height) > 0 else 0

        volume_ratio = (tenon_width * tenon_height * tenon_length) / (mortise_width * mortise_height * mortise_depth) if (mortise_width * mortise_height * mortise_depth) > 0 else 0

        contact_area_ratio = (
            2 * tenon_width * tenon_length + 2 * tenon_height * tenon_length
        ) / (
            2 * mortise_width * mortise_depth + 2 * mortise_height * mortise_depth
        ) if (2 * mortise_width * mortise_depth + 2 * mortise_height * mortise_depth) > 0 else 0

        fit_tightness = "tight" if clearance_ratio < 0.003 else (
            "medium" if clearance_ratio < 0.008 else "loose"
        )

        is_through = length_to_depth_ratio >= 0.95
        has_shoulder = shoulder_length > 1

        return {
            "width_ratio": round(width_ratio, 4),
            "height_ratio": round(height_ratio, 4),
            "length_to_depth_ratio": round(length_to_depth_ratio, 4),
            "aspect_ratio": round(aspect_ratio, 4),
            "clearance_ratio": round(clearance_ratio, 6),
            "volume_ratio": round(volume_ratio, 4),
            "contact_area_ratio": round(contact_area_ratio, 4),
            "fit_tightness": fit_tightness,
            "is_through": is_through,
            "has_shoulder": has_shoulder,
            "shoulder_length": shoulder_length,
            "dimensions": {
                "mortise": {"width": mortise_width, "height": mortise_height, "depth": mortise_depth},
                "tenon": {"width": tenon_width, "height": tenon_height, "length": tenon_length}
            }
        }

    @classmethod
    def _calculate_match_score(
        cls,
        characteristics: Dict[str, Any],
        profile: Dict[str, Any]
    ) -> float:
        scores = []
        weights = []

        ratios = profile["ratios"]

        length_ratio = characteristics["length_to_depth_ratio"]
        target_min, target_max = ratios["tenon_length_to_depth"]
        if target_min <= length_ratio <= target_max:
            scores.append(1.0)
        else:
            deviation = min(
                abs(length_ratio - target_min),
                abs(length_ratio - target_max)
            )
            scores.append(max(0, 1 - deviation * 2))
        weights.append(0.35)

        shoulder_target = ratios["shoulder_length"]
        if isinstance(shoulder_target, tuple):
            min_shoulder, max_shoulder = shoulder_target
            if min_shoulder <= characteristics["shoulder_length"] <= max_shoulder:
                scores.append(1.0)
            else:
                scores.append(0.5 if characteristics["has_shoulder"] else 0.3)
        else:
            expected_shoulder = shoulder_target > 0
            actual_shoulder = characteristics["has_shoulder"]
            scores.append(1.0 if expected_shoulder == actual_shoulder else 0.4)
        weights.append(0.25)

        aspect_ratio = characteristics["aspect_ratio"]
        ar_min, ar_max = ratios["aspect_ratio"]
        if ar_min <= aspect_ratio <= ar_max:
            scores.append(1.0)
        else:
            deviation = min(
                abs(aspect_ratio - ar_min),
                abs(aspect_ratio - ar_max)
            )
            scores.append(max(0, 1 - deviation * 1.5))
        weights.append(0.2)

        width_ratio = characteristics["width_ratio"]
        height_ratio = characteristics["height_ratio"]
        if 0.9 <= width_ratio <= 1.0 and 0.9 <= height_ratio <= 1.0:
            scores.append(1.0)
        else:
            avg_deviation = (abs(1 - width_ratio) + abs(1 - height_ratio)) / 2
            scores.append(max(0, 1 - avg_deviation * 5))
        weights.append(0.2)

        total_score = sum(s * w for s, w in zip(scores, weights))
        return round(total_score * profile["weight"], 4)

    @classmethod
    def _generate_recommendations(
        cls,
        joint_type: str,
        characteristics: Dict[str, Any],
        confidence: float
    ) -> List[str]:
        recommendations = []

        if confidence < 0.6:
            recommendations.append(
                "分类置信度较低，建议补充更多结构参数以提高准确性"
            )

        fit_tightness = characteristics["fit_tightness"]
        if fit_tightness == "loose":
            recommendations.append(
                "配合间隙较大，建议减小间隙或使用粘合剂增强连接强度"
            )
        elif fit_tightness == "tight":
            recommendations.append(
                "配合较紧，装配时建议使用软锤轻敲，避免强行组装损坏木材"
            )

        if characteristics["is_through"]:
            recommendations.append(
                "贯通榫设计，建议端部进行美化处理或使用盖帽隐藏"
            )

        aspect_ratio = characteristics["aspect_ratio"]
        if aspect_ratio < 0.3:
            recommendations.append(
                "榫头宽高比较小，建议检查抗剪强度，考虑增加榫头宽度"
            )
        elif aspect_ratio > 1.2:
            recommendations.append(
                "榫头宽高比较大，建议检查抗弯强度，考虑增加榫头高度"
            )

        length_ratio = characteristics["length_to_depth_ratio"]
        if length_ratio < 0.5:
            recommendations.append(
                "榫头长度相对较短，建议增加榫长以提高拔出抗力"
            )
        elif length_ratio > 1.15:
            recommendations.append(
                "榫头长度超过卯眼深度较多，可能导致端部突出或配合不良"
            )

        if joint_type == JointType.BLIND_TENON.value:
            recommendations.append(
                "闭口榫设计，建议精确控制榫长，避免顶底间隙过大"
            )
        elif joint_type == JointType.DOVETAIL.value:
            recommendations.append(
                "燕尾榫设计，建议使用专用工具加工，保证斜面角度精确"
            )

        return recommendations


def classify_joint(params: Dict[str, Any]) -> Dict[str, Any]:
    result = JointClassifier.classify(
        mortise_width=params.get("mortise_width", 0),
        mortise_height=params.get("mortise_height", 0),
        mortise_depth=params.get("mortise_depth", 0),
        tenon_width=params.get("tenon_width", 0),
        tenon_height=params.get("tenon_height", 0),
        tenon_length=params.get("tenon_length", 0),
        fit_clearance=params.get("fit_clearance", 0.1),
        shoulder_length=params.get("shoulder_length", 0)
    )

    return {
        "primary_type": result.primary_type,
        "primary_type_name": JointClassifier.JOINT_PROFILES.get(
            JointType(result.primary_type), {}
        ).get("name", result.primary_type),
        "confidence": result.confidence,
        "secondary_types": [
            {
                "type": t,
                "type_name": JointClassifier.JOINT_PROFILES.get(
                    JointType(t), {}
                ).get("name", t),
                "confidence": round(s, 4)
            }
            for t, s in result.secondary_types
        ],
        "characteristics": result.characteristics,
        "recommendations": result.recommendations
    }


def get_all_joint_types() -> List[Dict[str, Any]]:
    return [
        {
            "type": jt.value,
            "name": profile["name"],
            "description": profile["description"]
        }
        for jt, profile in JointClassifier.JOINT_PROFILES.items()
    ]
