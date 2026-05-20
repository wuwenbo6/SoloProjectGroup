import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity, euclidean_distances
from scipy import stats
import json
import sys
import os
import logging
from functools import lru_cache
import pickle
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.models import get_db_session, AnalysisResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MaterialPropertyAnalyzer:
    def __init__(self):
        pass
    
    def analyze_by_material_type(self, df):
        if 'material_type' not in df.columns:
            return {}
        
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        analysis = {}
        
        for material_type in df['material_type'].unique():
            subset = df[df['material_type'] == material_type]
            analysis[material_type] = {
                'count': len(subset),
                'properties': {}
            }
            
            for col in numeric_cols:
                analysis[material_type]['properties'][col] = {
                    'mean': subset[col].mean(),
                    'std': subset[col].std(),
                    'min': subset[col].min(),
                    'max': subset[col].max(),
                    'median': subset[col].median()
                }
        
        return analysis
    
    def compare_materials(self, df, property_col):
        if property_col not in df.columns or 'material_type' not in df.columns:
            return {}
        
        groups = [df[df['material_type'] == mt][property_col].dropna() 
                  for mt in df['material_type'].unique()]
        
        if len(groups) >= 2:
            f_stat, p_value = stats.f_oneway(*groups)
        else:
            f_stat, p_value = None, None
        
        return {
            'anova_f_statistic': f_stat,
            'anova_p_value': p_value,
            'group_means': {mt: df[df['material_type'] == mt][property_col].mean() 
                           for mt in df['material_type'].unique()}
        }
    
    def cluster_materials(self, df, n_clusters=3):
        numeric_cols = df.select_dtypes(include=[np.number]).columns.dropna()
        if len(numeric_cols) == 0:
            return {}
        
        data = df[numeric_cols].fillna(df[numeric_cols].mean())
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(data)
        
        result = {
            'cluster_labels': clusters.tolist(),
            'cluster_centers': kmeans.cluster_centers_.tolist(),
            'feature_names': numeric_cols.tolist()
        }
        
        return result

class AgingPredictor:
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
    
    def train_aging_model(self, df):
        features = ['thickness', 'tensile_strength', 'water_content', 'collagen_ratio']
        existing_features = [f for f in features if f in df.columns]
        
        if 'age_years' not in df.columns or len(existing_features) == 0:
            return None
        
        X = df[existing_features].fillna(df[existing_features].mean())
        y = df['age_years'].fillna(df['age_years'].mean())
        
        self.model.fit(X, y)
        self.feature_names = existing_features
        
        return {
            'feature_importance': dict(zip(existing_features, self.model.feature_importances_))
        }
    
    def predict_aging(self, new_data):
        if not hasattr(self, 'feature_names'):
            raise ValueError("模型尚未训练，请先调用 train_aging_model")
        
        X = new_data[self.feature_names].fillna(0)
        predictions = self.model.predict(X)
        
        return predictions
    
    def predict_future_aging(self, current_data, years_ahead=50):
        aging_rates = self._calculate_aging_rates(current_data)
        
        future_data = []
        for year in range(0, years_ahead + 1, 10):
            aged_props = {}
            for prop, rate in aging_rates.items():
                if prop in current_data.columns:
                    aged_props[prop] = current_data[prop].mean() * (1 - rate * year / 100)
            aged_props['year'] = year
            future_data.append(aged_props)
        
        return pd.DataFrame(future_data)
    
    def _calculate_aging_rates(self, df):
        rates = {
            'tensile_strength': 0.15,
            'collagen_ratio': 0.08,
            'thickness': 0.05
        }
        return rates

