import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from scipy import stats
from scipy.interpolate import interp1d
from enum import Enum
import warnings


class ComparisonMetric(Enum):
    """对比指标类型"""
    TEMPERATURE = "temperature"
    PH = "ph"
    SUGAR = "sugar_concentration"
    ALCOHOL = "alcohol_content"
    BIOMASS = "biomass"
    ACIDITY = "acidity"


@dataclass
class BatchSummary:
    """批次摘要数据"""
    batch_id: str
    product_type: str
    duration_hours: float
    success: bool
    key_metrics: Dict[str, float]


@dataclass
class VariableComparisonResult:
    """单变量对比结果"""
    variable_name: str
    batch_ids: List[str]
    mean_values: Dict[str, float]
    std_values: Dict[str, float]
    min_values: Dict[str, float]
    max_values: Dict[str, float]
    final_values: Dict[str, float]
    cv_values: Dict[str, float]
    similarity_matrix: np.ndarray
    time_aligned_data: Dict[str, Tuple[np.ndarray, np.ndarray]]


@dataclass
class BatchGroupReport:
    """批次组分析报告"""
    group_name: str
    n_batches: int
    overall_success_rate: float
    avg_duration: float
    std_duration: float
    variable_comparisons: Dict[str, VariableComparisonResult]
    outliers: List[str]
    best_practices: List[str]
    recommendations: List[str]


