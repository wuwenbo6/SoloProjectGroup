import time
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
from collections import deque


class PestSeverity(Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    SEVERE = "severe"
    CRITICAL = "critical"


@dataclass
class SeverityResult:
    pest_type: str
    severity: PestSeverity
    severity_level: int
    confidence: float
    affected_area_ratio: float
    pest_count_estimate: int
    trend: str
    recommendation_level: str
    timestamp: float
    detail: Dict


@dataclass
class ControlRecommendation:
    pest_type: str
    severity: PestSeverity
    immediate_actions: List[str]
    prevention_measures: List[str]
    chemical_treatment: str
    monitoring_advice: str
    estimated_cost: str
    priority: int


class PestSeverityClassifier:
    def __init__(self, history_size: int = 50):
        self.history_size = history_size
        self.detection_history: deque = deque(maxlen=history_size)
        self.area_history: deque = deque(maxlen=history_size)
        
        self.severity_thresholds = {
            'aphid': {
                PestSeverity.LOW: (0.01, 10),
                PestSeverity.MEDIUM: (0.05, 50),
                PestSeverity.HIGH: (0.15, 200),
                PestSeverity.SEVERE: (0.30, 500),
                PestSeverity.CRITICAL: (0.50, 1000),
            },
            'whitefly': {
                PestSeverity.LOW: (0.01, 5),
                PestSeverity.MEDIUM: (0.04, 30),
                PestSeverity.HIGH: (0.12, 150),
                PestSeverity.SEVERE: (0.25, 400),
                PestSeverity.CRITICAL: (0.45, 800),
            },
            'thrips': {
                PestSeverity.LOW: (0.008, 8),
                PestSeverity.MEDIUM: (0.03, 40),
                PestSeverity.HIGH: (0.10, 150),
                PestSeverity.SEVERE: (0.22, 400),
                PestSeverity.CRITICAL: (0.40, 800),
            },
            'spider_mite': {
                PestSeverity.LOW: (0.015, 15),
                PestSeverity.MEDIUM: (0.06, 60),
                PestSeverity.HIGH: (0.18, 250),
                PestSeverity.SEVERE: (0.35, 600),
                PestSeverity.CRITICAL: (0.55, 1200),
            },
            'bollworm': {
                PestSeverity.LOW: (0.02, 3),
                PestSeverity.MEDIUM: (0.08, 15),
                PestSeverity.HIGH: (0.20, 50),
                PestSeverity.SEVERE: (0.35, 150),
                PestSeverity.CRITICAL: (0.50, 300),
            },
        }

        self.default_thresholds = {
            PestSeverity.LOW: (0.01, 10),
            PestSeverity.MEDIUM: (0.05, 50),
            PestSeverity.HIGH: (0.15, 200),
            PestSeverity.SEVERE: (0.30, 500),
            PestSeverity.CRITICAL: (0.50, 1000),
        }

    def extract_density_features(self, image: np.ndarray) -> Dict:
        import cv2
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if len(image.shape) == 3 else image
        
        h, w = gray.shape
        total_pixels = h * w
        
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(cleaned, 8, cv2.CV_32S)
        
        valid_blobs = []
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if 5 <= area <= 500:
                valid_blobs.append(area)
        
        affected_pixels = np.sum(labels > 0)
        affected_ratio = affected_pixels / total_pixels if total_pixels > 0 else 0
        
        edge_density = self._calculate_edge_density(gray)
        texture_complexity = self._calculate_texture_complexity(gray)
        
        return {
            'blob_count': len(valid_blobs),
            'affected_ratio': affected_ratio,
            'edge_density': edge_density,
            'texture_complexity': texture_complexity,
            'avg_blob_size': np.mean(valid_blobs) if valid_blobs else 0,
            'total_affected_pixels': int(affected_pixels),
        }

    def _calculate_edge_density(self, gray: np.ndarray) -> float:
        import cv2
        edges = cv2.Canny(gray, 50, 150)
        edge_pixels = np.sum(edges > 0)
        total_pixels = gray.shape[0] * gray.shape[1]
        return edge_pixels / total_pixels if total_pixels > 0 else 0

    def _calculate_texture_complexity(self, gray: np.ndarray) -> float:
        laplacian = np.abs(np.var(np.array(gray, dtype=np.float32)))
        return float(laplacian) / 1e6 if laplacian > 1e-6 else 0

    def classify_severity(self, pest_type: str, features: Dict, 
                          detection_confidence: float) -> SeverityResult:
        thresholds = self.severity_thresholds.get(
            pest_type, self.default_thresholds
        )
        
        affected_ratio = features.get('affected_ratio', 0)
        blob_count = features.get('blob_count', 0)
        
        severity = PestSeverity.NONE
        severity_level = 0
        
        sev_levels = [
            (PestSeverity.CRITICAL, 5),
            (PestSeverity.SEVERE, 4),
            (PestSeverity.HIGH, 3),
            (PestSeverity.MEDIUM, 2),
            (PestSeverity.LOW, 1),
        ]
        
        for sev, level in sev_levels:
            thresh_ratio, thresh_count = thresholds.get(sev, (0, 0))
            if affected_ratio >= thresh_ratio or blob_count >= thresh_count:
                severity = sev
                severity_level = level
                break
        
        pest_count_estimate = self._estimate_pest_count(
            affected_ratio, blob_count, pest_type)
        
        trend = self._analyze_trend(affected_ratio)
        
        recommendation_level = self._get_recommendation_level(severity)
        
        return SeverityResult(
            pest_type=pest_type,
            severity=severity,
            severity_level=severity_level,
            confidence=detection_confidence,
            affected_area_ratio=affected_ratio,
            pest_count_estimate=pest_count_estimate,
            trend=trend,
            recommendation_level=recommendation_level,
            timestamp=time.time(),
            detail={
                'blob_count': blob_count,
                'edge_density': features.get('edge_density', 0),
                'texture_complexity': features.get('texture_complexity', 0),
                'detection_confidence': detection_confidence,
            }
        )

    def _estimate_pest_count(self, affected_ratio: float, 
                             blob_count: int, pest_type: str) -> int:
        multipliers = {
            'aphid': 3.5,
            'whitefly': 2.0,
            'thrips': 1.5,
            'spider_mite': 5.0,
            'bollworm': 0.8,
        }
        multiplier = multipliers.get(pest_type, 2.0)
        base_count = int(blob_count * multiplier)
        return max(0, base_count)

    def _analyze_trend(self, current_ratio: float) -> str:
        if len(self.area_history) < 10:
            return 'insufficient_data'
        
        recent = list(self.area_history)[-5:]
        older = list(self.area_history)[:-5] if len(self.area_history) > 5 else []
        
        if not recent or not older:
            return 'stable'
        
        recent_avg = np.mean(recent)
        older_avg = np.mean(older)
        
        if recent_avg > older_avg * 1.3:
            return 'increasing_rapidly'
        elif recent_avg > older_avg * 1.1:
            return 'increasing'
        elif recent_avg < older_avg * 0.7:
            return 'decreasing_rapidly'
        elif recent_avg < older_avg * 0.9:
            return 'decreasing'
        else:
            return 'stable'

    def _get_recommendation_level(self, severity: PestSeverity) -> str:
        levels = {
            PestSeverity.NONE: 'monitor',
            PestSeverity.LOW: 'monitor_prevent',
            PestSeverity.MEDIUM: 'intervene',
            PestSeverity.HIGH: 'intervene_urgent',
            PestSeverity.SEVERE: 'emergency_treatment',
            PestSeverity.CRITICAL: 'immediate_emergency',
        }
        return levels.get(severity, 'monitor')

    def update_history(self, pest_type: str, affected_ratio: float, 
                       confidence: float):
        self.detection_history.append({
            'pest_type': pest_type,
            'affected_ratio': affected_ratio,
            'confidence': confidence,
            'timestamp': time.time(),
        })
        self.area_history.append(affected_ratio)

    def get_time_weighted_severity(self, pest_type: str, 
                               window_minutes: int = 30) -> Dict:
        cutoff = time.time() - window_minutes * 60
        relevant = [h for h in self.detection_history 
                    if h['pest_type'] == pest_type and h['timestamp'] > cutoff]
        
        if not relevant:
            return {'severity': PestSeverity.NONE, 'count': 0, 'avg_ratio': 0}
        
        now = time.time()
        weights = [1.0 / (1 + 0.01 * (now - h['timestamp'])) for h in relevant]
        total_weight = sum(weights)
        
        weighted_ratio = sum(h['affected_ratio'] * w for h, w in zip(relevant, weights)) / total_weight
        weighted_conf = sum(h['confidence'] * w for h, w in zip(relevant, weights)) / total_weight
        
        thresholds = self.severity_thresholds.get(pest_type, self.default_thresholds)
        
        severity = PestSeverity.NONE
        for sev, (thresh, _) in reversed(thresholds.items()):
            if weighted_ratio >= thresh:
                severity = sev
                break
        
        return {
            'severity': severity,
            'count': len(relevant),
            'avg_ratio': weighted_ratio,
            'avg_confidence': weighted_conf,
        }


class ControlRecommendationEngine:
    def __init__(self):
        self.control_database = self._init_control_database()

    def _init_control_database(self) -> Dict:
        return {
            'aphid': {
                PestSeverity.LOW: {
                    'immediate': [
                        '人工观察，记录发生区域',
                        '使用高压水枪冲洗叶片背面',
                        '释放瓢虫天敌（每平方米5-10只）',
                    ],
                    'prevention': [
                        '清除田间杂草',
                        '悬挂黄色粘虫板（每亩20-30片）',
                        '保持田间通风透光',
                    ],
                    'chemical': '无需化学防治',
                    'monitoring': '每3天观察一次',
                    'cost': '低',
                },
                PestSeverity.MEDIUM: {
                    'immediate': [
                        '释放食蚜蝇或蚜茧蜂',
                        '喷施矿物油或肥皂水（浓度1-2%）',
                        '剪除严重受害叶片',
                    ],
                    'prevention': [
                        '增加天敌释放量',
                        '清理受害植株周边区域隔离',
                        '增加粘虫板数量',
                    ],
                    'chemical': '必要时使用吡虫啉或啶虫脒，间隔7-10天一次',
                    'monitoring': '每2天观察一次，记录扩散情况',
                    'cost': '中',
                },
                PestSeverity.HIGH: {
                    'immediate': [
                        '立即喷施生物农药（苦参碱/印楝素）',
                        '大面积释放天敌',
                        '清除严重受害植株',
                    ],
                    'prevention': [
                        '全田喷施预防性药物',
                        '设立隔离带',
                        '通知周边农户协同防治',
                    ],
                    'chemical': '使用噻虫嗪或氟啶虫胺腈，注意轮换用药',
                    'monitoring': '每日观察，评估防治效果',
                    'cost': '高',
                },
                PestSeverity.SEVERE: {
                    'immediate': [
                        '紧急化学防治，使用高效低毒农药',
                        '全园喷施，重点喷施叶片背面',
                        '考虑更换种植结构调整',
                    ],
                    'prevention': [
                        '收获后清洁田园',
                        '土壤消毒处理',
                        '下季种植抗虫品种',
                    ],
                    'chemical': '使用噻虫胺或氟啶虫胺腈，5-7天一次，连续2-3次',
                    'monitoring': '每日早晚观察，记录虫口密度变化',
                    'cost': '很高',
                },
                PestSeverity.CRITICAL: {
                    'immediate': [
                        '立即全面喷施特效农药',
                        '考虑部分区域作物销毁',
                        '请专业植保人员现场指导',
                    ],
                    'prevention': [
                        '全田彻底清理',
                        '土壤深度翻耕暴晒',
                        '休耕一季或改种非寄主作物',
                    ],
                    'chemical': '使用最高效农药组合，严格遵守安全间隔期',
                    'monitoring': '持续监控直至完全控制',
                    'cost': '极高',
                },
            },
            'whitefly': {
                PestSeverity.LOW: {
                    'immediate': [
                        '增加黄色粘虫板数量',
                        '人工摘除带虫叶片',
                        '释放丽蚜小蜂',
                    ],
                    'prevention': [
                        '安装防虫网',
                        '控制田间湿度',
                        '避免氮肥过量',
                    ],
                    'chemical': '无需化学防治',
                    'monitoring': '每3天检查一次',
                    'cost': '低',
                },
                PestSeverity.MEDIUM: {
                    'immediate': [
                        '喷施矿物油乳剂',
                        '释放烟盲蝽天敌',
                        '清理下部老叶',
                    ],
                    'prevention': [
                        '加强通风降湿',
                        '周边杂草彻底清除',
                        '悬挂更多粘虫板',
                    ],
                    'chemical': '噻虫嗪或溴氰虫酰胺喷雾',
                    'monitoring': '每2天检查，重点叶背',
                    'cost': '中',
                },
                PestSeverity.HIGH: {
                    'immediate': [
                        '喷施烟碱类杀虫剂',
                        '配合使用杀虫灯诱杀成虫',
                        '摘除所有带虫叶片集中处理',
                    ],
                    'prevention': [
                        '全田喷施保护剂',
                        '设立物理与生物防治结合',
                        '协调周边统一防治',
                    ],
                    'chemical': '使用螺虫乙酯或氟啶虫胺腈，注意叶背重点喷施',
                    'monitoring': '每日检查虫口密度',
                    'cost': '高',
                },
                PestSeverity.SEVERE: {
                    'immediate': [
                        '紧急化学防治',
                        '使用熏蒸剂处理密闭空间',
                        '清理所有残株落叶',
                    ],
                    'prevention': [
                        '彻底清洁生产环境',
                        '更换栽培基质',
                        '器具消毒处理',
                    ],
                    'chemical': '使用噻虫胺+溴氰虫酰胺复配，5天一次',
                    'monitoring': '每日早晚巡查，评估防效',
                    'cost': '很高',
                },
                PestSeverity.CRITICAL: {
                    'immediate': [
                        '全面熏蒸处理+喷雾结合',
                        '考虑移除严重植株',
                        '专业植保介入',
                    ],
                    'prevention': [
                        '全场消毒',
                        '更换抗虫品种',
                        '调整种植计划',
                    ],
                    'chemical': '最高效药剂组合，严格安全间隔期',
                    'monitoring': '持续监控至完全控制',
                    'cost': '极高',
                },
            },
            'thrips': {
                PestSeverity.LOW: {
                    'immediate': [
                        '悬挂蓝色粘虫板',
                        '喷水冲洗叶片',
                        '释放捕食螨',
                    ],
                    'prevention': [
                        '清除杂草寄主',
                        '保持适度湿度',
                        '避免密植',
                    ],
                    'chemical': '无需化学防治',
                    'monitoring': '每3天检查花和嫩叶',
                    'cost': '低',
                },
                PestSeverity.MEDIUM: {
                    'immediate': [
                        '喷施苦参碱等生物农药',
                        '增加捕食螨释放量',
                        '摘除受害花和梢',
                    ],
                    'prevention': [
                        '田间设置诱集带',
                        '增加通风透光',
                        '控制氮肥用量',
                    ],
                    'chemical': '乙基多杀菌素或噻虫嗪喷雾',
                    'monitoring': '每2天检查花和新梢',
                    'cost': '中',
                },
                PestSeverity.HIGH: {
                    'immediate': [
                        '喷施乙基多杀菌素',
                        '配合色板+信息素诱杀',
                        '全园细致喷雾',
                    ],
                    'prevention': [
                        '清除所有杂草寄主',
                        '设置隔离措施',
                        '增加天敌释放频率',
                    ],
                    'chemical': '使用乙基多杀菌素或甲维盐，喷匀喷透',
                    'monitoring': '每日检查花和新梢',
                    'cost': '高',
                },
                PestSeverity.SEVERE: {
                    'immediate': [
                        '紧急喷雾+熏蒸结合',
                        '清除受害严重植株',
                        '全园彻底清理',
                    ],
                    'prevention': [
                        '土壤处理杀卵',
                        '清洁生产环境',
                        '工具设备消毒',
                    ],
                    'chemical': '甲维盐+噻虫嗪复配，5天一次，连喷2-3次',
                    'monitoring': '每日早晚巡查',
                    'cost': '很高',
                },
                PestSeverity.CRITICAL: {
                    'immediate': [
                        '彻底清除受害植株',
                        '专业植保方案',
                        '种植结构调整评估',
                    ],
                    'prevention': [
                        '全场彻底消毒',
                        '休耕措施',
                        '抗虫品种选择',
                    ],
                    'chemical': '最高效药剂轮换，严格安全间隔',
                    'monitoring': '持续监控',
                    'cost': '极高',
                },
            },
            'spider_mite': {
                PestSeverity.LOW: {
                    'immediate': [
                        '喷水增湿，抑制繁殖',
                        '释放捕食螨',
                        '摘除基部老叶',
                    ],
                    'prevention': [
                        '保持田间湿度',
                        '避免高温干旱预警',
                        '种植诱集植物',
                    ],
                    'chemical': '无需化学防治',
                    'monitoring': '每3天检查叶背',
                    'cost': '低',
                },
                PestSeverity.MEDIUM: {
                    'immediate': [
                        '喷施矿物油或苦参碱',
                        '增加捕食螨释放',
                        '清除严重受害叶片',
                    ],
                    'prevention': [
                        '田间喷水增湿',
                        '加强肥水管理',
                        '增强植株抗逆性',
                    ],
                    'chemical': '阿维菌素或螺螨酯喷雾',
                    'monitoring': '每2天检查叶背螨虫',
                    'cost': '中',
                },
                PestSeverity.HIGH: {
                    'immediate': [
                        '喷施阿维菌素或乙唑螨腈',
                        '叶背重点喷雾',
                        '清除严重植株',
                    ],
                    'prevention': [
                        '全园喷水降温增湿',
                        '加强肥水增强树势',
                        '保护利用天敌',
                    ],
                    'chemical': '乙唑螨腈或联苯肼酯，叶背重点喷施',
                    'monitoring': '每日检查叶背',
                    'cost': '高',
                },
                PestSeverity.SEVERE: {
                    'immediate': [
                        '紧急化学防治，杀螨剂轮换',
                        '清除所有受害枝叶',
                        '全园细致喷雾',
                    ],
                    'prevention': [
                        '彻底清园消毒',
                        '土壤处理杀越冬卵',
                        '种植结构调整评估',
                    ],
                    'chemical': '乙唑螨腈+联苯肼酯复配，5天一次，连喷2-3次',
                    'monitoring': '每日早晚巡查',
                    'cost': '很高',
                },
                PestSeverity.CRITICAL: {
                    'immediate': [
                        '彻底清除受害植株',
                        '专业植保指导',
                        '考虑更换作物',
                    ],
                    'prevention': [
                        '全场彻底清理',
                        '土壤消毒处理',
                        '抗螨品种选择',
                    ],
                    'chemical': '最高效杀螨剂组合，严格安全间隔',
                    'monitoring': '持续监控至完全控制',
                    'cost': '极高',
                },
            },
            'bollworm': {
                PestSeverity.LOW: {
                    'immediate': [
                        '黑光灯诱杀成虫',
                        '人工摘除卵块',
                        '释放赤眼蜂',
                    ],
                    'prevention': [
                        '深翻灭蛹',
                        '种植诱集作物',
                        '性诱剂诱杀',
                    ],
                    'chemical': '无需化学防治',
                    'monitoring': '每3天检查卵和幼虫',
                    'cost': '低',
                },
                PestSeverity.MEDIUM: {
                    'immediate': [
                        '喷施Bt制剂',
                        '增加赤眼蜂释放',
                        '人工捕捉幼虫',
                    ],
                    'prevention': [
                        '加强灯光诱杀',
                        '性诱剂监测',
                        '农事操作避高峰',
                    ],
                    'chemical': '氯虫苯甲酰胺或甲维盐喷雾',
                    'monitoring': '每2天检查卵和幼虫',
                    'cost': '中',
                },
                PestSeverity.HIGH: {
                    'immediate': [
                        '喷施氯虫苯甲酰胺',
                        '配合性诱剂大量诱杀',
                        '摘除受害果实',
                    ],
                    'prevention': [
                        '全园灯光诱杀',
                        '协调统防统治',
                        '加强预测预报',
                    ],
                    'chemical': '氯虫苯甲酰胺或四氯虫酰胺，均匀喷施',
                    'monitoring': '每日检查卵和幼虫',
                    'cost': '高',
                },
                PestSeverity.SEVERE: {
                    'immediate': [
                        '紧急化学防治',
                        '清除所有受害果荚',
                        '全园细致喷雾',
                    ],
                    'prevention': [
                        '彻底清园灭蛹',
                        '处理所有残体',
                        '土壤处理',
                    ],
                    'chemical': '甲维盐+氯虫苯甲酰胺复配，5天一次',
                    'monitoring': '每日早晚巡查',
                    'cost': '很高',
                },
                PestSeverity.CRITICAL: {
                    'immediate': [
                        '彻底清除受害植株',
                        '专业植保指导',
                        '考虑提前收获或改种',
                    ],
                    'prevention': [
                        '全场彻底清理',
                        '深耕翻土灭蛹',
                        '下季抗虫品种',
                    ],
                    'chemical': '最高效药剂组合，严格安全间隔期',
                    'monitoring': '持续监控至完全控制',
                    'cost': '极高',
                },
            },
            'healthy': {
                PestSeverity.NONE: {
                    'immediate': ['继续保持监测'],
                    'prevention': ['常规田间管理，定期巡查'],
                    'chemical': '无需用药',
                    'monitoring': '每周常规检查',
                    'cost': '无',
                },
            },
            'unknown': {
                PestSeverity.NONE: {
                    'immediate': ['请专家鉴定害虫种类'],
                    'prevention': ['采集标本，加强观察记录'],
                    'chemical': '暂不施药，先鉴定后决定',
                    'monitoring': '密切观察，尽快鉴定',
                    'cost': '待定',
                },
            },
        }

    def get_recommendation(self, severity_result: SeverityResult,
                          environmental_factors: Dict = None) -> ControlRecommendation:
        pest_type = severity_result.pest_type
        severity = severity_result.severity
        
        pest_data = self.control_database.get(pest_type, {})
        first_key = next(iter(pest_data.keys()), None)
        default_data = pest_data.get(first_key, {}) if first_key else {}
        severity_data = pest_data.get(severity, default_data)
        
        immediate_actions = severity_data.get('immediate', [])
        prevention_measures = severity_data.get('prevention', [])
        chemical_treatment = severity_data.get('chemical', '')
        monitoring_advice = severity_data.get('monitoring', '')
        estimated_cost = severity_data.get('cost', '未知')
        
        if environmental_factors:
            immediate_actions = self._adjust_for_environment(
                immediate_actions, environmental_factors)
            prevention_measures = self._adjust_for_environment(
                prevention_measures, environmental_factors)
        
        priority = self._calculate_priority(severity, environmental_factors)
        
        return ControlRecommendation(
            pest_type=pest_type,
            severity=severity,
            immediate_actions=immediate_actions,
            prevention_measures=prevention_measures,
            chemical_treatment=chemical_treatment,
            monitoring_advice=monitoring_advice,
            estimated_cost=estimated_cost,
            priority=priority,
        )

    def _adjust_for_environment(self, actions: List[str], 
                              env: Dict) -> List[str]:
        adjusted = actions.copy()
        
        if env.get('temperature', 25) > 30:
            adjusted.append('注意：高温天气建议早晚施药，避免药害')
        if env.get('humidity', 60) > 80:
            adjusted.append('注意：高湿天气注意病害并发风险')
        if env.get('rain_expected', False):
            adjusted.append('注意：预计降雨，建议雨前施药或雨后补喷')
        if env.get('wind_speed', 0) > 3:
            adjusted.append('注意：大风天气避免喷雾，防止漂移')
        
        return adjusted

    def _calculate_priority(self, severity: PestSeverity,
                            env: Dict) -> int:
        base_priority = {
            PestSeverity.NONE: 0,
            PestSeverity.LOW: 1,
            PestSeverity.MEDIUM: 3,
            PestSeverity.HIGH: 5,
            PestSeverity.SEVERE: 8,
            PestSeverity.CRITICAL: 10,
        }.get(severity, 0)
        
        if env:
            if env.get('temperature', 25) > 30:
                base_priority += 1
            if env.get('humidity', 60) > 70:
                base_priority += 1
            if env.get('crop_stage') == 'flowering':
                base_priority += 2
        
        return min(10, base_priority)

    def get_batch_recommendations(self, severity_results: List[SeverityResult],
                                  env_factors: Dict = None) -> List[ControlRecommendation]:
        return [self.get_recommendation(sr, env_factors) for sr in severity_results]

    def get_summary_report(self, recommendations: List[ControlRecommendation]) -> Dict:
        if not recommendations:
            return {'total': 0, 'summary': '无病虫害发现'}
        
        by_severity = {}
        total_priority = 0
        all_actions = []
        
        for rec in recommendations:
            sev_name = rec.severity.value
            if sev_name not in by_severity:
                by_severity[sev_name] = []
            by_severity[sev_name].append(rec.pest_type)
            total_priority += rec.priority
            all_actions.extend(rec.immediate_actions)
        
        highest_priority = max(rec.priority for rec in recommendations)
        
        return {
            'total_pests': len(recommendations),
            'by_severity': by_severity,
            'average_priority': total_priority / len(recommendations),
            'highest_priority': highest_priority,
            'recommended_actions': all_actions[:10],
            'urgent': any(r.severity in [PestSeverity.HIGH, PestSeverity.SEVERE, PestSeverity.CRITICAL] for r in recommendations),
        }