class PigmentFadeAnalyzer:
    def __init__(self):
        self.regression_model = LinearRegression()
    
    def analyze_fade_rates(self, pigment_df):
        if 'fade_rate' not in pigment_df.columns:
            return {}
        
        analysis = {
            'overall_stats': {
                'mean_fade_rate': pigment_df['fade_rate'].mean(),
                'max_fade_rate': pigment_df['fade_rate'].max(),
                'min_fade_rate': pigment_df['fade_rate'].min()
            },
            'by_pigment': {}
        }
        
        if 'pigment_name' in pigment_df.columns:
            for pigment in pigment_df['pigment_name'].unique():
                subset = pigment_df[pigment_df['pigment_name'] == pigment]
                analysis['by_pigment'][pigment] = {
                    'mean_fade_rate': subset['fade_rate'].mean(),
                    'sample_count': len(subset)
                }
        
        return analysis
    
    def build_fade_model(self, pigment_df):
        required_cols = ['light_exposure_hours', 'color_l', 'color_a', 'color_b', 'fade_rate']
        if not all(col in pigment_df.columns for col in required_cols):
            return None
        
        X = pigment_df[['light_exposure_hours', 'color_l', 'color_a', 'color_b']]
        y = pigment_df['fade_rate']
        
        self.regression_model.fit(X, y)
        
        return {
            'coefficients': dict(zip(['light_exposure_hours', 'color_l', 'color_a', 'color_b'],
                                     self.regression_model.coef_)),
            'intercept': self.regression_model.intercept_
        }
    
    def predict_fade(self, pigment_properties, exposure_hours):
        if not hasattr(self.regression_model, 'coef_'):
            raise ValueError("模型尚未训练，请先调用 build_fade_model")
        
        X = pd.DataFrame([[
            exposure_hours,
            pigment_properties.get('color_l', 50),
            pigment_properties.get('color_a', 0),
            pigment_properties.get('color_b', 0)
        ]], columns=['light_exposure_hours', 'color_l', 'color_a', 'color_b'])
        
        return self.regression_model.predict(X)[0]
    
    def simulate_color_fading(self, initial_color, hours=1000, step=100):
        simulation = []
        current_l, current_a, current_b = initial_color
        
        for h in range(0, hours + 1, step):
            fade_factor = 1 - (h / hours) * 0.3
            simulation.append({
                'hours': h,
                'color_l': current_l * fade_factor,
                'color_a': current_a * fade_factor,
                'color_b': current_b * fade_factor
            })
        
        return pd.DataFrame(simulation)

class AnalysisManager:
    def __init__(self):
        self.property_analyzer = MaterialPropertyAnalyzer()
        self.aging_predictor = AgingPredictor()
        self.fade_analyzer = PigmentFadeAnalyzer()
    
    def run_full_analysis(self, material_df, pigment_df=None):
        results = {
            'material_properties': self.property_analyzer.analyze_by_material_type(material_df),
            'material_clusters': self.property_analyzer.cluster_materials(material_df)
        }
        
        aging_model = self.aging_predictor.train_aging_model(material_df)
        if aging_model:
            results['aging_model'] = aging_model
            results['future_aging'] = self.aging_predictor.predict_future_aging(material_df).to_dict()
        
        if pigment_df is not None:
            results['pigment_fade'] = self.fade_analyzer.analyze_fade_rates(pigment_df)
            fade_model = self.fade_analyzer.build_fade_model(pigment_df)
            if fade_model:
                results['fade_model'] = fade_model
        
        return results
    
    def save_analysis_result(self, analysis_type, result_data):
        session = get_db_session()
        try:
            result = AnalysisResult(
                analysis_type=analysis_type,
                result_data=json.dumps(result_data, ensure_ascii=False)
            )
            session.add(result)
            session.commit()
            return result.id
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_analysis_result(self, result_id):
        session = get_db_session()
        try:
            result = session.query(AnalysisResult).filter_by(id=result_id).first()
            if result:
                return json.loads(result.result_data)
            return None
        finally:
            session.close()


