from typing import Dict, List, Optional, Tuple
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, getcontext
import uuid

getcontext().prec = 10


class QualityGradingEngine:
    def __init__(self):
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

    def _round_decimal(self, value: Decimal, places: int = 4) -> Decimal:
        return value.quantize(Decimal(f"1.{'0' * places}"), rounding=ROUND_HALF_UP)

    def calculate_color_score(self, color_data: Dict) -> float:
        score = Decimal("0.0")
        count = Decimal("0.0")

        if color_data.get("uniformity") is not None:
            uniformity = Decimal(str(min(100, max(0, color_data["uniformity"]))))
            score += uniformity * Decimal("0.4")
            count += Decimal("1")

        if color_data.get("glossiness") is not None:
            glossiness = Decimal(str(min(100, max(0, color_data["glossiness"]))))
            score += glossiness * Decimal("0.3")
            count += Decimal("1")

        if color_data.get("r_value") is not None and color_data.get("g_value") is not None and color_data.get("b_value") is not None:
            r = Decimal(str(color_data["r_value"]))
            g = Decimal(str(color_data["g_value"]))
            b = Decimal(str(color_data["b_value"]))
            color_brightness = (r * Decimal("299") + g * Decimal("587") + b * Decimal("114")) / Decimal("1000") / Decimal("2.55")
            score += color_brightness * Decimal("0.3")
            count += Decimal("1")

        result = score / count if count > 0 else Decimal("50.0")
        return float(self._round_decimal(result, 4))

    def calculate_toughness_score(self, toughness_data: Dict) -> float:
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

    def calculate_grade(self, batch_id: str, color_data: Optional[Dict] = None,
                        toughness_data: Optional[Dict] = None, composition_data: Optional[Dict] = None,
                        custom_params: Optional[List[Dict]] = None) -> Dict:
        scores = {}
        color_score = 0.0
        toughness_score = 0.0
        composition_score = 0.0
        param_scores = []

        if color_data:
            color_score = self.calculate_color_score(color_data)
            scores["color"] = color_score

        if toughness_data:
            toughness_score = self.calculate_toughness_score(toughness_data)
            scores["toughness"] = toughness_score

        if composition_data:
            composition_score = self.calculate_composition_score(composition_data)
            scores["composition"] = composition_score

        if custom_params:
            custom_score, param_scores = self.calculate_custom_parameters_score(custom_params)
            scores["custom"] = custom_score

        if scores:
            if len(scores) == 1 and "custom" in scores:
                overall_score = scores["custom"]
            else:
                weighted_sum = (
                    color_score * float(self.grade_weights["color"]) +
                    toughness_score * float(self.grade_weights["toughness"]) +
                    composition_score * float(self.grade_weights["composition"])
                )
                overall_weight = 0.0
                if color_data:
                    overall_weight += float(self.grade_weights["color"])
                if toughness_data:
                    overall_weight += float(self.grade_weights["toughness"])
                if composition_data:
                    overall_weight += float(self.grade_weights["composition"])
                overall_score = weighted_sum / overall_weight if overall_weight > 0 else weighted_sum
        else:
            overall_score = 50.0

        grade = "未评级"
        explanation = ""
        overall_decimal = Decimal(str(overall_score))
        for min_score, max_score, grade_name, explanation_text in self.grade_ranges:
            if min_score <= overall_decimal <= max_score:
                grade = grade_name
                explanation = explanation_text
                break

        recommendations = self.generate_recommendations(overall_score, color_score, toughness_score, composition_score)
        test_code = f"QC{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"

        return {
            "batch_id": batch_id,
            "test_code": test_code,
            "overall_score": round(overall_score, 4),
            "grade": grade,
            "color_score": round(color_score, 4) if color_data else None,
            "toughness_score": round(toughness_score, 4) if toughness_data else None,
            "composition_score": round(composition_score, 4) if composition_data else None,
            "parameter_scores": param_scores,
            "grade_explanation": explanation,
            "recommendations": recommendations
        }

    def generate_recommendations(self, overall_score: float, color_score: float,
                                  toughness_score: float, composition_score: float) -> List[str]:
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

        if color_score and color_score < 70:
            recommendations.append("色泽评分较低，建议考虑染色处理或漂白工艺")
        if toughness_score and toughness_score < 70:
            recommendations.append("韧性评分较低，建议采用增强处理工艺或调整配方")
        if composition_score and composition_score < 70:
            recommendations.append("成分评分较低，建议进行原料提纯或配比优化")

        return recommendations


quality_engine = QualityGradingEngine()
