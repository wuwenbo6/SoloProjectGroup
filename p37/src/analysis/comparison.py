import numpy as np
import pandas as pd
from typing import List, Dict, Tuple
from scipy.spatial.distance import cosine, euclidean
from scipy.stats import ttest_ind
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA


class SingerComparator:
    def __init__(self):
        self.scaler = StandardScaler()

    def compare_two_singers(self, features_df: pd.DataFrame, singer1: str, singer2: str, singer_col: str = 'singer') -> Dict:
        singer1_data = features_df[features_df[singer_col] == singer1]
        singer2_data = features_df[features_df[singer_col] == singer2]

        if len(singer1_data) == 0 or len(singer2_data) == 0:
            raise ValueError(f"找不到传承人数据: {singer1} 或 {singer2}")

        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()

        comparison = {
            'singer1': singer1,
            'singer2': singer2,
            'singer1_samples': len(singer1_data),
            'singer2_samples': len(singer2_data),
            'feature_comparison': {},
            'statistical_tests': {},
            'similarity': {}
        }

        s1_mean = singer1_data[numeric_features].mean()
        s2_mean = singer2_data[numeric_features].mean()

        for feature in numeric_features:
            comparison['feature_comparison'][feature] = {
                f'{singer1}_mean': float(s1_mean[feature]),
                f'{singer2}_mean': float(s2_mean[feature]),
                'difference': float(s1_mean[feature] - s2_mean[feature]),
                'difference_percent': float(abs(s1_mean[feature] - s2_mean[feature]) / max(abs(s1_mean[feature]), abs(s2_mean[feature]), 1e-10) * 100)
            }

            t_stat, p_value = ttest_ind(singer1_data[feature].dropna(), singer2_data[feature].dropna(), equal_var=False)
            comparison['statistical_tests'][feature] = {
                't_statistic': float(t_stat),
                'p_value': float(p_value),
                'significant': p_value < 0.05
            }

        s1_mean_scaled = self.scaler.fit_transform(s1_mean.values.reshape(1, -1))
        s2_mean_scaled = self.scaler.transform(s2_mean.values.reshape(1, -1))

        comparison['similarity']['cosine_similarity'] = 1 - cosine(s1_mean_scaled.flatten(), s2_mean_scaled.flatten())
        comparison['similarity']['euclidean_distance'] = float(euclidean(s1_mean_scaled.flatten(), s2_mean_scaled.flatten()))

        return comparison

    def multi_singer_comparison(self, features_df: pd.DataFrame, singer_col: str = 'singer') -> Dict:
        singers = features_df[singer_col].unique().tolist()
        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()

        comparison = {
            'singers': singers,
            'overall_statistics': {},
            'pairwise_similarity': {},
            'feature_distribution': {}
        }

        stats = features_df.groupby(singer_col)[numeric_features].agg(['mean', 'std', 'min', 'max'])
        comparison['overall_statistics'] = stats.to_dict()

        for i, singer1 in enumerate(singers):
            for singer2 in singers[i+1:]:
                comp = self.compare_two_singers(features_df, singer1, singer2, singer_col)
                comparison['pairwise_similarity'][f'{singer1}_vs_{singer2}'] = comp['similarity']

        for feature in numeric_features:
            comparison['feature_distribution'][feature] = {
                'overall_mean': float(features_df[feature].mean()),
                'overall_std': float(features_df[feature].std()),
                'by_singer': features_df.groupby(singer_col)[feature].mean().to_dict()
            }

        return comparison

    def get_singer_style_profile(self, features_df: pd.DataFrame, singer_col: str = 'singer') -> pd.DataFrame:
        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()
        profiles = features_df.groupby(singer_col)[numeric_features].mean()
        return profiles

    def find_most_similar_singers(self, features_df: pd.DataFrame, target_singer: str, top_k: int = 3, singer_col: str = 'singer') -> List[Tuple[str, float]]:
        profiles = self.get_singer_style_profile(features_df, singer_col)
        scaled_profiles = self.scaler.fit_transform(profiles)

        target_idx = profiles.index.get_loc(target_singer)
        target_vector = scaled_profiles[target_idx]

        similarities = []
        for i, singer in enumerate(profiles.index):
            if singer != target_singer:
                sim = 1 - cosine(target_vector, scaled_profiles[i])
                similarities.append((singer, sim))

        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:top_k]

    def get_discriminative_features(self, features_df: pd.DataFrame, singer_col: str = 'singer', top_k: int = 10) -> List[Tuple[str, float]]:
        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()
        singers = features_df[singer_col].unique()

        f_scores = {}
        for feature in numeric_features:
            group_means = features_df.groupby(singer_col)[feature].mean()
            overall_mean = features_df[feature].mean()
            between_var = sum((gm - overall_mean) ** 2 for gm in group_means) / (len(singers) - 1)
            within_var = features_df.groupby(singer_col)[feature].var().mean()

            if within_var > 0:
                f_scores[feature] = between_var / within_var

        sorted_features = sorted(f_scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_features[:top_k]

    def pca_analysis(self, features_df: pd.DataFrame, singer_col: str = 'singer', n_components: int = 2) -> Dict:
        numeric_features = features_df.select_dtypes(include=[np.number])
        X_scaled = self.scaler.fit_transform(numeric_features)

        pca = PCA(n_components=n_components)
        pca_result = pca.fit_transform(X_scaled)

        result_df = pd.DataFrame(data=pca_result, columns=[f'PC{i+1}' for i in range(n_components)])
        result_df[singer_col] = features_df[singer_col].values

        feature_loadings = pd.DataFrame(pca.components_.T, index=numeric_features.columns, columns=[f'PC{i+1}' for i in range(n_components)])

        return {
            'pca_df': result_df,
            'explained_variance_ratio': pca.explained_variance_ratio_.tolist(),
            'feature_loadings': feature_loadings.to_dict(),
            'cumulative_variance': np.cumsum(pca.explained_variance_ratio_).tolist()
        }

    def generate_comparison_report(self, features_df: pd.DataFrame, singer_col: str = 'singer') -> str:
        multi_comp = self.multi_singer_comparison(features_df, singer_col)
        disc_features = self.get_discriminative_features(features_df, singer_col)

        report = []
        report.append("=" * 60)
        report.append("传承人唱腔对比分析报告")
        report.append("=" * 60)
        report.append(f"\n分析的传承人: {', '.join(multi_comp['singers'])}")
        report.append(f"\n样本数量: {len(features_df)}")

        report.append("\n" + "-" * 60)
        report.append("最具区分度的特征 (Top 10)")
        report.append("-" * 60)
        for i, (feature, score) in enumerate(disc_features, 1):
            report.append(f"{i:2d}. {feature}: {score:.2f}")

        report.append("\n" + "-" * 60)
        report.append("传承人两两相似度")
        report.append("-" * 60)
        for pair, sim in multi_comp['pairwise_similarity'].items():
            report.append(f"{pair}: 余弦相似度={sim['cosine_similarity']:.3f}, 欧氏距离={sim['euclidean_distance']:.3f}")

        return "\n".join(report)
