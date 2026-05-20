import numpy as np
from typing import Dict, List, Tuple, Optional
from scipy import stats
from scipy.interpolate import interp1d
from dataclasses import dataclass
import warnings


@dataclass
class ComparisonMetrics:
    """对比分析指标"""
    rmse: float
    mae: float
    mape: float
    r_squared: float
    correlation: float
    bias: float
    max_deviation: float


@dataclass
class VariableComparison:
    """单变量对比结果"""
    variable_name: str
    simulated_time: np.ndarray
    simulated_values: np.ndarray
    measured_time: np.ndarray
    measured_values: np.ndarray
    aligned_time: np.ndarray
    aligned_simulated: np.ndarray
    aligned_measured: np.ndarray
    metrics: ComparisonMetrics
    trend_agreement: str


class SimulationDataComparator:
    """仿真与实际数据对比分析器"""

    def __init__(self):
        self.comparison_results: Dict[str, VariableComparison] = {}

    def _align_data(self, sim_time: np.ndarray, sim_values: np.ndarray,
                    meas_time: np.ndarray, meas_values: np.ndarray) -> Tuple:
        """对齐仿真与实测数据时间轴"""
        sim_time = np.asarray(sim_time)
        sim_values = np.asarray(sim_values)
        meas_time = np.asarray(meas_time)
        meas_values = np.asarray(meas_values)

        min_time = max(sim_time.min(), meas_time.min())
        max_time = min(sim_time.max(), meas_time.max())

        if min_time >= max_time:
            raise ValueError("仿真数据和实测数据没有重叠的时间范围")

        sim_interp = interp1d(sim_time, sim_values, kind='linear', fill_value='extrapolate')

        common_mask = (meas_time >= min_time) & (meas_time <= max_time)
        aligned_time = meas_time[common_mask]
        aligned_measured = meas_values[common_mask]
        aligned_simulated = sim_interp(aligned_time)

        return aligned_time, aligned_simulated, aligned_measured

    def _calculate_metrics(self, simulated: np.ndarray, measured: np.ndarray) -> ComparisonMetrics:
        """计算对比评估指标"""
        simulated = np.asarray(simulated, dtype=np.float64)
        measured = np.asarray(measured, dtype=np.float64)

        valid_mask = ~(np.isnan(simulated) | np.isnan(measured))
        sim_valid = simulated[valid_mask]
        meas_valid = measured[valid_mask]

        if len(sim_valid) < 2:
            return ComparisonMetrics(
                rmse=np.nan, mae=np.nan, mape=np.nan,
                r_squared=np.nan, correlation=np.nan,
                bias=np.nan, max_deviation=np.nan
            )

        residuals = sim_valid - meas_valid
        rmse = np.sqrt(np.mean(residuals ** 2))
        mae = np.mean(np.abs(residuals))

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            mape = np.mean(np.abs(residuals / np.where(meas_valid != 0, meas_valid, 1e-10))) * 100

        correlation = np.corrcoef(sim_valid, meas_valid)[0, 1] if len(sim_valid) > 1 else 0.0

        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((meas_valid - np.mean(meas_valid)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0.0

        bias = np.mean(residuals)
        max_deviation = np.max(np.abs(residuals))

        return ComparisonMetrics(
            rmse=float(rmse),
            mae=float(mae),
            mape=float(mape),
            r_squared=float(r_squared),
            correlation=float(correlation),
            bias=float(bias),
            max_deviation=float(max_deviation)
        )

    def _assess_trend_agreement(self, sim_values: np.ndarray, meas_values: np.ndarray) -> str:
        """评估趋势一致性"""
        if len(sim_values) < 3:
            return "数据不足"

        sim_slope, _, sim_r, _, _ = stats.linregress(np.arange(len(sim_values)), sim_values)
        meas_slope, _, meas_r, _, _ = stats.linregress(np.arange(len(meas_values)), meas_values)

        sim_sign = np.sign(sim_slope)
        meas_sign = np.sign(meas_slope)

        if sim_sign == meas_sign and abs(sim_r) > 0.7 and abs(meas_r) > 0.7:
            return "高度一致"
        elif sim_sign == meas_sign:
            return "趋势一致"
        elif abs(sim_sign - meas_sign) < 0.5:
            return "趋势基本一致"
        else:
            return "趋势不一致"

    def compare_variable(self, var_name: str,
                         sim_time: np.ndarray, sim_values: np.ndarray,
                         meas_time: np.ndarray, meas_values: np.ndarray) -> VariableComparison:
        """对比单变量"""
        aligned_time, aligned_sim, aligned_meas = self._align_data(
            sim_time, sim_values, meas_time, meas_values
        )

        metrics = self._calculate_metrics(aligned_sim, aligned_meas)
        trend_agreement = self._assess_trend_agreement(aligned_sim, aligned_meas)

        result = VariableComparison(
            variable_name=var_name,
            simulated_time=sim_time,
            simulated_values=sim_values,
            measured_time=meas_time,
            measured_values=meas_values,
            aligned_time=aligned_time,
            aligned_simulated=aligned_sim,
            aligned_measured=aligned_meas,
            metrics=metrics,
            trend_agreement=trend_agreement
        )

        self.comparison_results[var_name] = result
        return result

    def compare_simulation_results(self, sim_results: Dict,
                                    measured_data: Dict[str, Dict[str, np.ndarray]]) -> Dict:
        """对比完整仿真结果"""
        if "time" not in sim_results:
            raise ValueError("仿真结果缺少time字段")

        sim_time = sim_results["time"]
        results = {}

        for var_name, data in measured_data.items():
            if "time" not in data or "values" not in data:
                continue

            sim_values = None
            if "state_names" in sim_results and "states" in sim_results:
                for i, name in enumerate(sim_results["state_names"]):
                    if var_name in name or name in var_name:
                        sim_values = sim_results["states"][i]
                        break

            if sim_values is None:
                continue

            comparison = self.compare_variable(
                var_name,
                sim_time, sim_values,
                data["time"], data["values"]
            )
            results[var_name] = comparison

        return results

    def generate_comparison_report(self) -> str:
        """生成对比分析报告"""
        if not self.comparison_results:
            return "未进行对比分析"

        report = ["📊 仿真与实测数据对比分析报告\n"]

        overall_mape = []
        overall_r2 = []

        for var_name, result in self.comparison_results.items():
            metrics = result.metrics
            report.append(f"\n{'='*50}")
            report.append(f"变量: {var_name}")
            report.append(f"趋势一致性: {result.trend_agreement}")
            report.append(f"对齐数据点数: {len(result.aligned_time)}")
            report.append(f"\n统计指标:")
            report.append(f"  RMSE (均方根误差): {metrics.rmse:.4f}")
            report.append(f"  MAE (平均绝对误差): {metrics.mae:.4f}")
            report.append(f"  MAPE (相对误差): {metrics.mape:.2f}%")
            report.append(f"  R² (决定系数): {metrics.r_squared:.4f}")
            report.append(f"  相关系数: {metrics.correlation:.4f}")
            report.append(f"  系统偏差: {metrics.bias:.4f}")
            report.append(f"  最大偏差: {metrics.max_deviation:.4f}")

            if not np.isnan(metrics.mape):
                overall_mape.append(metrics.mape)
            if not np.isnan(metrics.r_squared):
                overall_r2.append(metrics.r_squared)

        if overall_mape and overall_r2:
            report.append(f"\n{'='*50}")
            report.append("整体评价:")
            avg_mape = np.mean(overall_mape)
            avg_r2 = np.mean(overall_r2)
            report.append(f"  平均相对误差 (MAPE): {avg_mape:.2f}%")
            report.append(f"  平均决定系数 (R²): {avg_r2:.4f}")

            if avg_mape < 5 and avg_r2 > 0.95:
                quality = "优秀"
            elif avg_mape < 10 and avg_r2 > 0.9:
                quality = "良好"
            elif avg_mape < 20 and avg_r2 > 0.8:
                quality = "一般"
            else:
                quality = "需要改进"
            report.append(f"  模型拟合质量: {quality}")

        return "\n".join(report)


class ModelCalibrator:
    """模型校准器"""

    def __init__(self):
        self.calibration_factors: Dict[str, float] = {}
        self.calibration_history = []

    def suggest_calibration_factor(self, variable_name: str,
                                    simulated_values: np.ndarray,
                                    measured_values: np.ndarray) -> float:
        """建议校准因子"""
        ratio = measured_values / (simulated_values + 1e-10)
        factor = np.median(ratio)
        self.calibration_factors[variable_name] = float(factor)
        return float(factor)

    def apply_calibration(self, simulated_values: np.ndarray,
                          calibration_factor: float) -> np.ndarray:
        """应用校准"""
        return simulated_values * calibration_factor

    def get_calibration_summary(self) -> Dict:
        """获取校准摘要"""
        return {
            "calibration_factors": self.calibration_factors,
            "calibration_count": len(self.calibration_factors)
        }


class PerformanceTracker:
    """模型性能追踪器"""

    def __init__(self):
        self.performance_history: List[Dict] = []

    def record_performance(self, batch_id: str, metrics: ComparisonMetrics):
        """记录性能"""
        self.performance_history.append({
            "batch_id": batch_id,
            "metrics": metrics.__dict__
        })

    def get_performance_trend(self) -> Dict:
        """获取性能趋势"""
        if not self.performance_history:
            return {}

        r2_values = [p["metrics"].get("r_squared", np.nan) for p in self.performance_history]
        mape_values = [p["metrics"].get("mape", np.nan) for p in self.performance_history]

        return {
            "batch_count": len(self.performance_history),
            "mean_r2": np.nanmean(r2_values),
            "trend_r2": "improving" if len(r2_values) > 1 and r2_values[-1] > r2_values[0] else "stable",
            "mean_mape": np.nanmean(mape_values),
            "trend_mape": "improving" if len(mape_values) > 1 and mape_values[-1] < mape_values[0] else "stable"
        }