class EnhancedAgingPredictor:
    def __init__(self):
        self.models = {}
        self.scaler = StandardScaler()
        self.trained = False
        self.material_aging_rates = {
            '牛皮': {'tensile_strength': 0.12, 'collagen_ratio': 0.06, 'thickness': 0.04},
            '驴皮': {'tensile_strength': 0.10, 'collagen_ratio': 0.05, 'thickness': 0.03},
            '羊皮': {'tensile_strength': 0.15, 'collagen_ratio': 0.08, 'thickness': 0.05},
            '猪皮': {'tensile_strength': 0.14, 'collagen_ratio': 0.07, 'thickness': 0.045},
            '马皮': {'tensile_strength': 0.11, 'collagen_ratio': 0.055, 'thickness': 0.035},
            '鹿皮': {'tensile_strength': 0.09, 'collagen_ratio': 0.045, 'thickness': 0.03},
            '鱼皮': {'tensile_strength': 0.18, 'collagen_ratio': 0.10, 'thickness': 0.06},
            '蛇皮': {'tensile_strength': 0.16, 'collagen_ratio': 0.09, 'thickness': 0.055},
            '合成革': {'tensile_strength': 0.05, 'collagen_ratio': 0.0, 'thickness': 0.02},
            'default': {'tensile_strength': 0.13, 'collagen_ratio': 0.07, 'thickness': 0.04}
        }
    
    def train_enhanced_model(self, df):
        features = ['thickness', 'tensile_strength', 'water_content', 'collagen_ratio']
        existing_features = [f for f in features if f in df.columns]
        
        if 'age_years' not in df.columns or len(existing_features) < 2:
            logger.warning("数据不足以训练增强老化模型")
            return None
        
        df_clean = df.dropna(subset=existing_features + ['age_years'])
        if len(df_clean) < 5:
            logger.warning("样本量不足，使用默认老化率")
            return None
        
        X = df_clean[existing_features]
        y = df_clean['age_years']
        
        X_scaled = self.scaler.fit_transform(X)
        
        rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
        rf_model.fit(X_scaled, y)
        
        lr_model = LinearRegression()
        lr_model.fit(X_scaled, y)
        
        self.models = {
            'random_forest': rf_model,
            'linear_regression': lr_model
        }
        self.feature_names = existing_features
        self.trained = True
        
        feature_importance = dict(zip(existing_features, rf_model.feature_importances_))
        
        logger.info("增强老化预测模型训练完成")
        return {
            'feature_importance': feature_importance,
            'model_accuracy': {
                'rf_r2': rf_model.score(X_scaled, y),
                'lr_r2': lr_model.score(X_scaled, y)
            }
        }
    
    def predict_aging_with_confidence(self, new_data, confidence_level=0.95):
        if not self.trained:
            return self._predict_with_default_rates(new_data)
        
        X = new_data[self.feature_names].fillna(0)
        X_scaled = self.scaler.transform(X)
        
        rf_pred = self.models['random_forest'].predict(X_scaled)
        lr_pred = self.models['linear_regression'].predict(X_scaled)
        
        ensemble_pred = (rf_pred + lr_pred) / 2
        
        margin = np.std([rf_pred, lr_pred], axis=0) * 1.96
        
        return {
            'predicted_age': ensemble_pred.tolist(),
            'lower_bound': (ensemble_pred - margin).tolist(),
            'upper_bound': (ensemble_pred + margin).tolist(),
            'confidence_level': confidence_level
        }
    
    def _predict_with_default_rates(self, df):
        logger.info("使用默认老化率进行预测")
        predictions = []
        for _, row in df.iterrows():
            material_type = row.get('material_type_standardized', 'default')
            rates = self.material_aging_rates.get(material_type, self.material_aging_rates['default'])
            
            tensile_loss = (1 - row.get('tensile_strength', 30) / 40) * 100
            predicted_age = tensile_loss / rates['tensile_strength'] if rates['tensile_strength'] > 0 else 50
            
            predictions.append(max(0, min(200, predicted_age)))
        
        return {
            'predicted_age': predictions,
            'lower_bound': [p * 0.7 for p in predictions],
            'upper_bound': [p * 1.3 for p in predictions],
            'confidence_level': 0.7,
            'note': '使用默认老化率预测，置信度较低'
        }
    
    def predict_detailed_aging(self, df, years_ahead=100, include_risks=True):
        results = []
        
        for idx, row in df.iterrows():
            material_type = row.get('material_type_standardized', 'default')
            rates = self.material_aging_rates.get(material_type, self.material_aging_rates['default'])
            
            aging_trajectory = []
            for year in range(0, years_ahead + 1, 5):
                aged_props = {
                    'year': year,
                    'material_type': material_type,
                    'tensile_strength': row.get('tensile_strength', 30) * (1 - rates['tensile_strength'] * year / 100),
                    'collagen_ratio': row.get('collagen_ratio', 80) * (1 - rates['collagen_ratio'] * year / 100),
                    'thickness': row.get('thickness', 1.2) * (1 - rates['thickness'] * year / 100)
                }
                
                if include_risks:
                    aged_props['risk_level'] = self._calculate_risk_level(aged_props)
                    aged_props['maintenance_suggestion'] = self._get_maintenance_suggestion(aged_props['risk_level'])
                
                aging_trajectory.append(aged_props)
            
            results.append({
                'item_index': idx,
                'material_type': material_type,
                'aging_trajectory': aging_trajectory
            })
        
        return results
    
    def _calculate_risk_level(self, props):
        risk_score = 0
        if props['tensile_strength'] < 15:
            risk_score += 3
        elif props['tensile_strength'] < 20:
            risk_score += 1
        
        if props['collagen_ratio'] < 50:
            risk_score += 3
        elif props['collagen_ratio'] < 65:
            risk_score += 1
        
        if props['thickness'] < 0.5:
            risk_score += 2
        elif props['thickness'] < 0.8:
            risk_score += 1
        
        if risk_score >= 5:
            return 'high'
        elif risk_score >= 2:
            return 'medium'
        else:
            return 'low'
    
    def _get_maintenance_suggestion(self, risk_level):
        suggestions = {
            'high': '立即进行专业修复，建议恒温恒湿保存，避免光照',
            'medium': '建议每季度检查，控制保存环境湿度在50-60%',
            'low': '正常保存，每年检查一次即可'
        }
        return suggestions.get(risk_level, '请咨询专业人士')


