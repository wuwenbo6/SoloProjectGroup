import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from collections import defaultdict
import sys
import os
import logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.models import get_db_session, MaterialFeature

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MaterialKnowledgeBase:
    def __init__(self):
        self.material_mapping = {
            '牛皮': ['牛皮', '黄牛皮', '水牛皮', '牦牛皮', '牛皮革', 'cowhide', 'oxhide'],
            '驴皮': ['驴皮', '毛驴皮', '驴皮革', 'donkey hide'],
            '羊皮': ['羊皮', '山羊皮', '绵羊皮', '羊羔皮', 'sheepskin', 'goatskin'],
            '猪皮': ['猪皮', '猪皮革', 'pigskin', 'hog skin'],
            '马皮': ['马皮', '马皮革', 'horse hide'],
            '鹿皮': ['鹿皮', '麂皮', 'deer skin', 'chamois'],
            '鱼皮': ['鱼皮', '鲨鱼皮', '娃娃鱼皮', 'fish skin'],
            '蛇皮': ['蛇皮', 'snake skin'],
            '合成革': ['合成革', '人造革', 'PU革', 'PVC革', 'synthetic leather'],
            '纸浆模': ['纸浆模', '纸浆', '纸制', 'paper'],
            '复合皮': ['复合皮', '再生皮', '二层皮', '碎皮', 'bonded leather']
        }
        
        self.material_property_ranges = {
            '牛皮': {'thickness_range': (0.8, 2.0), 'tensile_range': (20, 40), 'collagen_range': (75, 90)},
            '驴皮': {'thickness_range': (0.6, 1.2), 'tensile_range': (25, 45), 'collagen_range': (80, 95)},
            '羊皮': {'thickness_range': (0.4, 0.9), 'tensile_range': (15, 30), 'collagen_range': (70, 85)},
            '猪皮': {'thickness_range': (0.7, 1.5), 'tensile_range': (18, 32), 'collagen_range': (72, 88)},
            '马皮': {'thickness_range': (1.0, 2.2), 'tensile_range': (22, 38), 'collagen_range': (78, 92)},
            '鹿皮': {'thickness_range': (0.5, 1.0), 'tensile_range': (28, 42), 'collagen_range': (82, 96)},
            '鱼皮': {'thickness_range': (0.2, 0.6), 'tensile_range': (10, 25), 'collagen_range': (60, 80)},
            '蛇皮': {'thickness_range': (0.15, 0.5), 'tensile_range': (12, 28), 'collagen_range': (65, 82)},
            '合成革': {'thickness_range': (0.5, 1.5), 'tensile_range': (5, 20), 'collagen_range': (0, 10)},
            '纸浆模': {'thickness_range': (0.3, 1.0), 'tensile_range': (2, 10), 'collagen_range': (0, 5)},
            '复合皮': {'thickness_range': (0.6, 1.8), 'tensile_range': (10, 25), 'collagen_range': (30, 60)}
        }
        
        self.reverse_mapping = self._build_reverse_mapping()
    
    def _build_reverse_mapping(self):
        reverse = defaultdict(list)
        for standard, variants in self.material_mapping.items():
            for variant in variants:
                reverse[variant.lower()].append(standard)
        return reverse
    
    def identify_material(self, material_name):
        if pd.isna(material_name) or not material_name:
            return '未知材质'
        
        name = str(material_name).strip().lower()
        
        for variant, standards in self.reverse_mapping.items():
            if variant in name or name in variant:
                return standards[0]
        
        return self._classify_by_properties(name)
    
    def _classify_by_properties(self, name):
        keywords = {
            '皮': ['皮', '革', 'hide', 'leather'],
            '纸': ['纸', 'paper', '浆'],
            '合成': ['合成', '人造', 'synthetic', 'PU', 'PVC']
        }
        
        for category, keys in keywords.items():
            for key in keys:
                if key.lower() in name:
                    if category == '皮':
                        return '其他皮类'
                    elif category == '纸':
                        return '纸浆模'
                    else:
                        return '合成革'
        
        return '未知材质'
    
    def validate_material_properties(self, material_type, thickness=None, tensile_strength=None, collagen_ratio=None):
        if material_type not in self.material_property_ranges:
            return False, None
        
        props = self.material_property_ranges[material_type]
        validation = {}
        is_valid = True
        
        if thickness is not None and not pd.isna(thickness):
            t_min, t_max = props['thickness_range']
            validation['thickness_valid'] = t_min <= thickness <= t_max
            if not validation['thickness_valid']:
                is_valid = False
        
        if tensile_strength is not None and not pd.isna(tensile_strength):
            s_min, s_max = props['tensile_range']
            validation['tensile_valid'] = s_min <= tensile_strength <= s_max
            if not validation['tensile_valid']:
                is_valid = False
        
        if collagen_ratio is not None and not pd.isna(collagen_ratio):
            c_min, c_max = props['collagen_range']
            validation['collagen_valid'] = c_min <= collagen_ratio <= c_max
            if not validation['collagen_valid']:
                is_valid = False
        
        return is_valid, validation

