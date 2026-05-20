import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from scipy import stats
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import json
from datetime import datetime


class EvolutionAnalyzer:
    def __init__(self, db_session):
        self.db = db_session
        self.scaler = StandardScaler()

    def analyze_heritor_evolution(self, heritor_id: int, min_samples: int = 3) -> Dict:
        from ..database.models import AudioData, FeatureData, Heritor

        heritor = self.db.query(Heritor).get(heritor_id)
        if not heritor:
            return {'error': 'Heritor not found'}

        audios = self.db.query(AudioData).filter(
            AudioData.heritor_id == heritor_id,
            AudioData.year.isnot(None),
            AudioData.features.isnot(None)
        ).order_by(AudioData.year).all()

        if len(audios) < min_samples:
            return {
                'error': f'Insufficient data: need at least {min_samples} samples',
                'available_samples': len(audios)
            }

        feature_data = []
        for audio in audios:
            features = self._extract_feature_vector(audio.features)
            features['year'] = audio.year
            features['decade'] = audio.decade or (audio.year // 10) * 10
            features['audio_id'] = audio.id
            feature_data.append(features)

        df = pd.DataFrame(feature_data)

        feature_columns = [c for c in df.columns if c not in ['year', 'decade', 'audio_id']]

        temporal_analysis = self._analyze_temporal_trends(df, feature_columns)
        period_comparison = self._analyze_period_changes(df, feature_columns)
        style_evolution = self._analyze_style_evolution(df, feature_columns)

        result = {
            'heritor_id': heritor_id,
            'heritor_name': heritor.name,
            'analysis_period': {
                'start_year': int(df['year'].min()),
                'end_year': int(df['year'].max()),
                'span_years': int(df['year'].max() - df['year'].min()),
                'total_samples': len(df)
            },
            'temporal_trends': temporal_analysis,
            'period_comparison': period_comparison,
            'style_evolution': style_evolution,
            'key_insights': self._generate_insights(temporal_analysis, style_evolution)
        }

        return result

    def _extract_feature_vector(self, feature_data) -> Dict:
        features = {}
        feature_keys = [
            'pitch_mean', 'pitch_std', 'pitch_range',
            'tempo', 'rms_mean', 'rms_std',
            'spectral_centroid_mean', 'spectral_bandwidth_mean',
            'spectral_rolloff_mean', 'spectral_flatness_mean',
            'zero_crossing_rate_mean'
        ]

        for key in feature_keys:
            if hasattr(feature_data, key):
                val = getattr(feature_data, key)
                features[key] = float(val) if val is not None else np.nan

        return features

    def _analyze_temporal_trends(self, df: pd.DataFrame, feature_cols: List[str]) -> Dict:
        trends = {}

        for col in feature_cols:
            valid_data = df[[col, 'year']].dropna()
            if len(valid_data) < 3:
                continue

            x = valid_data['year'].values
            y = valid_data[col].values

            slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

            trends[col] = {
                'slope': float(slope),
                'intercept': float(intercept),
                'r_squared': float(r_value ** 2),
                'p_value': float(p_value),
                'trend_direction': 'increasing' if slope > 0 else 'decreasing' if slope < 0 else 'stable',
                'correlation_strength': 'strong' if abs(r_value) > 0.7 else 'moderate' if abs(r_value) > 0.4 else 'weak',
                'is_significant': p_value < 0.05
            }

        return trends

    def _analyze_period_changes(self, df: pd.DataFrame, feature_cols: List[str]) -> Dict:
        decades = sorted(df['decade'].unique())

        if len(decades) < 2:
            return {'message': 'Need at least 2 decades for comparison'}

        period_comparison = {
            'decades': decades,
            'feature_means_by_decade': {},
            'relative_changes': {}
        }

        for col in feature_cols:
            decade_means = {}
            for decade in decades:
                mean_val = df[df['decade'] == decade][col].mean()
                if not np.isnan(mean_val):
                    decade_means[str(int(decade))] = float(mean_val)

            period_comparison['feature_means_by_decade'][col] = decade_means

            if len(decade_means) >= 2:
                decade_list = sorted(decade_means.keys())
                first_val = decade_means[decade_list[0]]
                last_val = decade_means[decade_list[-1]]

                if first_val != 0:
                    relative_change = ((last_val - first_val) / abs(first_val)) * 100
                    period_comparison['relative_changes'][col] = {
                        'change_percent': float(relative_change),
                        'from_decade': decade_list[0],
                        'to_decade': decade_list[-1]
                    }

        return period_comparison

    def _analyze_style_evolution(self, df: pd.DataFrame, feature_cols: List[str]) -> Dict:
        valid_data = df[feature_cols].dropna()
        if len(valid_data) < 3:
            return {'message': 'Insufficient data for style evolution analysis'}

        X = self.scaler.fit_transform(valid_data)

        n_components = min(2, len(feature_cols), len(valid_data))
        pca = PCA(n_components=n_components)
        pca_result = pca.fit_transform(X)

        for i in range(n_components):
            df[f'PC{i+1}'] = pca_result[:, i]

        n_clusters = min(3, len(valid_data) // 2)
        if n_clusters >= 2:
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            df['cluster'] = kmeans.fit_predict(X)

            cluster_by_year = df.groupby('year')['cluster'].agg(
                lambda x: x.mode().iloc[0] if len(x) > 0 else np.nan
            ).dropna()

            cluster_transitions = []
            years = sorted(cluster_by_year.index)
            for i in range(1, len(years)):
                prev_cluster = cluster_by_year[years[i-1]]
                curr_cluster = cluster_by_year[years[i]]
                if prev_cluster != curr_cluster:
                    cluster_transitions.append({
                        'transition_year': int(years[i]),
                        'from_cluster': int(prev_cluster),
                        'to_cluster': int(curr_cluster)
                    })
        else:
            cluster_transitions = []
            df['cluster'] = 0

        feature_loadings = {}
        for i in range(n_components):
            loading_dict = {}
            for j, feat in enumerate(feature_cols):
                if j < len(pca.components_[i]):
                    loading_dict[feat] = float(pca.components_[i][j])
            feature_loadings[f'PC{i+1}'] = loading_dict

        return {
            'pca': {
                'explained_variance_ratio': pca.explained_variance_ratio_.tolist(),
                'cumulative_variance': float(np.sum(pca.explained_variance_ratio_)),
                'feature_loadings': feature_loadings
            },
            'clustering': {
                'n_clusters': int(n_clusters),
                'transitions': cluster_transitions,
                'cluster_years': self._get_cluster_year_ranges(df)
            }
        }

    def _get_cluster_year_ranges(self, df: pd.DataFrame) -> Dict:
        cluster_ranges = {}
        for cluster in sorted(df['cluster'].unique()):
            cluster_years = df[df['cluster'] == cluster]['year']
            if len(cluster_years) > 0:
                cluster_ranges[str(int(cluster))] = {
                    'min_year': int(cluster_years.min()),
                    'max_year': int(cluster_years.max()),
                    'sample_count': int(len(cluster_years))
                }
        return cluster_ranges

    def _generate_insights(self, temporal_trends: Dict, style_evolution: Dict) -> List[str]:
        insights = []

        significant_trends = [
            (feat, data) for feat, data in temporal_trends.items()
            if data.get('is_significant', False)
        ]

        if significant_trends:
            for feat, data in significant_trends[:3]:
                direction = data['trend_direction']
                strength = data['correlation_strength']
                insights.append(
                    f"{feat.replace('_', ' ').title()} shows a {strength} {direction} trend over time"
                )

        if 'clustering' in style_evolution:
            transitions = style_evolution['clustering'].get('transitions', [])
            if transitions:
                transition_years = [str(t['transition_year']) for t in transitions[:2]]
                insights.append(
                    f"Major style transitions identified in: {', '.join(transition_years)}"
                )

        return insights

    def analyze_genre_evolution(self, genre_id: int) -> Dict:
        from ..database.models import OperaGenre, AudioData

        genre = self.db.query(OperaGenre).get(genre_id)
        if not genre:
            return {'error': 'Genre not found'}

        audios = self.db.query(AudioData).filter(
            AudioData.opera_type.in_([genre.name, genre.name_cn]),
            AudioData.decade.isnot(None),
            AudioData.features.isnot(None)
        ).all()

        if len(audios) < 5:
            return {'error': 'Insufficient data for genre evolution analysis'}

        heritor_groups = {}
        for audio in audios:
            if audio.heritor_id:
                if audio.heritor_id not in heritor_groups:
                    heritor_groups[audio.heritor_id] = []
                heritor_groups[audio.heritor_id].append(audio)

        heritor_evolutions = []
        for heritor_id, heritor_audios in heritor_groups.items():
            if len(heritor_audios) >= 3:
                evolution = self.analyze_heritor_evolution(heritor_id)
                if 'error' not in evolution:
                    heritor_evolutions.append(evolution)

        return {
            'genre_id': genre_id,
            'genre_name': genre.name_cn,
            'total_heritors_analyzed': len(heritor_evolutions),
            'heritor_evolutions': heritor_evolutions,
            'cross_heritor_comparison': self._compare_heritor_evolutions(heritor_evolutions)
        }

    def _compare_heritor_evolutions(self, evolutions: List[Dict]) -> Dict:
        if len(evolutions) < 2:
            return {'message': 'Need at least 2 heritors for comparison'}

        comparison = {
            'common_trends': [],
            'divergent_features': [],
            'similarity_matrix': {}
        }

        feature_trends = {}
        for evo in evolutions:
            heritor_name = evo['heritor_name']
            for feat, trend_data in evo.get('temporal_trends', {}).items():
                if feat not in feature_trends:
                    feature_trends[feat] = []
                feature_trends[feat].append({
                    'heritor': heritor_name,
                    'direction': trend_data['trend_direction']
                })

        for feat, trends in feature_trends.items():
            directions = [t['direction'] for t in trends]
            if len(set(directions)) == 1:
                comparison['common_trends'].append({
                    'feature': feat,
                    'common_direction': directions[0],
                    'heritors': [t['heritor'] for t in trends]
                })
            else:
                comparison['divergent_features'].append({
                    'feature': feat,
                    'heritor_directions': {t['heritor']: t['direction'] for t in trends}
                })

        return comparison

    def generate_evolution_report(self, heritor_id: Optional[int] = None,
                                   genre_id: Optional[int] = None) -> Dict:
        if heritor_id:
            analysis = self.analyze_heritor_evolution(heritor_id)
        elif genre_id:
            analysis = self.analyze_genre_evolution(genre_id)
        else:
            return {'error': 'Either heritor_id or genre_id must be provided'}

        if 'error' in analysis:
            return analysis

        report = {
            'title': f"唱腔演变分析报告 - {analysis.get('heritor_name', analysis.get('genre_name', ''))}",
            'generated_at': datetime.now().isoformat(),
            'analysis': analysis,
            'recommendations': self._generate_recommendations(analysis)
        }

        return report

    def _generate_recommendations(self, analysis: Dict) -> List[str]:
        recommendations = []

        if 'key_insights' in analysis:
            insights = analysis['key_insights']
            if insights:
                recommendations.append(f"Key observation: {insights[0]}")

        if 'temporal_trends' in analysis:
            sig_trends = [f for f, d in analysis['temporal_trends'].items()
                          if d.get('is_significant', False)]
            if sig_trends:
                recommendations.append(
                    f"Consider analyzing {', '.join(sig_trends[:2])} for style signature identification"
                )

        return recommendations

    def save_evolution_record(self, heritor_id: int, analysis_result: Dict) -> int:
        from ..database.models import EvolutionRecord

        record = EvolutionRecord(
            heritor_id=heritor_id,
            period_start=analysis_result['analysis_period']['start_year'],
            period_end=analysis_result['analysis_period']['end_year'],
            period_label=f"{analysis_result['analysis_period']['start_year']}-{analysis_result['analysis_period']['end_year']}",
            feature_summary=json.dumps(analysis_result.get('temporal_trends', {}), ensure_ascii=False),
            trend_direction=','.join([
                d['trend_direction'] for d in analysis_result.get('temporal_trends', {}).values()
            ])[:100],
            analysis_notes=json.dumps(analysis_result.get('key_insights', []), ensure_ascii=False)
        )

        self.db.add(record)
        self.db.commit()
        return record.id