class MaterialSimilaritySearch:
    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_vectors = None
        self.material_metadata = None
        self.feature_columns = None
    
    def build_index(self, df, feature_columns=None):
        if feature_columns is None:
            feature_columns = ['thickness', 'tensile_strength', 'water_content', 
                               'collagen_ratio', 'age_years']
        
        self.feature_columns = [col for col in feature_columns if col in df.columns]
        
        if len(self.feature_columns) == 0:
            raise ValueError("没有可用的特征列")
        
        features = df[self.feature_columns].fillna(df[self.feature_columns].mean())
        self.feature_vectors = self.scaler.fit_transform(features)
        
        metadata_cols = ['material_type']
        if 'material_type_standardized' in df.columns:
            metadata_cols.append('material_type_standardized')
        if 'source' in df.columns:
            metadata_cols.append('source')
        
        self.material_metadata = df[metadata_cols].copy()
        
        logger.info(f"材质相似度索引构建完成，共 {len(df)} 条记录，{len(self.feature_columns)} 个特征")
        return True
    
    def search_similar(self, query_vector, top_k=5, method='cosine'):
        if self.feature_vectors is None:
            raise ValueError("请先调用 build_index 构建索引")
        
        query_scaled = self.scaler.transform(query_vector[self.feature_columns])
        
        if method == 'cosine':
            similarities = cosine_similarity(query_scaled, self.feature_vectors)[0]
            top_indices = similarities.argsort()[-top_k:][::-1]
            scores = similarities[top_indices]
        elif method == 'euclidean':
            distances = euclidean_distances(query_scaled, self.feature_vectors)[0]
            top_indices = distances.argsort()[:top_k]
            scores = 1 / (1 + distances[top_indices])
        else:
            raise ValueError("不支持的相似度计算方法，请使用 'cosine' 或 'euclidean'")
        
        results = []
        for idx, score in zip(top_indices, scores):
            result = {
                'rank': len(results) + 1,
                'similarity_score': float(score),
                'material_type': self.material_metadata.iloc[idx]['material_type']
            }
            if 'material_type_standardized' in self.material_metadata.columns:
                result['material_type_standardized'] = self.material_metadata.iloc[idx]['material_type_standardized']
            if 'source' in self.material_metadata.columns:
                result['source'] = self.material_metadata.iloc[idx]['source']
            results.append(result)
        
        return results
    
    def search_by_example(self, df, example_index, top_k=5, method='cosine'):
        query_vector = df.iloc[[example_index]]
        return self.search_similar(query_vector, top_k, method)
    
    def batch_search(self, df, query_indices, top_k=5, method='cosine'):
        results = []
        for idx in query_indices:
            result = {
                'query_index': idx,
                'results': self.search_by_example(df, idx, top_k, method)
            }
            results.append(result)
        return results


