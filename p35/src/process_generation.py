import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class ProductType(Enum):
    """产品类型"""
    RICE_WINE_SWEET = "甜型米酒"
    RICE_WINE_SEMI_DRY = "半干型米酒"
    RICE_WINE_DRY = "干型米酒"
    RICE_WINE_XIANGXUE = "香雪酒"
    SOY_SAUCE_LIGHT = "生抽酱油"
    SOY_SAUCE_DARK = "老抽酱油"
    VINEGAR_BLACK = "陈醋"
    VINEGAR_RICE = "米醋"


class FermentationStage(Enum):
    """发酵阶段"""
    SACCHARIFICATION = "糖化阶段"
    MAIN_FERMENTATION = "主发酵阶段"
    POST_FERMENTATION = "后发酵阶段"
    AGING = "陈酿阶段"


@dataclass
class StageParameters:
    """阶段工艺参数"""
    stage_name: str
    duration_hours: float
    target_temperature: float
    temp_range: Tuple[float, float]
    target_ph: Optional[float] = None
    ph_range: Optional[Tuple[float, float]] = None
    stirring_interval: Optional[float] = None
    oxygen_supply: Optional[str] = None
    notes: str = ""


@dataclass
class ProcessRecipe:
    """完整工艺方案"""
    recipe_id: str
    recipe_name: str
    product_type: str
    creation_date: str
    total_duration_hours: float
    initial_conditions: Dict[str, float]
    stages: List[StageParameters]
    material_formula: Dict[str, float]
    quality_targets: Dict[str, float]
    critical_control_points: List[Dict]
    risk_assessment: Dict[str, str]
    recommended_equipment: List[str]
    generation_method: str = "rule_based"
    confidence_score: float = 0.85


