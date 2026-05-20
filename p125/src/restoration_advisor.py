import numpy as np
from typing import Dict, List, Optional, Tuple
from enum import Enum
from dataclasses import dataclass, field


class UrgencyLevel(Enum):
    IMMEDIATE = "immediate"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    ROUTINE = "routine"


class TreatmentType(Enum):
    CLEANING = "cleaning"
    DEACIDIFICATION = "deacidification"
    REPAIR = "repair"
    CONSOLIDATION = "consolidation"
    LINING = "lining"
    MOUNTING = "mounting"
    ENCAPSULATION = "encapsulation"
    STORAGE_IMPROVEMENT = "storage_improvement"
    DIGITIZATION = "digitization"
    MONITORING = "monitoring"


class ProfessionalLevel(Enum):
    BASIC = "basic"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


@dataclass
class TreatmentStep:
    order: int
    treatment_type: str
    description: str
    urgency: str
    difficulty: str
    materials: List[str] = field(default_factory=list)
    estimated_time: str = ""
    cost_estimate: str = ""
    warnings: List[str] = field(default_factory=list)


@dataclass
class PriorityIssue:
    issue_type: str
    severity: str
    location: str
    impact: str
    recommended_action: str


class RestorationAdvisor:
    def __init__(self):
        self.treatment_database = {
            'surface_cleaning': {
                'methods': {
                    'dry_brush': {
                        'description': '使用软毛刷进行表面除尘',
                        'materials': ['软毛刷', '真空吸尘器', '过滤网'],
                        'difficulty': 'basic',
                        'time': '15-30分钟',
                        'cost': '低',
                        'applicability': ['灰尘', '表面污渍', '轻度污染物']
                    },
                    'chemical_sponge': {
                        'description': '使用化学海绵进行表面清洁',
                        'materials': ['化学海绵', '清洁溶剂', '防护手套'],
                        'difficulty': 'intermediate',
                        'time': '30-60分钟',
                        'cost': '中',
                        'applicability': ['油性污渍', '烟熏痕迹', '顽固灰尘']
                    },
                    'solvent_cleaning': {
                        'description': '使用溶剂进行局部清洁',
                        'materials': ['有机溶剂', '棉签', '吸水纸', '通风设备'],
                        'difficulty': 'advanced',
                        'time': '1-2小时',
                        'cost': '高',
                        'applicability': ['墨水污渍', '油渍', '重度污染物']
                    }
                }
            },
            'deacidification': {
                'methods': {
                    'non_aqueous': {
                        'description': '非水溶液脱酸处理',
                        'materials': ['氢氧化钙溶液', '喷雾器', '防护设备'],
                        'difficulty': 'advanced',
                        'time': '2-4小时',
                        'cost': '高',
                        'applicability': ['酸性纸张', 'pH<5.5', '易碎纸张']
                    },
                    'paper_splitting': {
                        'description': '纸张夹层脱酸法',
                        'materials': ['脱酸剂', '衬纸', '压平机'],
                        'difficulty': 'expert',
                        'time': '4-8小时',
                        'cost': '高',
                        'applicability': ['严重酸化', '高价值文档', '古籍']
                    },
                    'mass_deacidification': {
                        'description': '批量气相脱酸处理',
                        'materials': ['专业设备', '吗啉衍生物', '密闭空间'],
                        'difficulty': 'expert',
                        'time': '专业处理',
                        'cost': '很高',
                        'applicability': ['批量处理', '中度酸化', '馆藏文档']
                    }
                }
            },
            'repair': {
                'methods': {
                    'japanese_paper_repair': {
                        'description': '日式纸张修复法',
                        'materials': ['和纸', '小麦淀粉糊', '修复笔', '吸水纸'],
                        'difficulty': 'advanced',
                        'time': '1-4小时',
                        'cost': '中高',
                        'applicability': ['撕裂', '缺口', '边缘破损', '孔洞']
                    },
                    'tissue_patch': {
                        'description': '薄纱补片修复',
                        'materials': ['修复薄纱', '专用粘合剂', '压平工具'],
                        'difficulty': 'intermediate',
                        'time': '30-60分钟',
                        'cost': '中',
                        'applicability': ['小孔', '局部破损', '纤维缺失']
                    },
                    'edge_repair': {
                        'description': '边缘加固修复',
                        'materials': ['加固条', '粘合剂', '裁纸刀', '直尺'],
                        'difficulty': 'intermediate',
                        'time': '30-90分钟',
                        'cost': '中',
                        'applicability': ['边缘磨损', '折痕破损', '缺角']
                    }
                }
            },
            'consolidation': {
                'methods': {
                    'lining': {
                        'description': '纸张背衬加固',
                        'materials': ['加固衬纸', '淀粉糊', '压平机', '干化板'],
                        'difficulty': 'advanced',
                        'time': '2-4小时',
                        'cost': '高',
                        'applicability': ['严重脆弱', '纤维松散', '大面积破损']
                    },
                    'splitting': {
                        'description': '纸张分层加固',
                        'materials': ['分层工具', '加固纤维', '专用粘合剂'],
                        'difficulty': 'expert',
                        'time': '4-8小时',
                        'cost': '很高',
                        'applicability': ['极度脆弱', '多层纸张', '珍贵文献']
                    }
                }
            },
            'storage': {
                'methods': {
                    'acid_free_enclosure': {
                        'description': '无酸封套存储',
                        'materials': ['无酸文件夹', '缓冲纸', '档案盒'],
                        'difficulty': 'basic',
                        'time': '5-15分钟',
                        'cost': '低',
                        'applicability': ['常规保护', '长期存储', '所有文档']
                    },
                    'encapsulation': {
                        'description': '聚酯薄膜封装',
                        'materials': ['聚酯薄膜', '热封机', '裁刀'],
                        'difficulty': 'intermediate',
                        'time': '20-40分钟',
                        'cost': '中',
                        'applicability': ['高流量使用', '展示需求', '中度保护']
                    },
                    'phase_box': {
                        'description': '定制档案盒存储',
                        'materials': ['定制档案盒', '缓冲材料', '支撑卡'],
                        'difficulty': 'basic',
                        'time': '10-30分钟',
                        'cost': '中',
                        'applicability': ['珍贵文献', '特殊尺寸', '馆藏级存储']
                    }
                }
            }
        }

        self.environmental_guidelines = {
            'temperature': {
                'ideal': '18-20°C',
                'max_variation': '±2°C/24小时',
                'warning': '避免极端温度变化'
            },
            'humidity': {
                'ideal': '45-50% RH',
                'max_variation': '±5% RH/24小时',
                'warning': '避免高湿度防止霉菌生长'
            },
            'lighting': {
                'max_exposure': '50-100 lux',
                'uv_filter': '要求',
                'warning': '避免阳光直射和荧光灯'
            },
            'pollution': {
                'filtration': 'HEPA过滤推荐',
                'air_exchange': '2-4次/小时',
                'warning': '避免厨房、浴室附近存储'
            }
        }

    def generate_restoration_plan(self,
                                   wear_analysis: Dict,
                                   strength_analysis: Dict,
                                   stain_analysis: Optional[Dict] = None,
                                   document_value: str = "medium",
                                   environmental_data: Optional[Dict] = None) -> Dict:
        priority_issues = self._identify_priority_issues(
            wear_analysis, strength_analysis, stain_analysis
        )
        
        treatment_steps = self._generate_treatment_steps(
            priority_issues, strength_analysis, document_value
        )
        
        preservation_recommendations = self._generate_preservation_recommendations(
            strength_analysis, environmental_data
        )
        
        environmental_improvements = self._assess_environmental_needs(
            strength_analysis, environmental_data
        )
        
        urgency_assessment = self._assess_overall_urgency(
            priority_issues, strength_analysis
        )
        
        cost_estimate = self._estimate_total_cost(treatment_steps)
        
        timeline = self._generate_timeline(treatment_steps, urgency_assessment)
        
        risk_assessment = self._assess_restoration_risks(treatment_steps, strength_analysis)
        
        professional_level = self._determine_professional_level(treatment_steps)
        
        monitoring_plan = self._generate_monitoring_plan(strength_analysis)
        
        return {
            'overall_urgency': urgency_assessment,
            'required_professional_level': professional_level.value,
            'priority_issues': [pi.__dict__ for pi in priority_issues],
            'treatment_steps': [ts.__dict__ for ts in treatment_steps],
            'preservation_recommendations': preservation_recommendations,
            'environmental_improvements': environmental_improvements,
            'cost_estimate': cost_estimate,
            'estimated_timeline': timeline,
            'risk_assessment': risk_assessment,
            'monitoring_plan': monitoring_plan,
            'digitization_recommendation': self._should_digitize(strength_analysis, document_value),
            'summary': self._generate_summary(urgency_assessment, priority_issues, professional_level)
        }

    def _identify_priority_issues(self, wear_analysis: Dict,
                                   strength_analysis: Dict,
                                   stain_analysis: Optional[Dict]) -> List[PriorityIssue]:
        issues = []
        
        strength_score = strength_analysis.get('overall_strength_score', 50)
        condition = strength_analysis.get('condition', 'fair')
        metrics = strength_analysis.get('strength_metrics', {})
        critical_points = strength_analysis.get('critical_weak_points', [])
        
        if strength_score < 30 or condition == 'critical':
            issues.append(PriorityIssue(
                issue_type='structural_instability',
                severity='critical',
                location='entire_document',
                impact='纸张结构严重脆弱，处理风险极高',
                recommended_action='立即进行专业加固处理，避免任何进一步操作'
            ))
        elif strength_score < 50 or condition == 'poor':
            issues.append(PriorityIssue(
                issue_type='reduced_strength',
                severity='high',
                location='fiber_structure',
                impact='纤维强度下降，需要小心处理',
                recommended_action='考虑加固处理，改进存储条件'
            ))
        
        if isinstance(metrics, dict) and metrics.get('ph_level', 7.0) < 5.0:
            severity = 'critical' if metrics.get('ph_level') < 4.5 else 'high'
            issues.append(PriorityIssue(
                issue_type='acidic_deterioration',
                severity=severity,
                location='fiber_matrix',
                impact=f'pH值{metrics.get("ph_level"):.1f}，酸性降解正在进行',
                recommended_action='尽快进行脱酸处理，阻止进一步酸化'
            ))
        
        if isinstance(metrics, dict) and metrics.get('brittleness_index', 0) > 70:
            issues.append(PriorityIssue(
                issue_type='extreme_brittleness',
                severity='critical',
                location='entire_surface',
                impact=f'脆性指数{metrics.get("brittleness_index"):.1f}，极易碎裂',
                recommended_action='立即封装，禁止任何物理处理直到加固完成'
            ))
        
        wear_ratio = wear_analysis.get('wear_ratio', 0)
        if wear_ratio > 0.3:
            issues.append(PriorityIssue(
                issue_type='severe_wear',
                severity='high',
                location='surface_and_edges',
                impact=f'磨损面积占比{wear_ratio*100:.1f}%，严重影响结构完整性',
                recommended_action='评估主要磨损区域，进行针对性修复'
            ))
        elif wear_ratio > 0.15:
            issues.append(PriorityIssue(
                issue_type='moderate_wear',
                severity='medium',
                location='high_contact_areas',
                impact=f'磨损面积占比{wear_ratio*100:.1f}%，需要处理',
                recommended_action='修复主要磨损点，改进处理方式'
            ))
        
        damage = strength_analysis.get('damage_analysis', {})
        if isinstance(damage, dict) and damage.get('tear_density', 0) > 0.1:
            issues.append(PriorityIssue(
                issue_type='tears_and_holes',
                severity='high',
                location='edge_regions',
                impact=f'撕裂密度较高，需要修补',
                recommended_action='使用日式纸张修复法进行裂缝修补'
            ))
        
        if stain_analysis:
            stain_severity = stain_analysis.get('overall_severity', 'low')
            if stain_severity == 'critical':
                issues.append(PriorityIssue(
                    issue_type='active_stains',
                    severity='critical',
                    location='stained_areas',
                    impact='污渍正在扩散，可能造成永久损伤',
                    recommended_action='立即进行污渍稳定处理，评估扩散风险'
                ))
            elif stain_severity == 'high':
                issues.append(PriorityIssue(
                    issue_type='significant_staining',
                    severity='high',
                    location='affected_regions',
                    impact='污渍程度较高，可能影响可读性和强度',
                    recommended_action='考虑专业清洁处理'
                ))
        
        return sorted(issues, key=lambda x: ['critical', 'high', 'medium', 'low'].index(x.severity))

    def _generate_treatment_steps(self, issues: List[PriorityIssue],
                                   strength_analysis: Dict,
                                   document_value: str) -> List[TreatmentStep]:
        steps = []
        order = 1
        
        strength_score = strength_analysis.get('overall_strength_score', 50)
        condition = strength_analysis.get('condition', 'fair')
        metrics = strength_analysis.get('strength_metrics', {})
        
        critical = any(i.severity == 'critical' for i in issues)
        if critical or strength_score < 40:
            steps.append(TreatmentStep(
                order=order,
                treatment_type='stabilization',
                description='初步稳定化处理 - 在任何其他操作前先稳定脆弱纸张',
                urgency='immediate',
                difficulty='advanced',
                materials=['支持衬纸', '无酸固定夹', '湿度调节盒', '软毛刷'],
                estimated_time='30-60分钟',
                cost_estimate='中',
                warnings=['必须使用无酸材料', '全程使用支持衬纸', '避免任何弯曲或拉伸']
            ))
            order += 1
        
        cleaning_needed = any('stain' in i.issue_type or 'wear' in i.issue_type for i in issues)
        if cleaning_needed or strength_score < 70:
            if strength_score < 40:
                steps.append(TreatmentStep(
                    order=order,
                    treatment_type='gentle_cleaning',
                    description='温和表面清洁 - 仅使用软毛刷和真空，避免任何湿度',
                    urgency='high',
                    difficulty='intermediate',
                    materials=['软毛刷', '带过滤网的真空吸尘器', '支持衬纸'],
                    estimated_time='15-30分钟',
                    cost_estimate='低',
                    warnings=['极度小心，避免摩擦', '不要直接接触脆弱区域', '使用最低吸力']
                ))
            else:
                steps.append(TreatmentStep(
                    order=order,
                    treatment_type='surface_cleaning',
                    description='标准表面清洁 - 使用干刷和化学海绵方法',
                    urgency='medium',
                    difficulty='basic',
                    materials=['软毛刷', '化学海绵', '真空吸尘器', '防护手套'],
                    estimated_time='30-45分钟',
                    cost_estimate='低',
                    warnings=['测试清洁方法在边角', '避免过度擦拭']
                ))
            order += 1
        
        if isinstance(metrics, dict) and metrics.get('ph_level', 7.0) < 5.5:
            ph = metrics.get('ph_level', 7.0)
            method = 'paper_splitting' if ph < 4.8 and document_value == 'high' else 'non_aqueous'
            method_info = self.treatment_database['deacidification']['methods'][method]
            
            steps.append(TreatmentStep(
                order=order,
                treatment_type='deacidification',
                description=f'脱酸处理 - {method_info["description"]}',
                urgency='high' if ph < 5.0 else 'medium',
                difficulty=method_info['difficulty'],
                materials=method_info['materials'],
                estimated_time=method_info['time'],
                cost_estimate=method_info['cost'],
                warnings=['处理前后测试pH值', '确保完全干燥后存储', '考虑批量处理效率']
            ))
            order += 1
        
        tears_needed = any('tear' in i.issue_type or 'hole' in i.issue_type for i in issues)
        if tears_needed or strength_score < 60:
            if strength_score < 40:
                steps.append(TreatmentStep(
                    order=order,
                    treatment_type='consolidation_lining',
                    description='全面背衬加固 - 为极度脆弱纸张提供完整支持',
                    urgency='high',
                    difficulty='expert',
                    materials=['日本和纸', '小麦淀粉糊', '压平机', '干化板'],
                    estimated_time='4-8小时',
                    cost_estimate='高',
                    warnings=['这是不可逆处理', '影响纸张原始外观', '需要专业判断']
                ))
            else:
                steps.append(TreatmentStep(
                    order=order,
                    treatment_type='targeted_repair',
                    description='针对性修复 - 修复撕裂、孔洞和边缘破损',
                    urgency='medium',
                    difficulty='advanced',
                    materials=['和纸条', '小麦淀粉糊', '修复笔', '吸水纸', '压重物'],
                    estimated_time='2-4小时',
                    cost_estimate='中高',
                    warnings=['使用匹配颜色的修复材料', '注意纤维方向', '确保完全干燥']
                ))
            order += 1
        
        if document_value in ['high', 'very_high'] or strength_score < 50:
            steps.append(TreatmentStep(
                order=order,
                treatment_type='professional_encapsulation',
                description='专业封装 - 使用聚酯薄膜或无酸封套',
                urgency='medium' if strength_score < 50 else 'low',
                difficulty='intermediate',
                materials=['无酸封套或聚酯薄膜', '热封机', '缓冲纸', '档案级存储盒'],
                estimated_time='30-60分钟',
                cost_estimate='中',
                warnings=['确保封装前完全干燥', '使用档案级材料', '预留适当空间']
            ))
            order += 1
        
        storage_method = 'phase_box' if document_value == 'very_high' else 'acid_free_enclosure'
        storage_info = self.treatment_database['storage']['methods'][storage_method]
        steps.append(TreatmentStep(
            order=order,
            treatment_type='proper_storage',
            description=f'正确存储方案 - {storage_info["description"]}',
            urgency='medium',
            difficulty=storage_info['difficulty'],
            materials=storage_info['materials'],
            estimated_time=storage_info['time'],
            cost_estimate=storage_info['cost'],
            warnings=['立即改善存储条件', '监控温湿度', '定期检查']
        ))
        
        return steps

    def _generate_preservation_recommendations(self, strength_analysis: Dict,
                                                environmental_data: Optional[Dict]) -> List[Dict]:
        recommendations = []
        strength_score = strength_analysis.get('overall_strength_score', 50)
        metrics = strength_analysis.get('strength_metrics', {})
        
        if strength_score < 50:
            recommendations.append({
                'category': 'handling',
                'priority': 'high',
                'recommendation': '限制物理处理，仅在必要时操作',
                'details': '每次处理必须使用支持衬纸，避免折叠或弯曲',
                'implementation': '立即'
            })
        
        if isinstance(metrics, dict) and metrics.get('brittleness_index', 0) > 60:
            recommendations.append({
                'category': 'display',
                'priority': 'high',
                'recommendation': '限制展示使用',
                'details': '高脆性纸张不应展示超过3个月/年，考虑使用复制品展示',
                'implementation': '立即'
            })
        
        if isinstance(metrics, dict) and metrics.get('ph_level', 7.0) < 5.5:
            recommendations.append({
                'category': 'chemical',
                'priority': 'high',
                'recommendation': 'pH值监测计划',
                'details': '每6个月测试一次pH值，监测酸化进展',
                'implementation': '启动'
            })
        
        recommendations.append({
            'category': 'environmental',
            'priority': 'medium',
            'recommendation': '维持标准档案环境',
            'details': '温度18-20°C，相对湿度45-50%，严格控制波动',
            'implementation': '持续'
        })
        
        recommendations.append({
            'category': 'inspection',
            'priority': 'medium',
            'recommendation': '定期检查计划',
            'details': f'每{6 if strength_score < 50 else 12}个月进行一次状态评估',
            'implementation': '持续'
        })
        
        if strength_score < 40:
            recommendations.append({
                'category': 'access',
                'priority': 'high',
                'recommendation': '限制访问政策',
                'details': '仅授权人员可接触，所有使用需要监督和特殊处理',
                'implementation': '立即'
            })
        
        return sorted(recommendations, key=lambda x: ['high', 'medium', 'low'].index(x['priority']))

    def _assess_environmental_needs(self, strength_analysis: Dict,
                                     environmental_data: Optional[Dict]) -> Dict:
        needs = {
            'immediate_actions': [],
            'improvements': [],
            'monitoring_requirements': [],
            'target_conditions': self.environmental_guidelines.copy()
        }
        
        strength_score = strength_analysis.get('overall_strength_score', 50)
        condition = strength_analysis.get('condition', 'fair')
        
        if condition in ['critical', 'poor'] or strength_score < 50:
            needs['immediate_actions'].extend([
                '使用温湿度数据记录器进行7x24小时监控',
                '立即检查当前存储位置的适宜性',
                '确保存储区域没有直接光照',
                '检查是否有水源或湿气来源风险'
            ])
        
        if environmental_data:
            current_temp = environmental_data.get('temperature', 22)
            current_rh = environmental_data.get('humidity', 55)
            
            if current_temp > 23 or current_temp < 15:
                needs['immediate_actions'].append(f'当前温度{current_temp}°C偏离理想范围，需要调整')
            
            if current_rh > 60 or current_rh < 40:
                needs['immediate_actions'].append(f'当前湿度{current_rh}%偏离理想范围，需要立即调节')
        
        needs['improvements'].extend([
            '安装UV过滤照明设备',
            '使用HEPA空气过滤系统',
            '确保适当的空气流通（2-4次/小时）',
            '使用档案级存储家具和材料',
            '避免存储在地下室、阁楼或靠近厨房/浴室'
        ])
        
        needs['monitoring_requirements'].extend([
            '每日记录温度和相对湿度',
            '每月检查霉菌或虫害迹象',
            '每季度检查材料稳定性',
            '每年进行专业环境审计'
        ])
        
        return needs

    def _assess_overall_urgency(self, issues: List[PriorityIssue],
                                 strength_analysis: Dict) -> str:
        critical_count = sum(1 for i in issues if i.severity == 'critical')
        high_count = sum(1 for i in issues if i.severity == 'high')
        strength_score = strength_analysis.get('overall_strength_score', 50)
        
        if critical_count > 0 or strength_score < 30:
            return UrgencyLevel.IMMEDIATE.value
        elif high_count > 1 or strength_score < 50:
            return UrgencyLevel.HIGH.value
        elif len(issues) > 2 or strength_score < 70:
            return UrgencyLevel.MEDIUM.value
        else:
            return UrgencyLevel.LOW.value

    def _estimate_total_cost(self, treatment_steps: List[TreatmentStep]) -> Dict:
        cost_mapping = {
            '低': (20, 50),
            '中': (50, 150),
            '中高': (150, 300),
            '高': (300, 600),
            '很高': (600, 1500)
        }
        
        min_total = 0
        max_total = 0
        breakdown = []
        
        for step in treatment_steps:
            cost_range = cost_mapping.get(step.cost_estimate, (50, 150))
            min_total += cost_range[0]
            max_total += cost_range[1]
            breakdown.append({
                'treatment': step.treatment_type,
                'min_cost': cost_range[0],
                'max_cost': cost_range[1]
            })
        
        return {
            'estimated_min_total': min_total,
            'estimated_max_total': max_total,
            'currency': 'USD (approximate)',
            'notes': '成本为估算值，实际费用因地区和专业人员而变化',
            'breakdown': breakdown
        }

    def _generate_timeline(self, treatment_steps: List[TreatmentStep],
                           urgency: str) -> Dict:
        urgency_timeframes = {
            'immediate': {'critical': '0-3天', 'high': '1-2周'},
            'high': {'critical': '1周内', 'high': '2-4周'},
            'medium': {'critical': '2-4周', 'high': '1-2月'},
            'low': {'critical': '1月内', 'high': '2-3月'}
        }
        
        timeframes = urgency_timeframes.get(urgency, urgency_timeframes['medium'])
        
        phases = {
            'assessment_phase': '1-2天',
            'stabilization_phase': timeframes.get('critical', '1周内'),
            'treatment_phase': timeframes.get('high', '2-4周'),
            'post_treatment_care': '2-4周',
            'ongoing_monitoring': '持续'
        }
        
        total_duration = f'约{len(treatment_steps) * 2 - 4}周完成所有处理'
        
        return {
            'overall_urgency': urgency,
            'phases': phases,
            'total_duration_estimate': total_duration,
            'notes': '时间线受材料可用性、专业人员安排和文档尺寸影响'
        }

    def _assess_restoration_risks(self, treatment_steps: List[TreatmentStep],
                                   strength_analysis: Dict) -> Dict:
        strength_score = strength_analysis.get('overall_strength_score', 50)
        metrics = strength_analysis.get('strength_metrics', {})
        
        risks = {
            'overall_risk_level': 'medium',
            'specific_risks': [],
            'mitigation_strategies': []
        }
        
        if strength_score < 30:
            risks['overall_risk_level'] = 'very_high'
            risks['specific_risks'].append({
                'risk': '处理过程中物理损坏',
                'probability': 'high',
                'impact': 'severe'
            })
            risks['mitigation_strategies'].append(
                '所有步骤由资深纸质文物保护专家执行，全程使用支持衬纸'
            )
        elif strength_score < 50:
            risks['overall_risk_level'] = 'high'
            risks['specific_risks'].append({
                'risk': '修复期间可能发生二次损伤',
                'probability': 'medium',
                'impact': 'significant'
            })
            risks['mitigation_strategies'].append(
                '由经验丰富的修复人员操作，使用最小干预原则'
            )
        
        if isinstance(metrics, dict) and metrics.get('brittleness_index', 0) > 70:
            risks['specific_risks'].append({
                'risk': '高脆性导致碎裂风险',
                'probability': 'high',
                'impact': 'severe'
            })
            risks['mitigation_strategies'].append(
                '避免任何弯曲，使用刚性支持，考虑先做加固再清洁'
            )
        
        treatment_risks = any('deacidification' in s.treatment_type for s in treatment_steps)
        if treatment_risks:
            risks['specific_risks'].append({
                'risk': '化学处理导致的颜色或墨水变化',
                'probability': 'medium',
                'impact': 'moderate'
            })
            risks['mitigation_strategies'].append(
                '处理前后进行拍照记录，隐蔽区域先做兼容性测试'
            )
        
        risks['specific_risks'].append({
            'risk': '修复材料的长期兼容性',
            'probability': 'low',
            'impact': 'long_term'
        })
        risks['mitigation_strategies'].append(
            '仅使用经过档案测试的材料，记录所有处理材料'
        )
        
        return risks

    def _determine_professional_level(self, treatment_steps: List[TreatmentStep]) -> ProfessionalLevel:
        max_difficulty = 'basic'
        for step in treatment_steps:
            difficulty_order = ['basic', 'intermediate', 'advanced', 'expert']
            if difficulty_order.index(step.difficulty) > difficulty_order.index(max_difficulty):
                max_difficulty = step.difficulty
        
        level_mapping = {
            'basic': ProfessionalLevel.BASIC,
            'intermediate': ProfessionalLevel.INTERMEDIATE,
            'advanced': ProfessionalLevel.ADVANCED,
            'expert': ProfessionalLevel.EXPERT
        }
        
        return level_mapping[max_difficulty]

    def _should_digitize(self, strength_analysis: Dict, document_value: str) -> Dict:
        strength_score = strength_analysis.get('overall_strength_score', 50)
        remaining_life = strength_analysis.get('remaining_life_estimate', {})
        
        if isinstance(remaining_life, dict):
            years_remaining = remaining_life.get('estimated_years_remaining', 50)
        else:
            years_remaining = 50
        
        priority = 'routine'
        if strength_score < 40 or years_remaining < 20:
            priority = 'immediate'
        elif strength_score < 60 or years_remaining < 50:
            priority = 'high_priority'
        elif document_value in ['high', 'very_high']:
            priority = 'recommended'
        
        return {
            'recommended': priority in ['immediate', 'high_priority', 'recommended'],
            'priority': priority,
            'justification': [
                f'强度评分: {strength_score:.1f}/100',
                f'估计剩余寿命: {years_remaining:.1f}年',
                f'文档价值等级: {document_value}'
            ],
            'recommendation': '制作高分辨率数码副本，减少对原件的物理访问' if priority != 'routine' else '数字化作为长期保存策略'
        }

    def _generate_summary(self, urgency: str, issues: List[PriorityIssue],
                          level: ProfessionalLevel) -> str:
        issue_count = len(issues)
        critical_count = sum(1 for i in issues if i.severity == 'critical')
        high_count = sum(1 for i in issues if i.severity == 'high')
        
        summary_parts = []
        
        urgency_desc = {
            'immediate': '需要立即关注',
            'high': '需要高度关注',
            'medium': '需要中度关注',
            'low': '常规保存即可'
        }
        summary_parts.append(f"修复紧迫性: {urgency_desc.get(urgency, '未知')}")
        
        if issue_count > 0:
            summary_parts.append(f"识别出{issue_count}个优先处理问题")
            if critical_count > 0:
                summary_parts.append(f"包含{critical_count}个严重问题")
            if high_count > 0:
                summary_parts.append(f"包含{high_count}个高度问题")
        
        level_desc = {
            'basic': '基础级修复，可由经过培训的人员执行',
            'intermediate': '中级修复，需要有经验的修复人员',
            'advanced': '高级修复，需要专业纸质文物保护人员',
            'expert': '专家级修复，需要资深纸质文物保护专家'
        }
        summary_parts.append(f"要求专业水平: {level_desc.get(level.value, '未知')}")
        
        return ' | '.join(summary_parts)

    def _generate_monitoring_plan(self, strength_analysis: Dict) -> Dict:
        strength_score = strength_analysis.get('overall_strength_score', 50)
        condition = strength_analysis.get('condition', 'fair')
        
        if strength_score < 30 or condition == 'critical':
            frequency = 'monthly'
            inspections = ['visual_check', 'photographic_record', 'humidity_temp_check']
        elif strength_score < 50 or condition == 'poor':
            frequency = 'quarterly'
            inspections = ['visual_check', 'photographic_record', 'edge_inspection']
        elif strength_score < 70 or condition == 'fair':
            frequency = 'semi_annual'
            inspections = ['visual_check', 'condition_assessment']
        else:
            frequency = 'annual'
            inspections = ['general_condition', 'storage_check']
        
        return {
            'monitoring_frequency': frequency,
            'recommended_inspections': inspections,
            'schedule': {
                'immediate': '基准评估 - 详细照片记录和测量',
                'ongoing': f'{frequency}检查',
                'comprehensive_review': '每1-3年进行专业评估'
            },
            'key_indicators_to_monitor': [
                '边缘完整性变化',
                '表面脆弱性增加',
                'pH值变化趋势',
                '污渍或霉菌发展迹象',
                '存储环境条件稳定性'
            ]
        }


__all__ = ['RestorationAdvisor', 'UrgencyLevel', 'TreatmentType', 'ProfessionalLevel', 'TreatmentStep', 'PriorityIssue']