class AnalysisResultExporter:
    def __init__(self):
        self.supported_formats = ['csv', 'xlsx', 'json']
    
    def export_features(self, features_df, output_path, format='csv'):
        format = format.lower()
        if format not in self.supported_formats:
            raise ValueError(f"不支持的导出格式: {format}")
        
        if format == 'csv':
            features_df.to_csv(output_path, index=False, encoding='utf-8-sig')
        elif format == 'xlsx':
            features_df.to_excel(output_path, index=False)
        elif format == 'json':
            features_df.to_json(output_path, orient='records', force_ascii=False, indent=2)
        
        logger.info(f"特征数据已导出到: {output_path}")
        return True
    
    def export_analysis_results(self, analysis_results, output_path, format='json'):
        format = format.lower()
        if format not in self.supported_formats:
            raise ValueError(f"不支持的导出格式: {format}")
        
        if format == 'json':
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(analysis_results, f, ensure_ascii=False, indent=2)
        elif format == 'csv':
            self._analysis_to_dataframe(analysis_results).to_csv(output_path, index=False, encoding='utf-8-sig')
        elif format == 'xlsx':
            self._analysis_to_excel(analysis_results, output_path)
        
        logger.info(f"分析结果已导出到: {output_path}")
        return True
    
    def _analysis_to_dataframe(self, analysis_results):
        records = []
        if 'material_properties' in analysis_results:
            for material, props in analysis_results['material_properties'].items():
                record = {'material_type': material, 'sample_count': props['count']}
                for prop_name, stats in props['properties'].items():
                    for stat_name, value in stats.items():
                        record[f'{prop_name}_{stat_name}'] = value
                records.append(record)
        return pd.DataFrame(records)
    
    def _analysis_to_excel(self, analysis_results, output_path):
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            if 'material_properties' in analysis_results:
                self._analysis_to_dataframe(analysis_results).to_excel(
                    writer, sheet_name='材质属性', index=False)
            
            if 'material_clusters' in analysis_results:
                pd.DataFrame(analysis_results['material_clusters']['cluster_centers'],
                           columns=analysis_results['material_clusters']['feature_names']).to_excel(
                    writer, sheet_name='聚类中心', index=False)
            
            if 'aging_trajectory' in analysis_results:
                pd.DataFrame(analysis_results['aging_trajectory']).to_excel(
                    writer, sheet_name='老化轨迹', index=False)
    
    def batch_export(self, features_df, analysis_results, base_output_path):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        results = {
            'features': {},
            'analysis': {}
        }
        
        for fmt in ['csv', 'xlsx', 'json']:
            features_path = f"{base_output_path}_features_{timestamp}.{fmt}"
            analysis_path = f"{base_output_path}_analysis_{timestamp}.{fmt}"
            
            try:
                self.export_features(features_df, features_path, fmt)
                results['features'][fmt] = features_path
            except Exception as e:
                logger.warning(f"导出特征数据 {fmt} 格式失败: {e}")
                results['features'][fmt] = None
            
            try:
                self.export_analysis_results(analysis_results, analysis_path, fmt)
                results['analysis'][fmt] = analysis_path
            except Exception as e:
                logger.warning(f"导出分析结果 {fmt} 格式失败: {e}")
                results['analysis'][fmt] = None
        
        return results
    
    def export_similarity_results(self, similarity_results, output_path, format='json'):
        format = format.lower()
        if format == 'json':
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(similarity_results, f, ensure_ascii=False, indent=2)
        elif format == 'csv':
            records = []
            for result in similarity_results:
                for match in result['results']:
                    record = {'query_index': result['query_index'], **match}
                    records.append(record)
            pd.DataFrame(records).to_csv(output_path, index=False, encoding='utf-8-sig')
        
        logger.info(f"相似度检索结果已导出到: {output_path}")
        return True


