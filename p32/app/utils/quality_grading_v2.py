from typing import Dict, List, Optional, Tuple
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, getcontext
import uuid
import threading
import hashlib
from functools import lru_cache
from collections import OrderedDict

getcontext().prec = 10


class LRUCache:
    def __init__(self, capacity: int = 1000):
        self.cache = OrderedDict()
        self.capacity = capacity
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Dict]:
        with self._lock:
            if key in self.cache:
                self.cache.move_to_end(key)
                self.hits += 1
                return self.cache[key]
            self.misses += 1
            return None

    def put(self, key: str, value: Dict):
        with self._lock:
            if key in self.cache:
                self.cache.move_to_end(key)
            else:
                if len(self.cache) >= self.capacity:
                    self.cache.popitem(last=False)
            self.cache[key] = value

    def get_stats(self) -> Dict:
        with self._lock:
            total = self.hits + self.misses
            return {
                "size": len(self.cache),
                "capacity": self.capacity,
                "hit_rate": self.hits / total if total > 0 else 0.0,
                "hits": self.hits,
                "misses": self.misses
            }


class QualityGradingEngineV2:
    def __init__(self, cache_capacity: int = 1000):
        self.grade_weights = {
            "color": Decimal("0.30"),
            "toughness": Decimal("0.35"),
            "composition": Decimal("0.35")
        }
        self.grade_ranges = [
            (Decimal("90"), Decimal("100"), "S级", "极品原料，品质卓越，适合顶级手工艺品"),
            (Decimal("80"), Decimal("89.99"), "A级", "优质原料，品质优良，适合高档产品"),
            (Decimal("70"), Decimal("79.99"), "B级", "良好原料，品质稳定，适合常规产品"),
            (Decimal("60"), Decimal("69.99"), "C级", "合格原料，基本达标，适合普通产品"),
            (Decimal("0"), Decimal("59.99"), "D级", "不合格原料，品质较差，建议谨慎使用")
        ]
        self.cache = LRUCache(capacity=cache_capacity)
        self._lock = threading.Lock()
        self._warm_up_cache()

    def _warm_up_cache(self):
        pass

    @staticmethod
    def _generate_cache_key(color_data: Dict, toughness_data: Dict, composition_data: Dict) -> str:
        data_str = f"{sorted(color_data.items()) if color_data else ''}|" \
                   f"{sorted(toughness_data.items()) if toughness_data else ''}|" \
                   f"{sorted(composition_data.items()) if composition_data else ''}"
        return hashlib.md5(data_str.encode()).hexdigest()

    def _round_decimal(self, value: Decimal, places: int = 4) -> Decimal:
        return value.quantize(Decimal(f"1.{'0' * places}"), rounding=ROUND_HALF_UP)

    @lru_cache(maxsize=128)
    def calculate_color_score_cached(self, uniformity: Optional[float] = None,
                                     glossiness: Optional[float] = None,
                                     r_value: Optional[float] = None,
                                     g_value: Optional[float] = None,
                                     b_value: Optional[float] = None) -> float:
        score = Decimal("0.0")
        count = Decimal("0.0")

        if uniformity is not None:
            uniformity_val = Decimal(str(min(100, max(0, uniformity))))
            score += uniformity_val * Decimal("0.4")
            count += Decimal("1")

        if glossiness is not None:
            glossiness_val = Decimal(str(min(100, max(0, glossiness))))
            score += glossiness_val * Decimal("0.3")
            count += Decimal("1")

        if r_value is not None and g_value is not None and b_value is not None:
            r = Decimal(str(r_value))
            g = Decimal(str(g_value))
            b = Decimal(str(b_value))
            color_brightness = (r * Decimal("299") + g * Decimal("587") + b * Decimal("114")) / Decimal("1000") / Decimal("2.55")
            score += color_brightness * Decimal("0.3")
            count += Decimal("1")

        result = score / count if count > 0 else Decimal("50.0")
        return float(self._round_decimal(result, 4))

    def calculate_color_score(self, color_data: Dict) -> float:
        if not color_data:
            return 50.0
        return self.calculate_color_score_cached(
            uniformity=color_data.get("uniformity"),
            glossiness=color_data.get("glossiness"),
            r_value=color_data.get("r_value"),
            g_value=color_data.get("g_value"),
            b_value=color_data.get("b_value")
        )

    def calculate_toughness_score(self, toughness_data: Dict) -> float:
        if not toughness_data:
            return 50.0

        score = Decimal("0.0")
        count = Decimal("0.0")

        params = [
            ("tensile_strength", 100, Decimal("0.25")),
            ("elongation", 50, Decimal("0.20")),
            ("tear_resistance", 100, Decimal("0.20")),
            ("bending_resistance", 100, Decimal("0.15")),
            ("impact_resistance", 50, Decimal("0.10")),
            ("wear_resistance", 100, Decimal("0.10"))
        ]

        for param, max_val, weight in params:
            if toughness_data.get(param) is not None:
                actual_value = Decimal(str(toughness_data[param]))
                normalized = min(100, max(0, float(actual_value / Decimal(str(max_val)) * Decimal("100"))))
                score += Decimal(str(normalized)) * weight
                count += weight

        result = score / count if count > 0 else Decimal("50.0")
        return float(self._round_decimal(result, 4))

    def calculate_composition_score(self, composition_data: Dict) -> float:
        if not composition_data:
            return 50.0

        score = Decimal("0.0")
        count = Decimal("0.0")

        ideal_composition = {
            "cellulose_content": 85,
            "lignin_content": 10,
            "hemicellulose_content": 5,
            "moisture_content": 8,
            "ash_content": 1,
            "impurity_content": 0.5
        }

        for param, ideal_val in ideal_composition.items():
            if composition_data.get(param) is not None:
                actual_val = Decimal(str(composition_data[param]))
                ideal = Decimal(str(ideal_val))
                diff = abs(actual_val - ideal) / ideal
                param_score = max(0, 100 - float(diff * Decimal("100")))
                score += Decimal(str(param_score))
                count += Decimal("1")

        if composition_data.get("ph_value") is not None:
            ph = Decimal(str(composition_data["ph_value"]))
            if Decimal("6.5") <= ph <= Decimal("7.5"):
                score += Decimal("100")
            else:
                ph_deviation = abs(ph - Decimal("7.0")) / Decimal("7.0")
                ph_score = max(0, 100 - float(ph_deviation * Decimal("50")))
                score += Decimal(str(ph_score))
            count += Decimal("1")

        if composition_data.get("organic_matter") is not None:
            organic = Decimal(str(composition_data["organic_matter"]))
            score += min(Decimal("100"), organic)
            count += Decimal("1")

        result = score / count if count > 0 else Decimal("50.0")
        return float(self._round_decimal(result, 4))

    def calculate_custom_parameters_score(self, custom_params: List[Dict]) -> Tuple[float, List[Dict]]:
        if not custom_params:
            return 50.0, []

        total_score = Decimal("0.0")
        total_weight = Decimal("0.0")
        param_scores = []

        for param in custom_params:
            value = Decimal(str(param.get("value", 0)))
            standard_min = Decimal(str(param.get("standard_min", 0)))
            standard_max = Decimal(str(param.get("standard_max", 100)))
            weight = Decimal(str(param.get("weight", 1.0)))

            if standard_max > standard_min:
                normalized = float(((value - standard_min) / (standard_max - standard_min)) * Decimal("100"))
                normalized = min(100, max(0, normalized))
            else:
                normalized = 50

            is_passed = normalized >= 60
            param_score = {
                "parameter_name": param.get("parameter_name"),
                "parameter_code": param.get("parameter_code"),
                "value": float(value),
                "standard_min": float(standard_min),
                "standard_max": float(standard_max),
                "score": round(normalized, 4),
                "weight": float(weight),
                "is_passed": is_passed,
                "notes": param.get("notes")
            }
            param_scores.append(param_score)

            total_score += Decimal(str(normalized)) * weight
            total_weight += weight

        final_score = total_score / total_weight if total_weight > 0 else Decimal("50.0")
        return float(self._round_decimal(final_score, 4)), param_scores

    def _determine_grade(self, overall_score: float) -> Tuple[str, str]:
        overall_decimal = Decimal(str(overall_score))
        for min_score, max_score, grade_name, explanation_text in self.grade_ranges:
            if min_score <= overall_decimal <= max_score:
                return grade_name, explanation_text
        return "未评级", ""

    def calculate_grade(self, batch_id: str, color_data: Optional[Dict] = None,
                        toughness_data: Optional[Dict] = None, composition_data: Optional[Dict] = None,
                        custom_params: Optional[List[Dict]] = None, use_cache: bool = True) -> Dict:
        if use_cache:
            cache_key = self._generate_cache_key(color_data, toughness_data, composition_data)
            cached = self.cache.get(cache_key)
            if cached:
                cached["batch_id"] = batch_id
                cached["test_code"] = f"QC{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"
                return cached

        color_score = self.calculate_color_score(color_data) if color_data else 0.0
        toughness_score = self.calculate_toughness_score(toughness_data) if toughness_data else 0.0
        composition_score = self.calculate_composition_score(composition_data) if composition_data else 0.0

        custom_score = 0.0
        param_scores = []
        if custom_params:
            custom_score, param_scores = self.calculate_custom_parameters_score(custom_params)

        if custom_params and not color_data and not toughness_data and not composition_data:
            overall_score = custom_score
        else:
            has_color = color_data is not None
            has_toughness = toughness_data is not None
            has_composition = composition_data is not None

            if not has_color and not has_toughness and not has_composition:
                overall_score = 50.0
            else:
                weighted_sum = 0.0
                total_weight = 0.0

                if has_color:
                    weighted_sum += color_score * float(self.grade_weights["color"])
                    total_weight += float(self.grade_weights["color"])
                if has_toughness:
                    weighted_sum += toughness_score * float(self.grade_weights["toughness"])
                    total_weight += float(self.grade_weights["toughness"])
                if has_composition:
                    weighted_sum += composition_score * float(self.grade_weights["composition"])
                    total_weight += float(self.grade_weights["composition"])

                overall_score = weighted_sum / total_weight if total_weight > 0 else 50.0

        grade, explanation = self._determine_grade(overall_score)
        recommendations = self.generate_recommendations(overall_score, color_score if color_data else None,
                                                         toughness_score if toughness_data else None,
                                                         composition_score if composition_data else None)

        result = {
            "batch_id": batch_id,
            "overall_score": round(overall_score, 4),
            "grade": grade,
            "color_score": round(color_score, 4) if color_data else None,
            "toughness_score": round(toughness_score, 4) if toughness_data else None,
            "composition_score": round(composition_score, 4) if composition_data else None,
            "parameter_scores": param_scores,
            "grade_explanation": explanation,
            "recommendations": recommendations
        }

        if use_cache:
            cache_key = self._generate_cache_key(color_data, toughness_data, composition_data)
            self.cache.put(cache_key, result.copy())

        result["test_code"] = f"QC{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"
        return result

    def batch_calculate_grades(self, batches: List[Dict]) -> List[Dict]:
        results = []
        for batch in batches:
            result = self.calculate_grade(
                batch_id=batch["batch_id"],
                color_data=batch.get("color_data"),
                toughness_data=batch.get("toughness_data"),
                composition_data=batch.get("composition_data"),
                custom_params=batch.get("custom_params"),
                use_cache=True
            )
            results.append(result)
        return results

    def generate_recommendations(self, overall_score: float, color_score: Optional[float],
                                  toughness_score: Optional[float], composition_score: Optional[float]) -> List[str]:
        recommendations = []

        if overall_score >= 90:
            recommendations.append("该原料品质卓越，建议用于顶级手工艺品制作")
            recommendations.append("可作为高端产品的原料首选")
        elif overall_score >= 80:
            recommendations.append("该原料品质优良，适合中高档产品")
            recommendations.append("建议根据具体工艺需求进行适当配比")
        elif overall_score >= 70:
            recommendations.append("该原料品质良好，适合常规手工艺品生产")
            recommendations.append("建议与更高品质原料搭配使用以提升效果")
        elif overall_score >= 60:
            recommendations.append("该原料品质基本合格，建议用于普通产品")
            recommendations.append("考虑进行原料预处理以提升品质")
        else:
            recommendations.append("该原料品质较差，建议谨慎使用")
            recommendations.append("建议寻找替代原料或进行品质改良")

        if color_score is not None and color_score < 70:
            recommendations.append("色泽评分较低，建议考虑染色处理或漂白工艺")
        if toughness_score is not None and toughness_score < 70:
            recommendations.append("韧性评分较低，建议采用增强处理工艺或调整配方")
        if composition_score is not None and composition_score < 70:
            recommendations.append("成分评分较低，建议进行原料提纯或配比优化")

        return recommendations

    def get_cache_stats(self) -> Dict:
        return self.cache.get_stats()


quality_engine_v2 = QualityGradingEngineV2(cache_capacity=1000)