class RecipeGenerator:
    """工艺方案生成器"""

    def __init__(self):
        self.knowledge_base = self._build_knowledge_base()
        self.generated_recipes: List[ProcessRecipe] = []

    def _build_knowledge_base(self) -> Dict:
        """构建工艺知识库"""
        return {
            ProductType.RICE_WINE_SWEET: {
                "stages": [
                    {
                        "name": "浸米阶段",
                        "duration": 24,
                        "temp": 25,
                        "temp_range": (22, 28),
                        "notes": "米水比例1:1.5，保持清洁"
                    },
                    {
                        "name": "蒸饭阶段",
                        "duration": 1,
                        "temp": 100,
                        "temp_range": (95, 105),
                        "notes": "蒸至透而不烂"
                    },
                    {
                        "name": "落缸糖化",
                        "duration": 48,
                        "temp": 30,
                        "temp_range": (28, 32),
                        "ph_range": (5.0, 5.5),
                        "notes": "加入酒曲，控制品温"
                    },
                    {
                        "name": "主发酵",
                        "duration": 72,
                        "temp": 28,
                        "temp_range": (26, 30),
                        "ph_range": (3.8, 4.5),
                        "stirring_interval": 8,
                        "notes": "观察气泡，控制品温"
                    },
                    {
                        "name": "后发酵陈酿",
                        "duration": 720,
                        "temp": 18,
                        "temp_range": (15, 20),
                        "notes": "低温陈酿，提升风味"
                    }
                ],
                "materials": {
                    "糯米": 100.0,
                    "酒曲": 1.0,
                    "水": 150.0
                },
                "quality_targets": {
                    "alcohol": 12.0,
                    "sugar_residual": 80.0,
                    "acidity": 0.45
                },
                "ccp": [
                    {"point": "蒸饭温度", "limit": "≥95℃", "monitor": "温度计"},
                    {"point": "主发酵最高品温", "limit": "≤32℃", "monitor": "连续测温"}
                ]
            },
            ProductType.RICE_WINE_SEMI_DRY: {
                "stages": [
                    {
                        "name": "浸米阶段",
                        "duration": 36,
                        "temp": 25,
                        "temp_range": (20, 30),
                        "notes": "长时浸米，充分吸水"
                    },
                    {
                        "name": "蒸饭阶段",
                        "duration": 1.5,
                        "temp": 100,
                        "temp_range": (95, 105),
                        "notes": "内外熟度均匀"
                    },
                    {
                        "name": "落缸糖化",
                        "duration": 36,
                        "temp": 30,
                        "temp_range": (28, 32),
                        "notes": "控制糖化程度"
                    },
                    {
                        "name": "主发酵",
                        "duration": 96,
                        "temp": 30,
                        "temp_range": (28, 32),
                        "stirring_interval": 6,
                        "notes": "充分发酵，降低残糖"
                    },
                    {
                        "name": "后发酵",
                        "duration": 360,
                        "temp": 20,
                        "temp_range": (18, 22),
                        "notes": "风味转化"
                    },
                    {
                        "name": "陈酿",
                        "duration": 720,
                        "temp": 15,
                        "temp_range": (12, 18),
                        "notes": "低温长期陈酿"
                    }
                ],
                "materials": {
                    "糯米": 100.0,
                    "酒曲": 1.2,
                    "水": 180.0
                },
                "quality_targets": {
                    "alcohol": 15.0,
                    "sugar_residual": 30.0,
                    "acidity": 0.50
                },
                "ccp": [
                    {"point": "发酵最高温度", "limit": "≤35℃", "monitor": "连续测温"},
                    {"point": "主发酵时间", "limit": "≥72h", "monitor": "计时"}
                ]
            },
            ProductType.RICE_WINE_DRY: {
                "stages": [
                    {
                        "name": "浸米阶段",
                        "duration": 48,
                        "temp": 25,
                        "temp_range": (22, 28),
                        "notes": "充分吸水"
                    },
                    {
                        "name": "蒸饭阶段",
                        "duration": 1.5,
                        "temp": 100,
                        "temp_range": (95, 105),
                        "notes": "饭粒透亮"
                    },
                    {
                        "name": "落缸糖化",
                        "duration": 24,
                        "temp": 32,
                        "temp_range": (30, 34),
                        "notes": "快速糖化"
                    },
                    {
                        "name": "主发酵",
                        "duration": 120,
                        "temp": 32,
                        "temp_range": (30, 34),
                        "stirring_interval": 4,
                        "notes": "完全发酵"
                    },
                    {
                        "name": "后发酵",
                        "duration": 480,
                        "temp": 22,
                        "temp_range": (20, 24),
                        "notes": "残糖利用"
                    },
                    {
                        "name": "陈酿",
                        "duration": 1440,
                        "temp": 12,
                        "temp_range": (10, 15),
                        "notes": "长期陈酿增香"
                    }
                ],
                "materials": {
                    "糯米": 100.0,
                    "酒曲": 1.5,
                    "水": 200.0
                },
                "quality_targets": {
                    "alcohol": 17.0,
                    "sugar_residual": 5.0,
                    "acidity": 0.55
                },
                "ccp": [
                    {"point": "主发酵温度", "limit": "30-34℃", "monitor": "连续测温"},
                    {"point": "酒精含量", "limit": "≥16%", "monitor": "蒸馏法检测"}
                ]
            },
            ProductType.SOY_SAUCE_LIGHT: {
                "stages": [
                    {
                        "name": "豆麦处理",
                        "duration": 6,
                        "temp": 100,
                        "temp_range": (95, 105),
                        "notes": "大豆蒸煮，小麦炒制"
                    },
                    {
                        "name": "制曲",
                        "duration": 72,
                        "temp": 30,
                        "temp_range": (28, 32),
                        "notes": "米曲霉培养"
                    },
                    {
                        "name": "制醅入池",
                        "duration": 24,
                        "temp": 25,
                        "temp_range": (20, 30),
                        "notes": "加入盐水拌匀"
                    },
                    {
                        "name": "稀发酵",
                        "duration": 1080,
                        "temp": 35,
                        "temp_range": (30, 40),
                        "stirring_interval": 24,
                        "notes": "日晒夜露，定期翻拌"
                    },
                    {
                        "name": "后熟陈酿",
                        "duration": 720,
                        "temp": 25,
                        "temp_range": (20, 30),
                        "notes": "提升风味"
                    }
                ],
                "materials": {
                    "大豆": 100.0,
                    "小麦": 50.0,
                    "食盐": 50.0,
                    "水": 300.0,
                    "米曲霉菌种": 0.5
                },
                "quality_targets": {
                    "amino_nitrogen": 0.8,
                    "salt": 18.0,
                    "total_acid": 2.5
                },
                "ccp": [
                    {"point": "制曲温度", "limit": "≤35℃", "monitor": "连续测温"},
                    {"point": "发酵盐度", "limit": "≥15%", "monitor": "盐度计"}
                ]
            }
        }

    def generate_recipe(self, product_type: ProductType,
                        customizations: Optional[Dict] = None) -> ProcessRecipe:
        """生成工艺方案"""

        if product_type not in self.knowledge_base:
            raise ValueError(f"不支持的产品类型: {product_type}")

        knowledge = self.knowledge_base[product_type]

        stages = []
        for stage_data in knowledge["stages"]:
            stage = StageParameters(
                stage_name=stage_data["name"],
                duration_hours=stage_data["duration"],
                target_temperature=stage_data["temp"],
                temp_range=stage_data["temp_range"],
                ph_range=stage_data.get("ph_range"),
                stirring_interval=stage_data.get("stirring_interval"),
                notes=stage_data.get("notes", "")
            )
            stages.append(stage)

        total_duration = sum(s.duration_hours for s in stages)

        recipe_id = f"REC_{product_type.name}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        initial_conditions = {
            "temperature": stages[0].target_temperature,
            "ph": 5.5,
            "stirring_rate": 0.0
        }

        risk_assessment = self._assess_risks(stages, knowledge.get("quality_targets", {}))

        recipe = ProcessRecipe(
            recipe_id=recipe_id,
            recipe_name=f"{product_type.value}标准工艺",
            product_type=product_type.value,
            creation_date=datetime.now().isoformat(),
            total_duration_hours=total_duration,
            initial_conditions=initial_conditions,
            stages=stages,
            material_formula=knowledge["materials"].copy(),
            quality_targets=knowledge["quality_targets"].copy(),
            critical_control_points=knowledge["ccp"].copy(),
            risk_assessment=risk_assessment,
            recommended_equipment=["发酵缸", "温度传感器", "搅拌装置", "pH监测仪"],
            confidence_score=0.85
        )

        if customizations:
            recipe = self._apply_customizations(recipe, customizations)

        self.generated_recipes.append(recipe)
        return recipe

    def _apply_customizations(self, recipe: ProcessRecipe, customizations: Dict) -> ProcessRecipe:
        """应用用户自定义调整"""

        if "temperature_offset" in customizations:
            offset = customizations["temperature_offset"]
            for stage in recipe.stages:
                stage.target_temperature += offset
                stage.temp_range = (
                    stage.temp_range[0] + offset,
                    stage.temp_range[1] + offset
                )

        if "duration_factor" in customizations:
            factor = customizations["duration_factor"]
            for stage in recipe.stages:
                stage.duration_hours *= factor
            recipe.total_duration_hours *= factor

        if "material_adjustments" in customizations:
            for material, adjustment in customizations["material_adjustments"].items():
                if material in recipe.material_formula:
                    recipe.material_formula[material] *= adjustment

        if "quality_targets" in customizations:
            for target, value in customizations["quality_targets"].items():
                recipe.quality_targets[target] = value

        recipe.generation_method = "customized"
        recipe.confidence_score *= 0.9
        return recipe

    def _assess_risks(self, stages: List[StageParameters], quality_targets: Dict) -> Dict[str, str]:
        """风险评估"""
        risks = {}

        max_temp = max(s.target_temperature for s in stages)
        if max_temp > 35:
            risks["high_temperature"] = "高温可能导致微生物失活，需加强温度控制"
        elif max_temp < 20:
            risks["low_temperature"] = "低温发酵周期长，需注意防止杂菌污染"

        duration_days = sum(s.duration_hours for s in stages) / 24
        if duration_days > 30:
            risks["long_cycle"] = "长周期发酵，需特别注意环境卫生和杂菌防控"

        if quality_targets.get("alcohol", 0) > 15:
            risks["high_alcohol"] = "高酒精度可能抑制酵母活性，需控制发酵节奏"

        if not risks:
            risks["status"] = "低风险工艺"

        return risks

    def optimize_recipe_for_season(self, base_recipe: ProcessRecipe, season: str) -> ProcessRecipe:
        """根据季节优化工艺参数"""
        season_adjustments = {
            "夏季": {"temp_offset": -2.0, "duration_factor": 0.9},
            "冬季": {"temp_offset": 2.0, "duration_factor": 1.1},
            "春季": {"temp_offset": 0.0, "duration_factor": 1.0},
            "秋季": {"temp_offset": 0.0, "duration_factor": 1.0}
        }

        if season not in season_adjustments:
            return base_recipe

        adj = season_adjustments[season]
        return self._apply_customizations(base_recipe, adj)

    def generate_temperature_profile(self, recipe: ProcessRecipe,
                                      n_points: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """生成温度时间曲线"""
        total_hours = recipe.total_duration_hours
        time = np.linspace(0, total_hours, n_points)
        temperature = np.zeros_like(time)

        current_time = 0
        for stage in recipe.stages:
            mask = (time >= current_time) & (time < current_time + stage.duration_hours)
            temp_base = stage.target_temperature
            temp_variation = (stage.temp_range[1] - stage.temp_range[0]) / 4
            stage_time = time[mask] - current_time
            temperature[mask] = temp_base + temp_variation * np.sin(stage_time / stage.duration_hours * np.pi)
            current_time += stage.duration_hours

        return time, temperature

    def export_recipe_to_dict(self, recipe: ProcessRecipe) -> Dict:
        """导出工艺方案为字典"""
        return {
            "recipe_id": recipe.recipe_id,
            "recipe_name": recipe.recipe_name,
            "product_type": recipe.product_type,
            "creation_date": recipe.creation_date,
            "total_duration_hours": recipe.total_duration_hours,
            "initial_conditions": recipe.initial_conditions,
            "stages": [
                {
                    "stage_name": s.stage_name,
                    "duration_hours": s.duration_hours,
                    "target_temperature": s.target_temperature,
                    "temp_range": s.temp_range,
                    "ph_range": s.ph_range,
                    "stirring_interval": s.stirring_interval,
                    "notes": s.notes
                }
                for s in recipe.stages
            ],
            "material_formula": recipe.material_formula,
            "quality_targets": recipe.quality_targets,
            "critical_control_points": recipe.critical_control_points,
            "risk_assessment": recipe.risk_assessment,
            "recommended_equipment": recipe.recommended_equipment,
            "confidence_score": recipe.confidence_score
        }


class IntelligentOptimizer:
    """基于历史数据的智能优化器"""

    def __init__(self, historical_data: List):
        self.historical_data = historical_data
        self.successful_batches = []
        self._analyze_historical_data()

    def _analyze_historical_data(self):
        """分析历史数据提取成功模式"""
        for batch in self.historical_data:
            if hasattr(batch, 'quality_metrics'):
                metrics = batch.quality_metrics
                if metrics.get('process_stability', 0) > 0.8:
                    self.successful_batches.append(batch)

    def recommend_optimal_temperature(self, product_type: str) -> Tuple[float, Tuple[float, float]]:
        """推荐最优发酵温度"""
        relevant = [b for b in self.successful_batches
                     if b.product_type == product_type]

        if not relevant:
            return 30.0, (28.0, 32.0)

        temps = []
        for batch in relevant:
            params = batch.process_parameters
            if 'avg_temperature' in params:
                temps.append(params['avg_temperature'])

        if temps:
            avg_temp = np.mean(temps)
            std_temp = np.std(temps)
            return float(avg_temp), (float(avg_temp - std_temp), float(avg_temp + std_temp))

        return 30.0, (28.0, 32.0)

    def recommend_duration(self, product_type: str) -> float:
        """推荐发酵周期"""
        relevant = [b for b in self.successful_batches
                     if b.product_type == product_type]

        if not relevant:
            return 120.0

        durations = [b.duration_hours for b in relevant]
        return float(np.mean(durations))
