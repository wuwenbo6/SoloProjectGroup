import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class RepairMethod(Enum):
    """维修方法枚举"""
    PATCHING = "修补"
    RESURFACING = "重铺面层"
    REPLACEMENT = "更换"
    INJECTION = "注浆"
    COATING = "涂层防护"
    STRENGTHENING = "结构加固"
    WELDING = "焊接"
    BONDING = "粘结"


class RepairMaterialType(Enum):
    """维修材料类型"""
    CONCRETE = "混凝土"
    EPOXY = "环氧树脂"
    CEMENT_MORTAR = "水泥砂浆"
    POLYMER = "聚合物砂浆"
    STEEL = "钢材"
    FIBERGLASS = "玻璃纤维"
    CARBON_FIBER = "碳纤维"
    SEALANT = "密封胶"


@dataclass
class RepairMaterial:
    """维修材料数据类"""
    material_type: RepairMaterialType
    quantity: float
    unit: str
    unit_cost: float
    total_cost: float
    
    def __post_init__(self):
        if self.total_cost == 0 and self.unit_cost > 0:
            self.total_cost = self.quantity * self.unit_cost


@dataclass
class RepairTask:
    """维修任务数据类"""
    task_id: int
    description: str
    repair_method: RepairMethod
    location: np.ndarray
    area: float
    depth: float
    volume: float
    materials: List[RepairMaterial]
    labor_hours: float
    labor_cost: float
    priority: str
    difficulty: str


@dataclass
class RepairEstimate:
    """维修估算结果"""
    total_materials_cost: float
    total_labor_cost: float
    total_cost: float
    total_labor_hours: float
    tasks: List[RepairTask]
    material_summary: Dict[str, float]
    priority_summary: Dict[str, int]
    time_estimate: str