class PerformanceOptimizer:
    def __init__(self, cache_dir='.cache'):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        self.cache_hits = 0
        self.cache_misses = 0
    
    def cache_data(self, key, data, ttl_hours=24):
        cache_file = os.path.join(self.cache_dir, f"{key}.pkl")
        try:
            with open(cache_file, 'wb') as f:
                pickle.dump({
                    'data': data,
                    'timestamp': datetime.now(),
                    'ttl_hours': ttl_hours
                }, f)
            logger.info(f"数据已缓存: {key}")
            return True
        except Exception as e:
            logger.warning(f"缓存失败: {e}")
            return False
    
    def get_cached_data(self, key):
        cache_file = os.path.join(self.cache_dir, f"{key}.pkl")
        if not os.path.exists(cache_file):
            self.cache_misses += 1
            return None
        
        try:
            with open(cache_file, 'rb') as f:
                cached = pickle.load(f)
            
            age_hours = (datetime.now() - cached['timestamp']).total_seconds() / 3600
            if age_hours > cached['ttl_hours']:
                os.remove(cache_file)
                self.cache_misses += 1
                return None
            
            self.cache_hits += 1
            logger.info(f"缓存命中: {key} (缓存命中率: {self.get_cache_hit_rate():.1%})")
            return cached['data']
        except Exception as e:
            logger.warning(f"读取缓存失败: {e}")
            self.cache_misses += 1
            return None
    
    def get_cache_hit_rate(self):
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0
    
    def clear_expired_cache(self):
        count = 0
        for filename in os.listdir(self.cache_dir):
            if filename.endswith('.pkl'):
                filepath = os.path.join(self.cache_dir, filename)
                try:
                    with open(filepath, 'rb') as f:
                        cached = pickle.load(f)
                    age_hours = (datetime.now() - cached['timestamp']).total_seconds() / 3600
                    if age_hours > cached['ttl_hours']:
                        os.remove(filepath)
                        count += 1
                except:
                    os.remove(filepath)
                    count += 1
        logger.info(f"清理了 {count} 个过期缓存文件")
        return count
    
    def optimize_dataframe(self, df):
        original_memory = df.memory_usage(deep=True).sum()
        
        for col in df.columns:
            if df[col].dtype == 'float64':
                df[col] = df[col].astype('float32')
            elif df[col].dtype == 'object' and df[col].nunique() / len(df) < 0.5:
                df[col] = df[col].astype('category')
        
        optimized_memory = df.memory_usage(deep=True).sum()
        savings = (1 - optimized_memory / original_memory) * 100
        
        logger.info(f"DataFrame优化完成，内存节省: {savings:.1f}%")
        return df