class MaterialFeatureExtractor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.knowledge_base = MaterialKnowledgeBase()
        self.logger = logging.getLogger(__name__)
    
    def identify_material_types(self, df):
        if 'material_type' not in df.columns:
            df['material_type'] = '未知材质'
            return df
        
        identified = []
        corrections = 0
        
        for idx, row in df.iterrows():
            original = row['material_type']
            standardized = self.knowledge_base.identify_material(original)
            
            if standardized != original and standardized != '未知材质':
                corrections += 1
            
            identified.append(standardized)
        
        df['material_type_standardized'] = identified
        self.logger.info(f"材质识别完成，修正 {corrections}/{len(df)} 项")
        
        unknown_count = sum(1 for m in identified if m in ['未知材质', '其他皮类'])
        if unknown_count > 0:
            self.logger.warning(f"发现 {unknown_count} 个未知/小众材质，将使用通用特征提取模式")
        
        return df
    
    def extract_physical_features(self, df):
        features = pd.DataFrame(index=df.index)
        
        if 'thickness' in df.columns:
            df['thickness'] = pd.to_numeric(df['thickness'], errors='coerce')
            thickness = df['thickness'].fillna(df['thickness'].median())
            
            features['thickness_normalized'] = self._normalize(thickness)
            features['thickness_category'] = pd.cut(
                thickness, 
                bins=[0, 0.8, 1.2, np.inf],
                labels=['薄', '中', '厚']
            )
            features['thickness_log'] = np.log1p(thickness)
        
        if 'tensile_strength' in df.columns:
            df['tensile_strength'] = pd.to_numeric(df['tensile_strength'], errors='coerce')
            tensile = df['tensile_strength'].fillna(df['tensile_strength'].median())
            
            features['strength_normalized'] = self._normalize(tensile)
            
            if 'thickness' in df.columns:
                valid_mask = (df['thickness'] > 0) & df['tensile_strength'].notna()
                features['strength_to_thickness'] = np.nan
                features.loc[valid_mask, 'strength_to_thickness'] = tensile[valid_mask] / thickness[valid_mask]
        
        return features
    
    def extract_chemical_features(self, df):
        features = pd.DataFrame(index=df.index)
        
        if 'collagen_ratio' in df.columns:
            df['collagen_ratio'] = pd.to_numeric(df['collagen_ratio'], errors='coerce')
            collagen = df['collagen_ratio'].fillna(df['collagen_ratio'].median())
            
            features['collagen_quality'] = pd.cut(
                collagen,
                bins=[0, 60, 75, 85, 100],
                labels=['极低', '低', '中', '高']
            )
            features['collagen_normalized'] = self._normalize(collagen)
        
        if 'water_content' in df.columns:
            df['water_content'] = pd.to_numeric(df['water_content'], errors='coerce')
            water = df['water_content'].fillna(df['water_content'].median())
            
            features['water_content_category'] = pd.cut(
                water,
                bins=[0, 8, 12, 18, np.inf],
                labels=['极干', '干燥', '适中', '潮湿']
            )
            features['water_normalized'] = self._normalize(water)
        
        return features
    
    def extract_aging_features(self, df):
        features = pd.DataFrame(index=df.index)
        
        if 'age_years' in df.columns:
            df['age_years'] = pd.to_numeric(df['age_years'], errors='coerce')
            age = df['age_years'].fillna(df['age_years'].median())
            
            features['age_category'] = pd.cut(
                age,
                bins=[0, 20, 50, 100, 200, np.inf],
                labels=['现代', '近代', '旧制', '古旧', '古董']
            )
            
            features['aging_index'] = age / 100.0
            features['aging_log'] = np.log1p(age)
            
            if 'storage_condition' in df.columns:
                storage_factors = {
                    '干燥阴凉': 0.8,
                    '恒温恒湿': 0.6,
                    '自然环境': 1.2,
                    '潮湿环境': 1.5,
                    '光照环境': 1.8,
                    '真空密封': 0.4
                }
                features['storage_factor'] = df['storage_condition'].map(
                    lambda x: storage_factors.get(str(x).strip(), 1.0)
                )
                features['adjusted_aging_score'] = features['aging_index'] * features['storage_factor']
        
        return features
    
    def extract_rare_material_features(self, df):
        features = pd.DataFrame(index=df.index)
        
        if 'material_type_standardized' in df.columns:
            rare_types = ['鱼皮', '蛇皮', '鹿皮', '其他皮类', '未知材质']
            features['is_rare_material'] = df['material_type_standardized'].isin(rare_types).astype(int)
            
            material_groups = {
                '传统皮': ['牛皮', '驴皮', '羊皮', '猪皮', '马皮'],
                '珍稀皮': ['鱼皮', '蛇皮', '鹿皮'],
                '人造材料': ['合成革', '纸浆模', '复合皮'],
                '未知': ['其他皮类', '未知材质']
            }
            
            def get_group(mtype):
                for group, types in material_groups.items():
                    if mtype in types:
                        return group
                return '未知'
            
            features['material_group'] = df['material_type_standardized'].apply(get_group)
        
        for idx, row in df.iterrows():
            mtype = row.get('material_type_standardized', '')
            if mtype in self.knowledge_base.material_property_ranges:
                props = self.knowledge_base.material_property_ranges[mtype]
                thickness = row.get('thickness')
                tensile = row.get('tensile_strength')
                collagen = row.get('collagen_ratio')
                
                _, validation = self.knowledge_base.validate_material_properties(mtype, thickness, tensile, collagen)
                if validation:
                    features.loc[idx, 'property_match_score'] = sum(validation.values()) / len(validation)
            else:
                features.loc[idx, 'property_match_score'] = 0.5
        
        return features
    
    def extract_pigment_features(self, pigment_df):
        features = pd.DataFrame(index=pigment_df.index)
        
        if all(col in pigment_df.columns for col in ['color_l', 'color_a', 'color_b']):
            for col in ['color_l', 'color_a', 'color_b']:
                pigment_df[col] = pd.to_numeric(pigment_df[col], errors='coerce').fillna(50)
            
            features['color_intensity'] = np.sqrt(
                pigment_df['color_l']**2 + 
                pigment_df['color_a']**2 + 
                pigment_df['color_b']**2
            )
            
            features['chroma'] = np.sqrt(
                pigment_df['color_a']**2 + 
                pigment_df['color_b']**2
            )
            
            features['hue_angle'] = np.arctan2(pigment_df['color_b'], pigment_df['color_a'])
        
        if 'fade_rate' in pigment_df.columns and 'light_exposure_hours' in pigment_df.columns:
            pigment_df['fade_rate'] = pd.to_numeric(pigment_df['fade_rate'], errors='coerce').fillna(0.1)
            pigment_df['light_exposure_hours'] = pd.to_numeric(pigment_df['light_exposure_hours'], errors='coerce').fillna(100)
            features['fade_sensitivity'] = pigment_df['fade_rate'] * pigment_df['light_exposure_hours'] / 1000
        
        return features
    
    def extract_all_features(self, df, pigment_df=None):
        self.logger.info(f"开始特征提取，数据量: {len(df)} 行")
        
        df = self.identify_material_types(df)
        
        physical = self.extract_physical_features(df)
        chemical = self.extract_chemical_features(df)
        aging = self.extract_aging_features(df)
        rare_features = self.extract_rare_material_features(df)
        
        base_cols = ['material_type', 'material_type_standardized']
        available_cols = [col for col in base_cols if col in df.columns]
        if 'source' in df.columns:
            available_cols.append('source')
        
        base_df = df[available_cols].copy() if available_cols else pd.DataFrame(index=df.index)
        
        all_features = pd.concat(
            [base_df, physical, chemical, aging, rare_features], 
            axis=1
        )
        
        if pigment_df is not None and not pigment_df.empty:
            pigment_features = self.extract_pigment_features(pigment_df)
            if len(pigment_features) == len(all_features):
                all_features = pd.concat([all_features, pigment_features.add_prefix('pigment_')], axis=1)
            else:
                self.logger.warning(f"颜料数据行数 {len(pigment_features)} 与材质数据行数 {len(all_features)} 不匹配，跳过颜料特征")
        
        self.logger.info(f"特征提取完成，共 {len(all_features.columns)} 个特征")
        return all_features
    
    def _normalize(self, series):
        values = series.values.reshape(-1, 1)
        return self.scaler.fit_transform(values).flatten()
    
    def save_features_to_database(self, features_df, material_ids):
        session = get_db_session()
        try:
            for idx, (_, row) in enumerate(features_df.iterrows()):
                material_id = material_ids[idx] if idx < len(material_ids) else None
                
                for col in features_df.columns:
                    if pd.api.types.is_numeric_dtype(features_df[col]) and pd.notna(row[col]):
                        feature = MaterialFeature(
                            material_id=material_id,
                            feature_name=col,
                            feature_value=float(row[col])
                        )
                        session.add(feature)
            
            session.commit()
            return True
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

class FeatureSelector:
    @staticmethod
    def select_numerical_features(df):
        return df.select_dtypes(include=[np.number])
    
    @staticmethod
    def select_categorical_features(df):
        return df.select_dtypes(include=['object', 'category'])
    
    @staticmethod
    def get_correlated_features(df, threshold=0.8):
        corr_matrix = df.corr().abs()
        upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
        return [column for column in upper.columns if any(upper[column] > threshold)]