class RepairEstimator:
    """
    维修量估算类
    
    基于缺损检测、厚度分析和风化预测结果，
    估算所需的维修材料、工时和成本
    """
    
    # 材料单价 (单位: 元)
    MATERIAL_PRICES = {
        RepairMaterialType.CONCRETE: 800,
        RepairMaterialType.EPOXY: 120,
        RepairMaterialType.CEMENT_MORTAR: 600,
        RepairMaterialType.POLYMER: 1500,
        RepairMaterialType.STEEL: 5000,
        RepairMaterialType.FIBERGLASS: 80,
        RepairMaterialType.CARBON_FIBER: 200,
        RepairMaterialType.SEALANT: 50
    }
    
    # 工时单价 (元/小时)
    LABOR_RATE = {
        'simple': 80,
        'medium': 120,
        'complex': 180
    }
    
    # 维修方法材料系数
    METHOD_MATERIAL_FACTORS = {
        RepairMethod.PATCHING: {
            'base_material': RepairMaterialType.CEMENT_MORTAR,
            'thickness_factor': 1.2,
            'overhead': 0.15
        },
        RepairMethod.RESURFACING: {
            'base_material': RepairMaterialType.POLYMER,
            'thickness_factor': 0.05,
            'overhead': 0.1
        },
        RepairMethod.REPLACEMENT: {
            'base_material': RepairMaterialType.CONCRETE,
            'thickness_factor': 1.0,
            'overhead': 0.25
        },
        RepairMethod.INJECTION: {
            'base_material': RepairMaterialType.EPOXY,
            'thickness_factor': 0.5,
            'overhead': 0.2
        },
        RepairMethod.COATING: {
            'base_material': RepairMaterialType.SEALANT,
            'thickness_factor': 0.002,
            'overhead': 0.05
        },
        RepairMethod.STRENGTHENING: {
            'base_material': RepairMaterialType.CARBON_FIBER,
            'thickness_factor': 0.005,
            'overhead': 0.3
        },
        RepairMethod.WELDING: {
            'base_material': RepairMaterialType.STEEL,
            'thickness_factor': 0.1,
            'overhead': 0.15
        },
        RepairMethod.BONDING: {
            'base_material': RepairMaterialType.EPOXY,
            'thickness_factor': 0.01,
            'overhead': 0.1
        }
    }
    
    # 工时系数 (小时/平方米)
    LABOR_FACTORS = {
        RepairMethod.PATCHING: 2.5,
        RepairMethod.RESURFACING: 1.0,
        RepairMethod.REPLACEMENT: 8.0,
        RepairMethod.INJECTION: 5.0,
        RepairMethod.COATING: 0.5,
        RepairMethod.STRENGTHENING: 6.0,
        RepairMethod.WELDING: 4.0,
        RepairMethod.BONDING: 1.5
    }
    
    def __init__(self,
                 labor_rate_type: str = 'medium',
                 include_overhead: bool = True,
                 profit_margin: float = 0.15):
        """
        初始化维修估算器
        
        Args:
            labor_rate_type: 工时费率类型 ('simple', 'medium', 'complex')
            include_overhead: 是否包含管理费用
            profit_margin: 利润率
        """
        self.labor_rate = self.LABOR_RATE.get(labor_rate_type, 120)
        self.include_overhead = include_overhead
        self.profit_margin = profit_margin
        self.estimates: List[RepairTask] = []
        
    def estimate_from_defects(self,
                               defects: List[Dict],
                               thickness_stats: Optional[Dict] = None,
                               weathering_predictions: Optional[List] = None) -> RepairEstimate:
        """
        基于缺损数据估算维修量
        
        Args:
            defects: 缺损列表
            thickness_stats: 厚度统计信息
            weathering_predictions: 风化预测结果
            
        Returns:
            维修估算结果
        """
        tasks = []
        task_id = 1
        
        for defect in defects:
            severity = defect.get('severity', 'medium')
            defect_type = defect.get('type', 'anomaly')
            area = defect.get('area', 0)
            depth = defect.get('depth', 0)
            center = defect.get('center', np.array([0, 0, 0]))
            
            repair_method = self._determine_repair_method(
                defect_type, severity, depth, area
            )
            
            materials = self._calculate_materials(repair_method, area, depth)
            labor_hours = self._calculate_labor(repair_method, area, severity)
            labor_cost = labor_hours * self.labor_rate
            
            priority = self._get_priority(severity, depth, area)
            difficulty = self._get_difficulty(repair_method, depth, area)
            
            task = RepairTask(
                task_id=task_id,
                description=f"{repair_method.value} - {defect_type}",
                repair_method=repair_method,
                location=np.array(center),
                area=area,
                depth=depth,
                volume=area * depth,
                materials=materials,
                labor_hours=labor_hours,
                labor_cost=labor_cost,
                priority=priority,
                difficulty=difficulty
            )
            
            tasks.append(task)
            task_id += 1
        
        if thickness_stats:
            thin_area_tasks = self._estimate_thin_area_repair(thickness_stats)
            tasks.extend(thin_area_tasks)
        
        if weathering_predictions:
            weathering_tasks = self._estimate_weathering_repair(weathering_predictions)
            tasks.extend(weathering_tasks)
        
        self.estimates = tasks
        return self._summarize_estimate(tasks)
    
    def _determine_repair_method(self,
                                  defect_type: str,
                                  severity: str,
                                  depth: float,
                                  area: float) -> RepairMethod:
        """
        根据缺损特征确定维修方法
        
        Args:
            defect_type: 缺损类型
            severity: 严重程度
            depth: 深度
            area: 面积
            
        Returns:
            维修方法
        """
        if defect_type == 'crack':
            if depth > 0.1 or severity in ['critical', 'high']:
                return RepairMethod.INJECTION
            else:
                return RepairMethod.PATCHING
        
        elif defect_type == 'dent':
            if depth > 0.2 or severity in ['critical', 'high']:
                return RepairMethod.REPLACEMENT
            else:
                return RepairMethod.PATCHING
        
        elif defect_type == 'missing_area':
            if area > 1.0 or severity in ['critical', 'high']:
                return RepairMethod.REPLACEMENT
            else:
                return RepairMethod.RESURFACING
        
        elif defect_type == 'abrasion':
            if severity in ['critical', 'high']:
                return RepairMethod.RESURFACING
            else:
                return RepairMethod.COATING
        
        else:
            if severity in ['critical', 'high']:
                return RepairMethod.REPLACEMENT
            elif severity == 'medium':
                return RepairMethod.PATCHING
            else:
                return RepairMethod.COATING
    
    def _calculate_materials(self,
                              repair_method: RepairMethod,
                              area: float,
                              depth: float) -> List[RepairMaterial]:
        """
        计算所需材料量
        
        Args:
            repair_method: 维修方法
            area: 面积
            depth: 深度
            
        Returns:
            材料列表
        """
        materials = []
        factors = self.METHOD_MATERIAL_FACTORS[repair_method]
        
        base_material = factors['base_material']
        thickness_factor = factors['thickness_factor']
        overhead = factors['overhead'] if self.include_overhead else 0
        
        effective_depth = max(depth, 0.01) * thickness_factor
        volume = area * effective_depth * (1 + overhead)
        
        unit_price = self.MATERIAL_PRICES[base_material]
        
        if base_material in [RepairMaterialType.SEALANT, RepairMaterialType.CARBON_FIBER]:
            quantity = area
            unit = "m²"
        else:
            quantity = volume
            unit = "m³"
        
        materials.append(RepairMaterial(
            material_type=base_material,
            quantity=quantity,
            unit=unit,
            unit_cost=unit_price,
            total_cost=quantity * unit_price
        ))
        
        if repair_method in [RepairMethod.INJECTION, RepairMethod.BONDING]:
            materials.append(RepairMaterial(
                material_type=RepairMaterialType.EPOXY,
                quantity=area * 0.001,
                unit="m³",
                unit_cost=self.MATERIAL_PRICES[RepairMaterialType.EPOXY],
                total_cost=area * 0.001 * self.MATERIAL_PRICES[RepairMaterialType.EPOXY]
            ))
        
        return materials
    
    def _calculate_labor(self,
                          repair_method: RepairMethod,
                          area: float,
                          severity: str) -> float:
        """
        计算工时
        
        Args:
            repair_method: 维修方法
            area: 面积
            severity: 严重程度
            
        Returns:
            工时(小时)
        """
        base_hours = self.LABOR_FACTORS[repair_method] * area
        
        severity_multipliers = {
            'low': 0.7,
            'medium': 1.0,
            'high': 1.5,
            'critical': 2.0
        }
        
        multiplier = severity_multipliers.get(severity, 1.0)
        
        return base_hours * multiplier
    
    def _get_priority(self, severity: str, depth: float, area: float) -> str:
        """
        确定维修优先级
        
        Args:
            severity: 严重程度
            depth: 深度
            area: 面积
            
        Returns:
            优先级
        """
        if severity == 'critical' or depth > 0.3 or area > 2.0:
            return 'critical'
        elif severity == 'high' or depth > 0.15:
            return 'high'
        elif severity == 'medium':
            return 'medium'
        else:
            return 'low'
    
    def _get_difficulty(self, repair_method: RepairMethod, depth: float, area: float) -> str:
        """
        确定维修难度
        
        Args:
            repair_method: 维修方法
            depth: 深度
            area: 面积
            
        Returns:
            难度等级
        """
        complex_methods = [
            RepairMethod.REPLACEMENT,
            RepairMethod.INJECTION,
            RepairMethod.STRENGTHENING
        ]
        
        if repair_method in complex_methods or depth > 0.2 or area > 1.0:
            return 'complex'
        elif repair_method == RepairMethod.PATCHING or depth > 0.05:
            return 'medium'
        else:
            return 'simple'
    
    def _estimate_thin_area_repair(self, thickness_stats: Dict) -> List[RepairTask]:
        """
        估算薄区域的维修量
        
        Args:
            thickness_stats: 厚度统计信息
            
        Returns:
            维修任务列表
        """
        tasks = []
        
        median_thickness = thickness_stats.get('median', 0)
        min_thickness = thickness_stats.get('min', 0)
        
        if min_thickness < median_thickness * 0.5:
            thin_area_ratio = thickness_stats.get('valid_points', 0) / max(1, thickness_stats.get('total_points', 1))
            estimated_area = thin_area_ratio * 10
            
            task = RepairTask(
                task_id=len(self.estimates) + len(tasks) + 1000,
                description="薄区域加固 - 厚度不足区域补强",
                repair_method=RepairMethod.STRENGTHENING,
                location=np.array([0, 0, 0]),
                area=estimated_area,
                depth=0.01,
                volume=estimated_area * 0.01,
                materials=self._calculate_materials(
                    RepairMethod.STRENGTHENING, estimated_area, 0.01
                ),
                labor_hours=self._calculate_labor(RepairMethod.STRENGTHENING, estimated_area, 'medium'),
                labor_cost=self._calculate_labor(RepairMethod.STRENGTHENING, estimated_area, 'medium') * self.labor_rate,
                priority='high',
                difficulty='complex'
            )
            
            tasks.append(task)
        
        return tasks
    
    def _estimate_weathering_repair(self, weathering_predictions: List) -> List[RepairTask]:
        """
        估算风化相关的维修量
        
        Args:
            weathering_predictions: 风化预测结果
            
        Returns:
            维修任务列表
        """
        tasks = []
        
        high_risk_count = sum(1 for p in weathering_predictions if p.risk_level in ['high', 'critical'])
        total_count = len(weathering_predictions)
        
        high_risk_ratio = high_risk_count / total_count if total_count > 0 else 0
        
        if high_risk_ratio > 0.1:
            estimated_area = high_risk_ratio * 20
            
            task = RepairTask(
                task_id=len(self.estimates) + len(tasks) + 2000,
                description="风化防护处理 - 高风险区域表面保护",
                repair_method=RepairMethod.COATING,
                location=np.array([0, 0, 0]),
                area=estimated_area,
                depth=0.002,
                volume=estimated_area * 0.002,
                materials=self._calculate_materials(
                    RepairMethod.COATING, estimated_area, 0.002
                ),
                labor_hours=self._calculate_labor(RepairMethod.COATING, estimated_area, 'medium'),
                labor_cost=self._calculate_labor(RepairMethod.COATING, estimated_area, 'medium') * self.labor_rate,
                priority='medium',
                difficulty='simple'
            )
            
            tasks.append(task)
        
        return tasks
    
    def _summarize_estimate(self, tasks: List[RepairTask]) -> RepairEstimate:
        """
        汇总维修估算结果
        
        Args:
            tasks: 维修任务列表
            
        Returns:
            汇总的估算结果
        """
        total_materials_cost = sum(
            m.total_cost for task in tasks for m in task.materials
        )
        total_labor_cost = sum(task.labor_cost for task in tasks)
        total_labor_hours = sum(task.labor_hours for task in tasks)
        
        subtotal = total_materials_cost + total_labor_cost
        total_cost = subtotal * (1 + self.profit_margin)
        
        material_summary = {}
        for task in tasks:
            for material in task.materials:
                mat_name = material.material_type.value
                if mat_name not in material_summary:
                    material_summary[mat_name] = 0
                material_summary[mat_name] += material.quantity
        
        priority_summary = {
            'critical': sum(1 for t in tasks if t.priority == 'critical'),
            'high': sum(1 for t in tasks if t.priority == 'high'),
            'medium': sum(1 for t in tasks if t.priority == 'medium'),
            'low': sum(1 for t in tasks if t.priority == 'low')
        }
        
        if total_labor_hours > 40:
            time_estimate = f"{int(total_labor_hours / 8)} 工作日"
        else:
            time_estimate = f"{int(total_labor_hours)} 工时"
        
        return RepairEstimate(
            total_materials_cost=total_materials_cost,
            total_labor_cost=total_labor_cost,
            total_cost=total_cost,
            total_labor_hours=total_labor_hours,
            tasks=tasks,
            material_summary=material_summary,
            priority_summary=priority_summary,
            time_estimate=time_estimate
        )
    
    def get_detailed_estimate(self) -> Dict:
        """
        获取详细的估算报告
        
        Returns:
            详细估算字典
        """
        if not self.estimates:
            return {}
        
        summary = self._summarize_estimate(self.estimates)
        
        return {
            'cost_breakdown': {
                'materials': summary.total_materials_cost,
                'labor': summary.total_labor_cost,
                'profit': summary.total_cost - summary.total_materials_cost - summary.total_labor_cost,
                'total': summary.total_cost
            },
            'labor_summary': {
                'total_hours': summary.total_labor_hours,
                'estimated_time': summary.time_estimate,
                'hourly_rate': self.labor_rate
            },
            'material_summary': summary.material_summary,
            'priority_summary': summary.priority_summary,
            'tasks': [
                {
                    'task_id': t.task_id,
                    'description': t.description,
                    'method': t.repair_method.value,
                    'area': t.area,
                    'volume': t.volume,
                    'priority': t.priority,
                    'difficulty': t.difficulty,
                    'labor_hours': t.labor_hours,
                    'labor_cost': t.labor_cost,
                    'materials_cost': sum(m.total_cost for m in t.materials),
                    'total_cost': t.labor_cost + sum(m.total_cost for m in t.materials)
                }
                for t in self.estimates
            ]
        }
    
    def generate_repair_plan(self) -> List[Dict]:
        """
        生成维修计划（按优先级排序）
        
        Returns:
            维修计划列表
        """
        priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        
        sorted_tasks = sorted(
            self.estimates,
            key=lambda x: (priority_order.get(x.priority, 3), -x.area)
        )
        
        phases = []
        current_phase = {'phase': 1, 'tasks': [], 'total_hours': 0, 'total_cost': 0}
        
        for task in sorted_tasks:
            task_cost = task.labor_cost + sum(m.total_cost for m in task.materials)
            
            if current_phase['total_hours'] + task.labor_hours > 40 and len(current_phase['tasks']) > 0:
                phases.append(current_phase)
                current_phase = {
                    'phase': len(phases) + 1,
                    'tasks': [],
                    'total_hours': 0,
                    'total_cost': 0
                }
            
            current_phase['tasks'].append({
                'task_id': task.task_id,
                'description': task.description,
                'priority': task.priority,
                'area': task.area,
                'estimated_hours': task.labor_hours,
                'estimated_cost': task_cost
            })
            current_phase['total_hours'] += task.labor_hours
            current_phase['total_cost'] += task_cost
        
        if current_phase['tasks']:
            phases.append(current_phase)
        
        return phases