class EnhancedAnalysisManager(AnalysisManager):
    def __init__(self, enable_cache=True):
        super().__init__()
        self.enhanced_aging_predictor = EnhancedAgingPredictor()
        self.similarity_search = MaterialSimilaritySearch()
        self.exporter = AnalysisResultExporter()
        self.optimizer = PerformanceOptimizer() if enable_cache else None
        self.similarity_index_built = False
    
    def run_enhanced_analysis(self, material_df, pigment_df=None, enable_aging_prediction=True,
                              enable_similarity_search=True, top_k_similar=5):
        if self.optimizer:
            cache_key = f"enhanced_analysis_{hash(material_df.to_csv())}"
            cached_result = self.optimizer.get_cached_data(cache_key)
            if cached_result:
                return cached_result
        
        results = self.run_full_analysis(material_df, pigment_df)
        
        if enable_aging_prediction:
            aging_model = self.enhanced_aging_predictor.train_enhanced_model(material_df)
            if aging_model:
                results['enhanced_aging_model'] = aging_model
            
            aging_predictions = self.enhanced_aging_predictor.predict_aging_with_confidence(material_df)
            results['aging_predictions'] = aging_predictions
            
            detailed_aging = self.enhanced_aging_predictor.predict_detailed_aging(material_df)
            results['detailed_aging_trajectory'] = detailed_aging
        
        if enable_similarity_search and len(material_df) >= 3:
            try:
                from feature_extraction.feature_extractor import MaterialFeatureExtractor
                extractor = MaterialFeatureExtractor()
                material_df_standardized = extractor.identify_material_types(material_df)
                
                self.similarity_search.build_index(material_df_standardized)
                self.similarity_index_built = True
                
                sample_size = min(3, len(material_df_standardized))
                similarity_results = self.similarity_search.batch_search(
                    material_df_standardized, list(range(sample_size)), top_k_similar)
                results['similarity_search_examples'] = similarity_results
            except Exception as e:
                logger.warning(f"相似度检索构建失败: {e}")
                results['similarity_search_note'] = '数据量不足或特征不完整'
        
        if self.optimizer:
            self.optimizer.cache_data(cache_key, results)
        
        return results
    
    def find_similar_materials(self, material_df, query_index, top_k=5, method='cosine'):
        if not self.similarity_index_built:
            from feature_extraction.feature_extractor import MaterialFeatureExtractor
            extractor = MaterialFeatureExtractor()
            material_df_standardized = extractor.identify_material_types(material_df)
            self.similarity_search.build_index(material_df_standardized)
            self.similarity_index_built = True
        
        from feature_extraction.feature_extractor import MaterialFeatureExtractor
        extractor = MaterialFeatureExtractor()
        material_df_standardized = extractor.identify_material_types(material_df)
        return self.similarity_search.search_by_example(material_df_standardized, query_index, top_k, method)
    
    def batch_find_similar(self, material_df, query_indices, top_k=5, method='cosine'):
        if not self.similarity_index_built:
            from feature_extraction.feature_extractor import MaterialFeatureExtractor
            extractor = MaterialFeatureExtractor()
            material_df_standardized = extractor.identify_material_types(material_df)
            self.similarity_search.build_index(material_df_standardized)
            self.similarity_index_built = True
        
        from feature_extraction.feature_extractor import MaterialFeatureExtractor
        extractor = MaterialFeatureExtractor()
        material_df_standardized = extractor.identify_material_types(material_df)
        return self.similarity_search.batch_search(material_df_standardized, query_indices, top_k, method)
    
    def export_results(self, features_df, analysis_results, output_path, format='all'):
        if format == 'all':
            return self.exporter.batch_export(features_df, analysis_results, output_path)
        else:
            base_path = output_path.rsplit('.', 1)[0] if '.' in output_path else output_path
            features_path = f"{base_path}_features.{format}"
            analysis_path = f"{base_path}_analysis.{format}"
            
            self.exporter.export_features(features_df, features_path, format)
            self.exporter.export_analysis_results(analysis_results, analysis_path, format)
            
            return {
                'features': features_path,
                'analysis': analysis_path
            }
    
    def export_similarity_results(self, similarity_results, output_path, format='json'):
        return self.exporter.export_similarity_results(similarity_results, output_path, format)
    
    def get_performance_stats(self):
        if self.optimizer:
            return {
                'cache_hit_rate': self.optimizer.get_cache_hit_rate(),
                'cache_hits': self.optimizer.cache_hits,
                'cache_misses': self.optimizer.cache_misses
            }
        return {'note': '缓存未启用'}
