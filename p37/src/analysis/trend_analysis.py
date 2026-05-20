import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from scipy.stats import pearsonr, spearmanr
import warnings


class TrendAnalyzer:
    def __init__(self):
        self.scaler = StandardScaler()

    def analyze_time_trend(self, features_df: pd.DataFrame, year_col: str = 'year') -> Dict:
        if year_col not in features_df.columns:
            raise ValueError(f"数据中缺少年份列: {year_col}")

        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()
        if year_col in numeric_features:
            numeric_features.remove(year_col)

        results = {
            'year_range': (int(features_df[year_col].min()), int(features_df[year_col].max())),
            'total_samples': len(features_df),
            'feature_trends': {},
            'overall_trend_summary': {}
        }

        for feature in numeric_features:
            trend_data = self._calculate_single_trend(features_df, year_col, feature)
            results['feature_trends'][feature] = trend_data

        increasing_features = [f for f, t in results['feature_trends'].items() if t['trend'] == 'increasing']
        decreasing_features = [f for f, t in results['feature_trends'].items() if t['trend'] == 'decreasing']
        stable_features = [f for f, t in results['feature_trends'].items() if t['trend'] == 'stable']

        results['overall_trend_summary'] = {
            'increasing_features': increasing_features,
            'decreasing_features': decreasing_features,
            'stable_features': stable_features,
            'num_increasing': len(increasing_features),
            'num_decreasing': len(decreasing_features),
            'num_stable': len(stable_features)
        }

        return results

    def _calculate_single_trend(self, df: pd.DataFrame, year_col: str, feature: str) -> Dict:
        year_feature = df.groupby(year_col)[feature].agg(['mean', 'std', 'count']).reset_index()
        year_feature = year_feature[year_feature['count'] >= 3]

        if len(year_feature) < 3:
            return {
                'trend': 'insufficient_data',
                'message': '样本数量不足，无法计算趋势'
            }

        X = year_feature[year_col].values.reshape(-1, 1)
        y = year_feature['mean'].values

        model = LinearRegression()
        model.fit(X, y)

        slope = model.coef_[0]
        r_squared = model.score(X, y)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pearson_corr, pearson_p = pearsonr(year_feature[year_col], year_feature['mean'])
            spearman_corr, spearman_p = spearmanr(year_feature[year_col], year_feature['mean'])

        if abs(pearson_corr) >= 0.5 and pearson_p < 0.05:
            if slope > 0:
                trend = 'increasing'
            else:
                trend = 'decreasing'
        else:
            trend = 'stable'

        return {
            'trend': trend,
            'slope': float(slope),
            'r_squared': float(r_squared),
            'pearson_correlation': float(pearson_corr),
            'pearson_p_value': float(pearson_p),
            'spearman_correlation': float(spearman_corr),
            'spearman_p_value': float(spearman_p),
            'yearly_data': year_feature.to_dict(orient='records'),
            'slope_percentage': float(abs(slope) / np.mean(y) * 100) if np.mean(y) != 0 else 0
        }

    def compare_periods(self, features_df: pd.DataFrame, period1_start: int, period1_end: int,
                        period2_start: int, period2_end: int, year_col: str = 'year') -> Dict:
        period1_data = features_df[(features_df[year_col] >= period1_start) & (features_df[year_col] <= period1_end)]
        period2_data = features_df[(features_df[year_col] >= period2_start) & (features_df[year_col] <= period2_end)]

        if len(period1_data) == 0 or len(period2_data) == 0:
            raise ValueError("某个时间段内没有数据")

        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()
        if year_col in numeric_features:
            numeric_features.remove(year_col)

        comparison = {
            'period1': f"{period1_start}-{period1_end}",
            'period2': f"{period2_start}-{period2_end}",
            'period1_samples': len(period1_data),
            'period2_samples': len(period2_data),
            'feature_comparison': {}
        }

        for feature in numeric_features:
            p1_mean = period1_data[feature].mean()
            p2_mean = period2_data[feature].mean()
            p1_std = period1_data[feature].std()
            p2_std = period2_data[feature].std()

            change_percent = (p2_mean - p1_mean) / max(abs(p1_mean), 1e-10) * 100

            from scipy.stats import ttest_ind
            t_stat, p_value = ttest_ind(period1_data[feature].dropna(), period2_data[feature].dropna(), equal_var=False)

            comparison['feature_comparison'][feature] = {
                'period1_mean': float(p1_mean),
                'period2_mean': float(p2_mean),
                'period1_std': float(p1_std),
                'period2_std': float(p2_std),
                'change_percent': float(change_percent),
                'absolute_change': float(p2_mean - p1_mean),
                't_statistic': float(t_stat),
                'p_value': float(p_value),
                'significant': p_value < 0.05
            }

        return comparison

    def detect_style_evolution(self, features_df: pd.DataFrame, year_col: str = 'year', window_size: int = 5) -> Dict:
        years = sorted(features_df[year_col].unique())
        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()
        if year_col in numeric_features:
            numeric_features.remove(year_col)

        evolution_data = []
        for year in years:
            window_data = features_df[(features_df[year_col] >= year - window_size // 2) &
                                      (features_df[year_col] <= year + window_size // 2)]
            if len(window_data) >= 5:
                year_stats = window_data[numeric_features].mean().to_dict()
                year_stats['year'] = year
                year_stats['sample_count'] = len(window_data)
                evolution_data.append(year_stats)

        evolution_df = pd.DataFrame(evolution_data)

        if len(evolution_df) < 3:
            return {'message': '数据点不足，无法检测风格演变'}

        feature_changes = {}
        for feature in numeric_features:
            if feature in evolution_df.columns:
                first_value = evolution_df[feature].iloc[0]
                last_value = evolution_df[feature].iloc[-1]
                total_change = last_value - first_value
                change_percent = total_change / max(abs(first_value), 1e-10) * 100

                feature_changes[feature] = {
                    'total_absolute_change': float(total_change),
                    'total_percent_change': float(change_percent),
                    'start_value': float(first_value),
                    'end_value': float(last_value)
                }

        X_scaled = self.scaler.fit_transform(evolution_df[numeric_features])
        from sklearn.metrics.pairwise import cosine_similarity

        similarities = []
        for i in range(1, len(X_scaled)):
            sim = cosine_similarity(X_scaled[i-1:i], X_scaled[i:i+1])[0][0]
            similarities.append({
                'year1': evolution_df['year'].iloc[i-1],
                'year2': evolution_df['year'].iloc[i],
                'similarity': float(sim)
            })

        return {
            'evolution_df': evolution_df.to_dict(orient='records'),
            'feature_changes': feature_changes,
            'yearly_similarities': similarities,
            'overall_style_change': 1 - np.mean([s['similarity'] for s in similarities])
        }

    def predict_future_trend(self, features_df: pd.DataFrame, feature: str, future_years: List[int],
                             year_col: str = 'year') -> Dict:
        year_feature = features_df.groupby(year_col)[feature].mean().reset_index()

        X = year_feature[year_col].values.reshape(-1, 1)
        y = year_feature[feature].values

        model = LinearRegression()
        model.fit(X, y)

        future_X = np.array(future_years).reshape(-1, 1)
        predictions = model.predict(future_X)

        return {
            'feature': feature,
            'historical_years': year_feature[year_col].tolist(),
            'historical_values': year_feature[feature].tolist(),
            'predicted_years': future_years,
            'predicted_values': predictions.tolist(),
            'slope': float(model.coef_[0]),
            'intercept': float(model.intercept_),
            'r_squared': float(model.score(X, y))
        }

    def generate_trend_report(self, features_df: pd.DataFrame, year_col: str = 'year') -> str:
        trend_results = self.analyze_time_trend(features_df, year_col)

        report = []
        report.append("=" * 60)
        report.append("唱腔演变趋势分析报告")
        report.append("=" * 60)
        report.append(f"\n分析时间范围: {trend_results['year_range'][0]} - {trend_results['year_range'][1]}")
        report.append(f"总样本数量: {trend_results['total_samples']}")

        report.append("\n" + "-" * 60)
        report.append("特征变化趋势汇总")
        report.append("-" * 60)
        report.append(f"显著上升的特征数量: {trend_results['overall_trend_summary']['num_increasing']}")
        report.append(f"显著下降的特征数量: {trend_results['overall_trend_summary']['num_decreasing']}")
        report.append(f"趋势稳定的特征数量: {trend_results['overall_trend_summary']['num_stable']}")

        if trend_results['overall_trend_summary']['increasing_features']:
            report.append("\n显著上升的特征:")
            for f in trend_results['overall_trend_summary']['increasing_features'][:5]:
                trend = trend_results['feature_trends'][f]
                report.append(f"  - {f}: {trend['slope_percentage']:.2f}%/年 (r={trend['pearson_correlation']:.2f})")

        if trend_results['overall_trend_summary']['decreasing_features']:
            report.append("\n显著下降的特征:")
            for f in trend_results['overall_trend_summary']['decreasing_features'][:5]:
                trend = trend_results['feature_trends'][f]
                report.append(f"  - {f}: -{trend['slope_percentage']:.2f}%/年 (r={trend['pearson_correlation']:.2f})")

        return "\n".join(report)
