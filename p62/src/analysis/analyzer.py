import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Union
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans, DBSCAN
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import cross_val_score
from scipy import stats
from scipy.spatial.distance import euclidean, cityblock


class VocalAnalyzer:
    OPERA_STYLES = {
        '祁剧': ['高腔', '弹腔', '昆腔'],
        '潮剧': ['正字戏', '白字戏', '西秦戏'],
        '京剧': ['老生', '青衣', '花脸', '老旦', '小生'],
        '豫剧': ['祥符调', '豫东调', '豫西调', '沙河调'],
        '越剧': ['尹派', '袁派', '范派', '傅派'],
        '黄梅戏': ['主腔', '花腔', '三腔']
    }

    def __init__(self):
        self.scaler = StandardScaler()
        self.classifier = RandomForestClassifier(n_estimators=100, random_state=42)
        self.style_classifier = None
        self.style_scaler = StandardScaler()
        self.pca = PCA(n_components=2)
        self.feature_importance = None
        self.style_labels = None
        self.classifier_models = {}
        self.best_model = None
        self.style_probability_threshold = 0.6

    def classify_opera_style(self, df: pd.DataFrame, feature_cols: Optional[List[str]] = None) -> Dict:
        if feature_cols is None:
            feature_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            for col in ['year']:
                if col in feature_cols:
                    feature_cols.remove(col)

        X = df[feature_cols].values
        X_scaled = self.scaler.fit_transform(X)

        kmeans = KMeans(n_clusters=min(5, len(df)), random_state=42, n_init=10)
        labels = kmeans.fit_predict(X_scaled)

        style_mapping = self._map_clusters_to_opera_types(labels, df['opera_type'])

        X_pca = self.pca.fit_transform(X_scaled)

        self.style_labels = labels

        return {
            'labels': labels,
            'style_mapping': style_mapping,
            'pca_coords': X_pca,
            'cluster_centers': kmeans.cluster_centers_,
            'inertia': kmeans.inertia_,
            'feature_cols': feature_cols
        }

    def _map_clusters_to_opera_types(self, labels: np.ndarray, opera_types: pd.Series) -> Dict[int, str]:
        df_temp = pd.DataFrame({'label': labels, 'opera_type': opera_types})
        mapping = {}

        for label in np.unique(labels):
            cluster_opera = df_temp[df_temp['label'] == label]['opera_type']
            if len(cluster_opera) > 0:
                most_common = cluster_opera.value_counts().index[0]
                mapping[label] = most_common
            else:
                mapping[label] = f"风格_{label}"

        return mapping

    def train_style_classifier(self, df: pd.DataFrame, feature_cols: Optional[List[str]] = None) -> Dict:
        if feature_cols is None:
            feature_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            for col in ['year']:
                if col in feature_cols:
                    feature_cols.remove(col)

        X = df[feature_cols].values
        y = df['opera_type'].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )

        self.classifier.fit(X_train, y_train)

        y_pred = self.classifier.predict(X_test)

        self.feature_importance = pd.DataFrame({
            'feature': feature_cols,
            'importance': self.classifier.feature_importances_
        }).sort_values('importance', ascending=False)

        return {
            'classification_report': classification_report(y_test, y_pred, output_dict=True),
            'confusion_matrix': confusion_matrix(y_test, y_pred),
            'feature_importance': self.feature_importance,
            'accuracy': self.classifier.score(X_test, y_test)
        }

    def compare_inheritors(self, df: pd.DataFrame, inheritor1: str, inheritor2: str,
                            feature_cols: Optional[List[str]] = None) -> Dict:
        if feature_cols is None:
            feature_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            for col in ['year']:
                if col in feature_cols:
                    feature_cols.remove(col)

        df1 = df[df['inheritor'] == inheritor1][feature_cols]
        df2 = df[df['inheritor'] == inheritor2][feature_cols]

        if len(df1) == 0 or len(df2) == 0:
            raise ValueError("One or both inheritors not found in dataset")

        stats1 = df1.describe()
        stats2 = df2.describe()

        ttest_results = {}
        for col in feature_cols:
            ttest_results[col] = stats.ttest_ind(df1[col].dropna(), df2[col].dropna())

        centroid1 = df1.mean().values
        centroid2 = df2.mean().values

        euclidean_dist = euclidean(centroid1, centroid2)
        cosine_sim = cosine_similarity([centroid1], [centroid2])[0][0]
        manhattan_dist = cityblock(centroid1, centroid2)

        feature_diffs = pd.DataFrame({
            'feature': feature_cols,
            f'{inheritor1}_mean': df1.mean().values,
            f'{inheritor2}_mean': df2.mean().values,
            'difference': df2.mean().values - df1.mean().values,
            'percent_diff': ((df2.mean().values - df1.mean().values) / df1.mean().values * 100)
        }).sort_values('difference', key=abs, ascending=False)

        return {
            'inheritor1_stats': stats1,
            'inheritor2_stats': stats2,
            'feature_differences': feature_diffs,
            'euclidean_distance': euclidean_dist,
            'cosine_similarity': cosine_sim,
            'manhattan_distance': manhattan_dist,
            't_test_results': ttest_results
        }

    def analyze_temporal_trend(self, df: pd.DataFrame, feature_cols: Optional[List[str]] = None) -> Dict:
        if feature_cols is None:
            feature_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            for col in ['year']:
                if col in feature_cols:
                    feature_cols.remove(col)

        df_trend = df.dropna(subset=['year']).copy()
        df_trend = df_trend.sort_values('year')

        df_trend['decade'] = (df_trend['year'] // 10) * 10

        decade_means = df_trend.groupby('decade')[feature_cols].mean()

        trends = {}
        for col in feature_cols:
            x = df_trend['year'].values
            y = df_trend[col].values

            valid_mask = ~np.isnan(y)
            if np.sum(valid_mask) > 2:
                x_valid = x[valid_mask]
                y_valid = y[valid_mask]

                slope, intercept, r_value, p_value, std_err = stats.linregress(x_valid, y_valid)

                trends[col] = {
                    'slope': slope,
                    'intercept': intercept,
                    'r_value': r_value,
                    'r_squared': r_value ** 2,
                    'p_value': p_value,
                    'significant': p_value < 0.05
                }

        significant_trends = {k: v for k, v in trends.items() if v['significant']}

        return {
            'decade_means': decade_means,
            'trends': trends,
            'significant_trends': significant_trends,
            'year_range': [df_trend['year'].min(), df_trend['year'].max()]
        }

    def get_style_similarity(self, df: pd.DataFrame, feature_cols: Optional[List[str]] = None) -> np.ndarray:
        if feature_cols is None:
            feature_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            for col in ['year']:
                if col in feature_cols:
                    feature_cols.remove(col)

        X = df[feature_cols].values
        X_scaled = self.scaler.fit_transform(X)

        similarity = cosine_similarity(X_scaled)

        return similarity

    def get_top_features_by_style(self, df: pd.DataFrame, n_features: int = 10) -> Dict[str, List[str]]:
        opera_types = df['opera_type'].unique()
        feature_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        for col in ['year']:
            if col in feature_cols:
                feature_cols.remove(col)

        top_features = {}

        for opera in opera_types:
            other_df = df[df['opera_type'] != opera][feature_cols]
            opera_df = df[df['opera_type'] == opera][feature_cols]

            diffs = {}
            for col in feature_cols:
                diff = abs(opera_df[col].mean() - other_df[col].mean())
                diffs[col] = diff

            sorted_features = sorted(diffs.items(), key=lambda x: x[1], reverse=True)
            top_features[opera] = [f[0] for f in sorted_features[:n_features]]

        return top_features

    def analyze_vocal_range(self, df: pd.DataFrame, group_by: str = 'opera_type') -> Dict:
        range_stats = df.groupby(group_by).agg({
            'pitch_min': 'mean',
            'pitch_max': 'mean',
            'pitch_mean': 'mean',
            'pitch_range': 'mean',
            'pitch_std': 'mean'
        }).round(2)

        return {
            'range_statistics': range_stats,
            'group_by': group_by
        }

    def train_opera_style_classifier(self, df: pd.DataFrame, 
                                     feature_cols: Optional[List[str]] = None,
                                     target_col: str = 'opera_style') -> Dict:
        if target_col not in df.columns:
            if 'opera_type' in df.columns:
                print("警告: 未找到流派标签，使用剧种作为替代")
                target_col = 'opera_type'
            else:
                raise ValueError(f"数据集缺少目标列: {target_col}")

        if feature_cols is None:
            feature_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            for col in ['year']:
                if col in feature_cols:
                    feature_cols.remove(col)

        df_clean = df.dropna(subset=feature_cols + [target_col])
        
        if len(df_clean) < 10:
            raise ValueError("有效样本不足，无法训练模型")

        X = df_clean[feature_cols].values
        y = df_clean[target_col].values

        X_scaled = self.style_scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.3, random_state=42, stratify=y
        )

        models = {
            'RandomForest': RandomForestClassifier(n_estimators=100, random_state=42),
            'SVM': SVC(probability=True, random_state=42),
            'KNN': KNeighborsClassifier(n_neighbors=5),
            'NaiveBayes': GaussianNB()
        }

        results = {}
        best_score = 0
        best_model_name = None

        for name, model in models.items():
            cv_scores = cross_val_score(model, X_train, y_train, cv=3)
            mean_score = np.mean(cv_scores)
            
            model.fit(X_train, y_train)
            test_score = model.score(X_test, y_test)
            
            results[name] = {
                'cv_scores': cv_scores.tolist(),
                'cv_mean': mean_score,
                'test_accuracy': test_score
            }

            if test_score > best_score:
                best_score = test_score
                best_model_name = name

        self.best_model = models[best_model_name]
        self.classifier_models = results
        
        y_pred = self.best_model.predict(X_test)
        
        feature_importance = None
        if hasattr(self.best_model, 'feature_importances_'):
            feature_importance = pd.DataFrame({
                'feature': feature_cols,
                'importance': self.best_model.feature_importances_
            }).sort_values('importance', ascending=False)

        return {
            'best_model': best_model_name,
            'best_accuracy': best_score,
            'all_models': results,
            'classification_report': classification_report(y_test, y_pred, output_dict=True),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
            'feature_importance': feature_importance,
            'classes': self.best_model.classes_.tolist()
        }

    def predict_opera_style(self, df_single: pd.DataFrame, 
                            feature_cols: Optional[List[str]] = None) -> Dict:
        if self.best_model is None:
            raise RuntimeError("模型未训练，请先调用 train_opera_style_classifier")

        if feature_cols is None:
            feature_cols = df_single.select_dtypes(include=[np.number]).columns.tolist()
            for col in ['year']:
                if col in feature_cols:
                    feature_cols.remove(col)

        X = df_single[feature_cols].values
        X_scaled = self.style_scaler.transform(X)

        probabilities = self.best_model.predict_proba(X_scaled)[0]
        prediction = self.best_model.predict(X_scaled)[0]
        
        prob_dict = dict(zip(self.best_model.classes_, probabilities))
        
        max_prob = np.max(probabilities)
        is_confident = max_prob >= self.style_probability_threshold

        top_3 = sorted(prob_dict.items(), key=lambda x: x[1], reverse=True)[:3]

        return {
            'predicted_style': prediction,
            'confidence': float(max_prob),
            'is_confident': is_confident,
            'top_3_predictions': {k: float(v) for k, v in top_3},
            'all_probabilities': {k: float(v) for k, v in prob_dict.items()}
        }

    def get_style_signature_features(self, df: pd.DataFrame, 
                                    style_col: str = 'opera_style',
                                    n_features: int = 5) -> Dict[str, List[str]]:
        if style_col not in df.columns:
            raise ValueError(f"数据集缺少流派列: {style_col}")

        feature_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        for col in ['year']:
            if col in feature_cols:
                feature_cols.remove(col)

        styles = df[style_col].unique()
        style_features = {}

        for style in styles:
            style_df = df[df[style_col] == style][feature_cols]
            other_df = df[df[style_col] != style][feature_cols]

            diff_scores = {}
            for col in feature_cols:
                statistic, p_value = stats.ttest_ind(
                    style_df[col].dropna(), 
                    other_df[col].dropna(),
                    equal_var=False
                )
                diff_scores[col] = abs(statistic)

            top_features = sorted(diff_scores.items(), key=lambda x: x[1], reverse=True)[:n_features]
            style_features[style] = [f[0] for f in top_features]

        return style_features

    def classify_style_from_audio_features(self, features: Dict[str, float],
                                         opera_type: Optional[str] = None) -> Dict:
        feature_df = pd.DataFrame([features])
        
        prediction = self.predict_opera_style(feature_df)
        
        if opera_type and opera_type in self.OPERA_STYLES:
            valid_styles = self.OPERA_STYLES[opera_type]
            filtered_probs = {
                k: v for k, v in prediction['all_probabilities'].items()
                if any(s in k for s in valid_styles)
            }
            
            if filtered_probs:
                filtered_pred = max(filtered_probs.items(), key=lambda x: x[1])
                prediction['filtered_prediction'] = filtered_pred[0]
                prediction['filtered_confidence'] = filtered_pred[1]

        return prediction