class BatchDataNormalizer:
    """批次数据归一化器"""

    @staticmethod
    def normalize_time_series(time: np.ndarray, values: np.ndarray,
                               target_length: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """将时间序列归一化到统一长度"""
        t_normalized = np.linspace(0, 100, target_length)
        t_scaled = (time - time.min()) / (time.max() - time.min() + 1e-10) * 100

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            interpolator = interp1d(t_scaled, values, kind='linear',
                                     bounds_error=False, fill_value='extrapolate')
            values_normalized = interpolator(t_normalized)

        return t_normalized, values_normalized

    @staticmethod
    def z_score_normalize(values: np.ndarray) -> Tuple[np.ndarray, float, float]:
        """Z-score归一化"""
        mean_val = np.mean(values)
        std_val = np.std(values)
        if std_val == 0:
            return values - mean_val, mean_val, 1.0
        return (values - mean_val) / std_val, mean_val, std_val


class MultiBatchComparator:
    """多批次数据对比分析器"""

    def __init__(self, batches: List):
        self.batches = batches
        self.batch_ids = [b.batch_id for b in batches] if batches else []
        self.normalizer = BatchDataNormalizer()
        self.comparison_results: Dict[str, VariableComparisonResult] = {}

    def extract_variable(self, batch, var_name: str) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        """从批次数据中提取变量"""
        time_series = getattr(batch, 'time_series', {})

        time_key = None
        for key in time_series.keys():
            if 'time' in key.lower() or 'hour' in key.lower():
                time_key = key
                break

        if time_key is None:
            return None, None

        var_key = None
        for key in time_series.keys():
            if var_name.lower() in key.lower():
                var_key = key
                break

        if var_key is None:
            return None, None

        return time_series[time_key], time_series[var_key]

    def compare_variable(self, var_name: str, normalize: bool = True) -> VariableComparisonResult:
        """对比单个变量在所有批次中的表现"""
        batch_data = {}
        aligned_data = {}

        for batch in self.batches:
            time, values = self.extract_variable(batch, var_name)
            if time is None or values is None:
                continue

            if normalize and len(values) > 1:
                t_norm, v_norm = self.normalizer.normalize_time_series(time, values)
                aligned_data[batch.batch_id] = (t_norm, v_norm)
            else:
                aligned_data[batch.batch_id] = (time, values)

        batch_ids = list(aligned_data.keys())
        n_batches = len(batch_ids)

        mean_values = {}
        std_values = {}
        min_values = {}
        max_values = {}
        final_values = {}
        cv_values = {}

        for bid in batch_ids:
            _, values = aligned_data[bid]
            mean_values[bid] = float(np.mean(values))
            std_values[bid] = float(np.std(values))
            min_values[bid] = float(np.min(values))
            max_values[bid] = float(np.max(values))
            final_values[bid] = float(values[-1]) if len(values) > 0 else np.nan
            cv_values[bid] = float(std_values[bid] / (mean_values[bid] + 1e-10) * 100)

        similarity = np.zeros((n_batches, n_batches))
        for i, bid1 in enumerate(batch_ids):
            for j, bid2 in enumerate(batch_ids):
                if i == j:
                    similarity[i, j] = 1.0
                else:
                    _, v1 = aligned_data[bid1]
                    _, v2 = aligned_data[bid2]
                    min_len = min(len(v1), len(v2))
                    correlation = np.corrcoef(v1[:min_len], v2[:min_len])[0, 1]
                    similarity[i, j] = float(correlation) if not np.isnan(correlation) else 0.0

        result = VariableComparisonResult(
            variable_name=var_name,
            batch_ids=batch_ids,
            mean_values=mean_values,
            std_values=std_values,
            min_values=min_values,
            max_values=max_values,
            final_values=final_values,
            cv_values=cv_values,
            similarity_matrix=similarity,
            time_aligned_data=aligned_data
        )

        self.comparison_results[var_name] = result
        return result

    def compare_all_variables(self) -> Dict[str, VariableComparisonResult]:
        """对比所有可用变量"""
        if not self.batches:
            return {}

        all_vars = set()
        for batch in self.batches:
            if hasattr(batch, 'time_series'):
                all_vars.update(batch.time_series.keys())

        results = {}
        for var in all_vars:
            if 'time' not in var.lower() and 'hour' not in var.lower():
                results[var] = self.compare_variable(var)

        return results

    def identify_outliers(self, var_name: str, threshold: float = 2.0) -> List[str]:
        """识别异常批次"""
        if var_name not in self.comparison_results:
            self.compare_variable(var_name)

        result = self.comparison_results[var_name]
        final_values = list(result.final_values.values())

        if not final_values:
            return []

        z_scores = np.abs(stats.zscore(final_values))
        outliers = [
            bid for i, bid in enumerate(result.batch_ids)
            if not np.isnan(z_scores[i]) and z_scores[i] > threshold
        ]

        return outliers

    def compute_consistency_score(self, var_name: str) -> float:
        """计算批次一致性得分"""
        if var_name not in self.comparison_results:
            self.compare_variable(var_name)

        result = self.comparison_results[var_name]
        cv_values = list(result.cv_values.values())

        if not cv_values or np.mean(cv_values) == 0:
            return 1.0

        avg_cv = np.mean(cv_values)
        consistency = max(0.0, 1.0 - avg_cv / 50.0)

        return float(consistency)

    def find_best_performer(self, var_name: str, maximize: bool = True) -> Optional[str]:
        """找出表现最佳的批次"""
        if var_name not in self.comparison_results:
            self.compare_variable(var_name)

        result = self.comparison_results[var_name]
        if not result.batch_ids:
            return None

        if maximize:
            best_idx = np.argmax(list(result.final_values.values()))
        else:
            best_idx = np.argmin(list(result.final_values.values()))

        return result.batch_ids[best_idx]


class BatchBenchmarker:
    """批次基准分析器"""

    def __init__(self, reference_batches: List):
        self.reference = reference_batches
        self.comparator = MultiBatchComparator(reference_batches)
        self.reference_stats: Dict[str, Dict] = {}

    def build_reference_profile(self, var_names: List[str]) -> Dict[str, Dict]:
        """建立基准参考轮廓"""
        for var_name in var_names:
            self.comparator.compare_variable(var_name)

        for var_name, result in self.comparator.comparison_results.items():
            values_list = list(result.final_values.values())
            self.reference_stats[var_name] = {
                'mean': float(np.mean(values_list)) if values_list else 0.0,
                'std': float(np.std(values_list)) if values_list else 1.0,
                'p25': float(np.percentile(values_list, 25)) if values_list else 0.0,
                'p50': float(np.percentile(values_list, 50)) if values_list else 0.0,
                'p75': float(np.percentile(values_list, 75)) if values_list else 0.0,
                'n': len(values_list)
            }

        return self.reference_stats

    def benchmark_batch(self, test_batch, var_names: List[str]) -> Dict[str, Dict]:
        """对标单个批次"""
        benchmark_results = {}

        for var_name in var_names:
            _, values = self.comparator.extract_variable(test_batch, var_name)
            if values is None:
                continue

            ref_stats = self.reference_stats.get(var_name, {})
            if not ref_stats:
                continue

            final_value = float(values[-1])
            ref_mean = ref_stats.get('mean', 0)
            ref_std = ref_stats.get('std', 1)
            z_score = (final_value - ref_mean) / (ref_std + 1e-10)

            percentile = stats.percentileofscore(
                [result.final_values.get(bid, 0) for bid, result in
                 self.comparator.comparison_results.items()
                 if var_name in self.comparator.comparison_results
                 for result in [self.comparator.comparison_results[var_name]]
                 if hasattr(result, 'final_values')],
                final_value
            )

            benchmark_results[var_name] = {
                'final_value': final_value,
                'reference_mean': ref_mean,
                'reference_std': ref_std,
                'z_score': float(z_score),
                'percentile': float(percentile),
                'within_1std': abs(z_score) < 1.0,
                'within_2std': abs(z_score) < 2.0,
                'deviation_pct': float((final_value - ref_mean) / (ref_mean + 1e-10) * 100)
            }

        return benchmark_results


class TrendAnalyzer:
    """趋势分析器"""

    def __init__(self, batches_ordered: List):
        self.batches = batches_ordered
        self.trends: Dict[str, Dict] = {}

    def analyze_trend(self, var_name: str, metric: str = 'final') -> Dict:
        """分析变量的时间趋势"""
        values = []
        valid_batches = []

        for batch in self.batches:
            time, var_values = self.comparator.extract_variable(batch, var_name) \
                if hasattr(self, 'comparator') else (None, None)

            if not hasattr(self, 'comparator'):
                self.comparator = MultiBatchComparator(self.batches)

            if var_values is not None and len(var_values) > 0:
                if metric == 'final':
                    values.append(float(var_values[-1]))
                elif metric == 'mean':
                    values.append(float(np.mean(var_values)))
                elif metric == 'max':
                    values.append(float(np.max(var_values)))
                valid_batches.append(batch.batch_id)

        if len(values) < 3:
            return {'status': 'insufficient_data'}

        x = np.arange(len(values))
        slope, intercept, r_value, p_value, std_err = stats.linregress(x, values)

        trend = {
            'slope': float(slope),
            'intercept': float(intercept),
            'r_squared': float(r_value ** 2),
            'p_value': float(p_value),
            'std_error': float(std_err),
            'trend_direction': 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable',
            'significant': p_value < 0.05,
            'values': values,
            'batch_ids': valid_batches
        }

        self.trends[var_name] = trend
        return trend


class ReportGenerator:
    """报告生成器"""

    @staticmethod
    def generate_comparison_report(comparator: MultiBatchComparator) -> str:
        """生成对比分析报告"""
        lines = ["📊 多批次发酵对比分析报告", "=" * 50]

        lines.append(f"\n批次数量: {len(comparator.batches)}")
        lines.append(f"分析变量: {len(comparator.comparison_results)} 个")

        for var_name, result in comparator.comparison_results.items():
            lines.append(f"\n--- {var_name} 对比 ---")
            lines.append(f"有效批次: {len(result.batch_ids)}")

            mean_vals = list(result.mean_values.values())
            cv_vals = list(result.cv_values.values())

            lines.append(f"均值范围: {min(mean_vals):.4f} ~ {max(mean_vals):.4f}")
            lines.append(f"平均变异系数: {np.mean(cv_vals):.2f}%")

            outliers = comparator.identify_outliers(var_name)
            if outliers:
                lines.append(f"异常批次: {', '.join(outliers)}")
            else:
                lines.append("异常批次: 无")

        if 'temperature' in comparator.comparison_results:
            consistency = comparator.compute_consistency_score('temperature')
            lines.append(f"\n温度控制一致性得分: {consistency:.2%}")

        if 'alcohol' in comparator.comparison_results or 'sugar' in comparator.comparison_results:
            best_alcohol = comparator.find_best_performer('alcohol', maximize=True)
            if best_alcohol:
                lines.append(f"酒精产量最高批次: {best_alcohol}")

        return "\n".join(lines)

    @staticmethod
    def generate_benchmark_report(benchmark_results: Dict[str, Dict]) -> str:
        """生成对标分析报告"""
        lines = ["🎯 批次对标分析报告", "=" * 50]

        within_spec = []
        out_of_spec = []

        for var_name, result in benchmark_results.items():
            lines.append(f"\n--- {var_name} ---")
            lines.append(f"实测值: {result['final_value']:.4f}")
            lines.append(f"参考均值: {result['reference_mean']:.4f} ± {result['reference_std']:.4f}")
            lines.append(f"Z-score: {result['z_score']:.2f}")
            lines.append(f"百分位: {result['percentile']:.1f}%")
            lines.append(f"偏差幅度: {result['deviation_pct']:.1f}%")

            if result['within_2std']:
                within_spec.append(var_name)
                status = "✅ 在正常范围内"
            else:
                out_of_spec.append(var_name)
                status = "⚠️ 显著偏离基准"
            lines.append(f"判定: {status}")

        lines.append(f"\n{'='*50}")
        lines.append(f"符合基准指标: {len(within_spec)}/{len(benchmark_results)}")
        if out_of_spec:
            lines.append(f"需要关注指标: {', '.join(out_of_spec)}")

        return "\n".join(lines)
