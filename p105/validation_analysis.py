import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from scipy import stats
import json
import os


@dataclass
class DryingTestData:
    test_id: str
    material: str
    time_points: np.ndarray
    moisture_data: np.ndarray
    temp_data: Optional[np.ndarray] = None
    ambient_temp: float = 25.0
    humidity: float = 60.0
    thickness: float = 0.001
    notes: str = ""


class ValidationAnalyzer:
    def __init__(self):
        self.test_datasets: Dict[str, DryingTestData] = {}
        self.simulation_results = {}
        self.comparison_results = {}

    def load_test_data(self, filepath: str) -> Optional[DryingTestData]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            test_data = DryingTestData(
                test_id=data.get('test_id', os.path.basename(filepath)),
                material=data.get('material', 'unknown'),
                time_points=np.array(data.get('time_points', [])),
                moisture_data=np.array(data.get('moisture_data', [])),
                temp_data=np.array(data.get('temp_data', [])) if 'temp_data' in data else None,
                ambient_temp=data.get('ambient_temp', 25.0),
                humidity=data.get('humidity', 60.0),
                thickness=data.get('thickness', 0.001),
                notes=data.get('notes', '')
            )

            self.test_datasets[test_data.test_id] = test_data
            print(f"成功加载测试数据: {test_data.test_id}")
            return test_data

        except Exception as e:
            print(f"加载测试数据失败: {e}")
            return None

    def save_test_data(self, test_data: DryingTestData, filepath: str):
        data = {
            'test_id': test_data.test_id,
            'material': test_data.material,
            'time_points': test_data.time_points.tolist(),
            'moisture_data': test_data.moisture_data.tolist(),
            'temp_data': test_data.temp_data.tolist() if test_data.temp_data is not None else None,
            'ambient_temp': test_data.ambient_temp,
            'humidity': test_data.humidity,
            'thickness': test_data.thickness,
            'notes': test_data.notes
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"测试数据已保存至: {filepath}")

    def register_simulation_result(self, sim_id: str, time: np.ndarray,
                                    moisture: np.ndarray, temp: Optional[np.ndarray] = None):
        self.simulation_results[sim_id] = {
            'time': time,
            'moisture': moisture,
            'temp': temp
        }
        print(f"仿真结果已注册: {sim_id}")

    def _interpolate_to_common_points(
        self,
        test_time: np.ndarray,
        test_data: np.ndarray,
        sim_time: np.ndarray,
        sim_data: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        common_time = np.sort(np.unique(np.concatenate([test_time, sim_time])))
        test_interp = np.interp(common_time, test_time, test_data)
        sim_interp = np.interp(common_time, sim_time, sim_data)
        return common_time, test_interp, sim_interp

    def compare_simulation_test(
        self,
        test_id: str,
        sim_id: str,
        moisture_tolerance: float = 0.02
    ) -> Dict:
        if test_id not in self.test_datasets:
            raise ValueError(f"测试数据不存在: {test_id}")
        if sim_id not in self.simulation_results:
            raise ValueError(f"仿真结果不存在: {sim_id}")

        test_data = self.test_datasets[test_id]
        sim_result = self.simulation_results[sim_id]

        common_time, test_moisture, sim_moisture = self._interpolate_to_common_points(
            test_data.time_points, test_data.moisture_data,
            sim_result['time'], sim_result['moisture']
        )

        error = sim_moisture - test_moisture
        abs_error = np.abs(error)
        rel_error = np.abs(error / np.maximum(test_moisture, 1e-6))

        mae = np.mean(abs_error)
        rmse = np.sqrt(np.mean(error ** 2))
        max_ae = np.max(abs_error)
        mean_re = np.mean(rel_error)
        max_re = np.max(rel_error)

        slope, intercept, r_value, p_value, std_err = stats.linregress(test_moisture, sim_moisture)
        r_squared = r_value ** 2

        valid_points = np.sum(abs_error <= moisture_tolerance)
        pass_rate = valid_points / len(abs_error)

        drying_time_test = self._estimate_drying_time(test_data.time_points, test_moisture)
        drying_time_sim = self._estimate_drying_time(sim_result['time'], sim_moisture)

        result = {
            'test_id': test_id,
            'sim_id': sim_id,
            'comparison_metrics': {
                'mae': mae,
                'mae_percent': mae * 100,
                'rmse': rmse,
                'rmse_percent': rmse * 100,
                'max_absolute_error': max_ae,
                'max_absolute_error_percent': max_ae * 100,
                'mean_relative_error': mean_re,
                'max_relative_error': max_re,
                'r_squared': r_squared,
                'pass_rate': pass_rate,
                'pass_rate_percent': pass_rate * 100
            },
            'drying_time_comparison': {
                'test_drying_time': drying_time_test,
                'test_drying_time_hours': drying_time_test / 3600 if drying_time_test > 0 else -1,
                'sim_drying_time': drying_time_sim,
                'sim_drying_time_hours': drying_time_sim / 3600 if drying_time_sim > 0 else -1,
                'drying_time_error': drying_time_sim - drying_time_test if drying_time_test > 0 and drying_time_sim > 0 else None,
                'drying_time_error_percent': ((drying_time_sim - drying_time_test) / drying_time_test * 100) if drying_time_test > 0 and drying_time_sim > 0 else None
            },
            'time_series': {
                'common_time': common_time,
                'test_moisture': test_moisture,
                'sim_moisture': sim_moisture,
                'error': error
            },
            'validation_level': self._determine_validation_level(mae, r_squared, pass_rate),
            'recommendations': self._generate_validation_recommendations(
                mae, r_squared, pass_rate, test_moisture, sim_moisture
            )
        }

        self.comparison_results[f"{test_id}_vs_{sim_id}"] = result
        return result

    def _estimate_drying_time(self, time: np.ndarray, moisture: np.ndarray, target: float = 0.08) -> float:
        for t, m in zip(time, moisture):
            if m <= target:
                return t
        return -1

    def _determine_validation_level(self, mae: float, r_squared: float, pass_rate: float) -> str:
        score = 0
        if mae < 0.01:
            score += 3
        elif mae < 0.02:
            score += 2
        elif mae < 0.05:
            score += 1

        if r_squared > 0.95:
            score += 3
        elif r_squared > 0.9:
            score += 2
        elif r_squared > 0.8:
            score += 1

        if pass_rate > 0.9:
            score += 3
        elif pass_rate > 0.8:
            score += 2
        elif pass_rate > 0.7:
            score += 1

        if score >= 7:
            return "优秀"
        elif score >= 5:
            return "良好"
        elif score >= 3:
            return "一般"
        else:
            return "较差"

    def _generate_validation_recommendations(
        self,
        mae: float,
        r_squared: float,
        pass_rate: float,
        test_moisture: np.ndarray,
        sim_moisture: np.ndarray
    ) -> List[str]:
        recommendations = []

        if mae > 0.05:
            recommendations.append("【重要】平均绝对误差较大，需要检查模型参数")
            avg_diff = np.mean(sim_moisture - test_moisture)
            if avg_diff > 0:
                recommendations.append("- 仿真含水率普遍偏高，建议检查扩散系数是否偏小")
                recommendations.append("- 建议减小平衡含水率或增加表面传质系数")
            else:
                recommendations.append("- 仿真含水率普遍偏低，建议检查扩散系数是否偏大")
                recommendations.append("- 建议增加平衡含水率或减小表面传质系数")

        elif mae > 0.02:
            recommendations.append("平均绝对误差略大，建议微调模型参数")

        if r_squared < 0.8:
            recommendations.append("拟合优度较低，模型趋势与实验数据存在偏差")
            recommendations.append("- 建议检查干燥机理模型是否适用于当前材料")
            recommendations.append("- 可考虑引入温度依赖的扩散系数修正")

        if pass_rate < 0.7:
            recommendations.append("合格率较低，较多数据点超出容差范围")
            recommendations.append("- 建议检查实验数据测量精度")
            recommendations.append("- 可考虑分段校正模型参数")

        initial_diff = sim_moisture[0] - test_moisture[0]
        if abs(initial_diff) > 0.01:
            recommendations.append(f"初始含水率偏差较大 ({initial_diff*100:.2f}%)")
            recommendations.append("- 建议核对初始条件设置")

        if len(recommendations) == 0:
            recommendations.append("模型验证结果良好，仿真精度满足要求")

        return recommendations

    def compare_multiple_tests(self, test_ids: List[str], sim_ids: List[str]) -> Dict:
        if len(test_ids) != len(sim_ids):
            raise ValueError("测试数据数量与仿真结果数量不匹配")

        all_results = {}
        for test_id, sim_id in zip(test_ids, sim_ids):
            result = self.compare_simulation_test(test_id, sim_id)
            all_results[f"{test_id}_vs_{sim_id}"] = result

        mae_values = [r['comparison_metrics']['mae'] for r in all_results.values()]
        r2_values = [r['comparison_metrics']['r_squared'] for r in all_results.values()]
        pass_rates = [r['comparison_metrics']['pass_rate'] for r in all_results.values()]

        summary = {
            'overall_summary': {
                'total_comparisons': len(all_results),
                'avg_mae': np.mean(mae_values),
                'avg_r_squared': np.mean(r2_values),
                'avg_pass_rate': np.mean(pass_rates),
                'min_mae': np.min(mae_values),
                'max_mae': np.max(mae_values)
            },
            'individual_results': all_results
        }

        return summary

    def generate_calibration_suggestions(self, test_id: str, sim_id: str) -> Dict:
        comparison = self.compare_simulation_test(test_id, sim_id)
        error = comparison['time_series']['error']
        test_moisture = comparison['time_series']['test_moisture']
        sim_moisture = comparison['time_series']['sim_moisture']

        avg_error = np.mean(error)
        error_trend = np.polyfit(np.arange(len(error)), error, 1)[0]

        suggestions = {
            'diffusion_coefficient_adjustment': None,
            'equilibrium_moisture_adjustment': None,
            'mass_transfer_coefficient_adjustment': None,
            'calibration_priority': []
        }

        if abs(avg_error) > 0.01:
            if avg_error > 0:
                dc_factor = 1.2
                suggestions['diffusion_coefficient_adjustment'] = f"增加约 {((dc_factor - 1) * 100):.0f}%"
                suggestions['calibration_priority'].append(('diffusion_coefficient', 'high'))
            else:
                dc_factor = 0.8
                suggestions['diffusion_coefficient_adjustment'] = f"减少约 {((1 - dc_factor) * 100):.0f}%"
                suggestions['calibration_priority'].append(('diffusion_coefficient', 'high'))

        if abs(error_trend) > 0.0001:
            if error_trend > 0:
                suggestions['equilibrium_moisture_adjustment'] = "适当减小平衡含水率"
                suggestions['calibration_priority'].append(('equilibrium_moisture', 'medium'))
            else:
                suggestions['equilibrium_moisture_adjustment'] = "适当增加平衡含水率"
                suggestions['calibration_priority'].append(('equilibrium_moisture', 'medium'))

        if len(suggestions['calibration_priority']) == 0:
            suggestions['message'] = "当前模型参数合理，无需显著调整"

        return suggestions

    def save_comparison_report(self, comparison_key: str, filepath: str):
        if comparison_key not in self.comparison_results:
            raise ValueError(f"对比结果不存在: {comparison_key}")

        result = self.comparison_results[comparison_key]

        serializable_result = {
            'test_id': result['test_id'],
            'sim_id': result['sim_id'],
            'comparison_metrics': result['comparison_metrics'],
            'drying_time_comparison': result['drying_time_comparison'],
            'time_series': {
                'common_time': result['time_series']['common_time'].tolist(),
                'test_moisture': result['time_series']['test_moisture'].tolist(),
                'sim_moisture': result['time_series']['sim_moisture'].tolist(),
                'error': result['time_series']['error'].tolist()
            },
            'validation_level': result['validation_level'],
            'recommendations': result['recommendations']
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(serializable_result, f, indent=2, ensure_ascii=False)

        print(f"对比报告已保存至: {filepath}")

    def create_sample_test_data(self, test_id: str = "sample_test_001") -> DryingTestData:
        time_points = np.linspace(0, 72 * 3600, 25)
        initial_moisture = 0.35
        equilibrium_moisture = 0.05
        time_constant = 24 * 3600

        moisture_data = equilibrium_moisture + (initial_moisture - equilibrium_moisture) * np.exp(-time_points / time_constant)
        moisture_data += np.random.normal(0, 0.005, size=len(moisture_data))

        test_data = DryingTestData(
            test_id=test_id,
            material="raw_lacquer",
            time_points=time_points,
            moisture_data=moisture_data,
            ambient_temp=25.0,
            humidity=60.0,
            thickness=0.001,
            notes="示例测试数据 - 指数衰减模型"
        )

        self.test_datasets[test_id] = test_data
        return test_data
