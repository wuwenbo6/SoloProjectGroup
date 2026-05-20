import pandas as pd
import numpy as np
import json
import requests
from datetime import datetime
import sys
import os
import logging
import hashlib
import gc

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config
from database.models import get_db_session, MaterialData, PigmentData
from core import (
    DaskParallelProcessor,
    MemoryOptimizer,
    get_cache,
    get_monitor,
    profile_memory,
    profile_time,
    DASK_AVAILABLE
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LocalFileLoader:
    def __init__(self, chunk_size=10000, use_dask=True, use_cache=True):
        self.allowed_extensions = Config.ALLOWED_EXTENSIONS
        self.chunk_size = chunk_size
        self.large_file_threshold = 100 * 1024 * 1024
        self.use_dask = use_dask and DASK_AVAILABLE
        self.use_cache = use_cache
        self.cache = get_cache()
        self.monitor = get_monitor()
        
        self.numeric_columns = ['thickness', 'tensile_strength', 'water_content', 
                                'collagen_ratio', 'age_years']
        self.category_columns = ['material_type', 'source', 'storage_condition']
    
    def _get_cache_key(self, file_path, method_name):
        stat = os.stat(file_path)
        file_hash = hashlib.md5(f"{file_path}{stat.st_mtime}{stat.st_size}".encode()).hexdigest()
        return f"loader:{method_name}:{file_hash}"
    
    @profile_memory
    def load_file(self, file_path, low_memory=True):
        self.monitor.start_timer('load_file_total')
        
        cache_key = self._get_cache_key(file_path, 'load_file')
        if self.use_cache:
            cached_data = self.cache.get(cache_key)
            if cached_data is not None:
                logger.info(f"从缓存加载数据: {file_path}")
                self.monitor.end_timer('load_file_total')
                return cached_data
        
        file_size = os.path.getsize(file_path)
        ext = os.path.splitext(file_path)[1].lower()
        
        logger.info(f"加载文件: {file_path}, 大小: {file_size / 1024 / 1024:.2f} MB")
        
        if self.use_dask and file_size > self.large_file_threshold:
            logger.info("检测到大文件，启用Dask并行加载模式")
            df = self._load_large_file_dask(file_path, ext)
        elif file_size > self.large_file_threshold:
            logger.info("检测到大文件，启用分块加载模式")
            df = self._load_large_file(file_path, ext)
        else:
            if ext == '.csv':
                df = self._load_csv(file_path, low_memory)
            elif ext == '.xlsx':
                df = self._load_excel(file_path)
            elif ext == '.json':
                df = self._load_json(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {ext}")
        
        if self.use_cache:
            self.cache.put(cache_key, df, ttl_seconds=3600)
        
        self.monitor.end_timer('load_file_total')
        logger.info(f"文件加载完成，共 {len(df)} 行，{len(df.columns)} 列")
        return df
    
    def _load_large_file(self, file_path, ext):
        if ext == '.csv':
            return self._load_csv_chunks(file_path)
        elif ext == '.json':
            return self._load_json_stream(file_path)
        else:
            return self._load_file_with_optimization(file_path, ext)
    
    @profile_memory
    def _load_large_file_dask(self, file_path, ext):
        if ext != '.csv':
            logger.warning(f"Dask目前仅支持CSV格式，回退到常规加载: {ext}")
            return self._load_large_file(file_path, ext)
        
        logger.info(f"使用Dask并行加载: {file_path}")
        self.monitor.start_timer('dask_load')
        
        try:
            with DaskParallelProcessor(memory_limit='8GB') as processor:
                ddf = processor.load_csv_parallel(file_path, chunk_size='100MB', low_memory=False)
                ddf = processor.apply_parallel(ddf, self._optimize_memory)
                ddf = processor.apply_parallel(ddf, self._standardize_data)
                df = processor.compute(ddf)
            
            self.monitor.end_timer('dask_load')
            logger.info(f"Dask并行加载完成，共 {len(df)} 行")
            return df
        except Exception as e:
            logger.warning(f"Dask加载失败，回退到分块加载: {e}")
            return self._load_csv_chunks(file_path)
    
    def _load_csv_chunks(self, file_path):
        chunks = []
        total_rows = 0
        
        for chunk in pd.read_csv(file_path, chunksize=self.chunk_size, low_memory=False):
            chunk = self._optimize_memory(chunk)
            chunk = self._standardize_data(chunk)
            chunks.append(chunk)
            total_rows += len(chunk)
            if total_rows % (self.chunk_size * 5) == 0:
                logger.info(f"已加载: {total_rows} 行")
                gc.collect()
        
        df = pd.concat(chunks, ignore_index=True)
        logger.info(f"分块加载完成，共 {len(df)} 行，{len(df.columns)} 列")
        return df
    
    def _load_csv(self, file_path, low_memory=True):
        df = pd.read_csv(file_path, low_memory=low_memory)
        df = self._optimize_memory(df)
        return self._standardize_data(df)
    
    def _load_excel(self, file_path):
        file_size = os.path.getsize(file_path)
        if file_size > 50 * 1024 * 1024:
            logger.info("大Excel文件，使用openpyxl优化模式")
            df = pd.read_excel(file_path, engine='openpyxl')
        else:
            df = pd.read_excel(file_path)
        df = self._optimize_memory(df)
        return self._standardize_data(df)
    
    def _load_json(self, file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        df = pd.DataFrame(data if isinstance(data, list) else [data])
        df = self._optimize_memory(df)
        return self._standardize_data(df)
    
    def _load_json_stream(self, file_path):
        import ijson
        items = []
        
        with open(file_path, 'rb') as f:
            for item in ijson.items(f, 'item'):
                items.append(item)
                if len(items) >= self.chunk_size:
                    logger.info(f"流式加载中... 已读取 {len(items)} 条")
        
        df = pd.DataFrame(items)
        df = self._optimize_memory(df)
        return self._standardize_data(df)
    
    def _load_file_with_optimization(self, file_path, ext):
        if ext == '.xlsx':
            return self._load_excel(file_path)
        raise ValueError(f"大文件暂不支持格式: {ext}")
    
    def _optimize_memory(self, df):
        return MemoryOptimizer.optimize_dataframe(df, verbose=True)
    
    def _standardize_data(self, df):
        column_mapping = {
            '材质类型': 'material_type',
            '材料类型': 'material_type',
            '皮料类型': 'material_type',
            '材质': 'material_type',
            '来源': 'source',
            '来源地': 'source',
            '产地': 'source',
            '厚度': 'thickness',
            '厚度(mm)': 'thickness',
            '厚度_mm': 'thickness',
            '抗张强度': 'tensile_strength',
            '抗拉强度': 'tensile_strength',
            '强度': 'tensile_strength',
            '含水量': 'water_content',
            '含水率': 'water_content',
            '水分含量': 'water_content',
            '胶原蛋白比例': 'collagen_ratio',
            '胶原含量': 'collagen_ratio',
            '年龄': 'age_years',
            '年限': 'age_years',
            '保存条件': 'storage_condition',
            '存储条件': 'storage_condition',
            '保存环境': 'storage_condition',
            '采集日期': 'collection_date',
            '检测日期': 'collection_date',
            '日期': 'collection_date'
        }
        
        df = df.rename(columns=column_mapping)
        
        if 'collection_date' in df.columns:
            df['collection_date'] = pd.to_datetime(df['collection_date'], errors='coerce')
        
        if 'material_type' in df.columns:
            df['material_type'] = df['material_type'].astype(str).str.strip()
        
        return df

class MuseumAPIClient:
    def __init__(self):
        self.base_url = Config.MUSEUM_API_URL
        self.api_key = Config.MUSEUM_API_KEY
    
    def get_material_list(self, material_type=None):
        endpoint = f"{self.base_url}/api/v1/materials"
        params = {'api_key': self.api_key}
        if material_type:
            params['type'] = material_type
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            response.raise_for_status()
            return pd.DataFrame(response.json())
        except requests.RequestException:
            return self._get_demo_material_data(material_type)
    
    def get_pigment_data(self, material_id=None):
        endpoint = f"{self.base_url}/api/v1/pigments"
        params = {'api_key': self.api_key}
        if material_id:
            params['material_id'] = material_id
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            response.raise_for_status()
            return pd.DataFrame(response.json())
        except requests.RequestException:
            return self._get_demo_pigment_data()
    
    def _get_demo_material_data(self, material_type=None):
        demo_data = [
            {
                'material_type': '牛皮',
                'source': '陕西皮影博物馆',
                'thickness': 1.2,
                'tensile_strength': 28.5,
                'water_content': 12.3,
                'collagen_ratio': 85.2,
                'age_years': 150,
                'storage_condition': '干燥阴凉',
                'collection_date': datetime(2020, 5, 15)
            },
            {
                'material_type': '驴皮',
                'source': '河北皮影艺术馆',
                'thickness': 0.9,
                'tensile_strength': 32.1,
                'water_content': 10.8,
                'collagen_ratio': 88.5,
                'age_years': 85,
                'storage_condition': '恒温恒湿',
                'collection_date': datetime(2021, 3, 22)
            },
            {
                'material_type': '牛皮',
                'source': '四川皮影研究院',
                'thickness': 1.5,
                'tensile_strength': 25.8,
                'water_content': 14.2,
                'collagen_ratio': 82.1,
                'age_years': 220,
                'storage_condition': '自然环境',
                'collection_date': datetime(2019, 8, 10)
            },
            {
                'material_type': '羊皮',
                'source': '山西皮影博物馆',
                'thickness': 0.7,
                'tensile_strength': 22.3,
                'water_content': 11.5,
                'collagen_ratio': 79.8,
                'age_years': 65,
                'storage_condition': '干燥阴凉',
                'collection_date': datetime(2022, 1, 5)
            }
        ]
        
        df = pd.DataFrame(demo_data)
        if material_type:
            df = df[df['material_type'] == material_type]
        return df
    
    def _get_demo_pigment_data(self):
        demo_pigments = [
            {
                'pigment_name': '朱砂红',
                'chemical_composition': 'HgS',
                'color_l': 45.2,
                'color_a': 62.3,
                'color_b': 35.1,
                'fade_rate': 0.12,
                'light_exposure_hours': 1000
            },
            {
                'pigment_name': '石青',
                'chemical_composition': '2CuCO3·Cu(OH)2',
                'color_l': 38.5,
                'color_a': -15.2,
                'color_b': -52.8,
                'fade_rate': 0.08,
                'light_exposure_hours': 1000
            },
            {
                'pigment_name': '藤黄',
                'chemical_composition': 'C30H34O12',
                'color_l': 75.8,
                'color_a': 18.5,
                'color_b': 85.2,
                'fade_rate': 0.25,
                'light_exposure_hours': 500
            },
            {
                'pigment_name': '墨黑',
                'chemical_composition': 'C',
                'color_l': 12.1,
                'color_a': 0.5,
                'color_b': 0.8,
                'fade_rate': 0.02,
                'light_exposure_hours': 2000
            }
        ]
        return pd.DataFrame(demo_pigments)

class DataManager:
    def __init__(self, chunk_size=1000, use_dask=True, use_cache=True, preload_cache=True):
        self.local_loader = LocalFileLoader(chunk_size=chunk_size, use_dask=use_dask, use_cache=use_cache)
        self.api_client = MuseumAPIClient()
        self.batch_size = chunk_size
        self.use_cache = use_cache
        self.cache = get_cache()
        self.monitor = get_monitor()
        
        if preload_cache and use_cache:
            self._preload_cache()
    
    def _preload_cache(self):
        logger.info("开始预热数据缓存...")
        try:
            museum_df = self.load_from_museum()
            pigment_df = self.get_pigment_data()
            logger.info(f"缓存预热完成，博物馆数据: {len(museum_df)} 行，颜料数据: {len(pigment_df)} 行")
        except Exception as e:
            logger.warning(f"缓存预热失败: {e}")
    
    def load_from_file(self, file_path):
        return self.local_loader.load_file(file_path)
    
    @profile_time
    def load_from_museum(self, material_type=None):
        cache_key = f"museum:{material_type or 'all'}"
        if self.use_cache:
            cached = self.cache.get(cache_key)
            if cached is not None:
                logger.debug(f"从缓存加载博物馆数据: {material_type or '全部'}")
                return cached
        
        df = self.api_client.get_material_list(material_type)
        df = MemoryOptimizer.optimize_dataframe(df, verbose=False)
        
        if self.use_cache:
            self.cache.put(cache_key, df, ttl_seconds=1800)
        
        return df
    
    @profile_time
    def get_pigment_data(self, material_id=None):
        cache_key = f"pigment:{material_id or 'all'}"
        if self.use_cache:
            cached = self.cache.get(cache_key)
            if cached is not None:
                logger.debug(f"从缓存加载颜料数据: {material_id or '全部'}")
                return cached
        
        df = self.api_client.get_pigment_data(material_id)
        df = MemoryOptimizer.optimize_dataframe(df, verbose=False)
        
        if self.use_cache:
            self.cache.put(cache_key, df, ttl_seconds=1800)
        
        return df
    
    def save_to_database(self, df, data_type='material'):
        if df.empty:
            logger.warning("空数据框，跳过保存")
            return False
        
        total_rows = len(df)
        logger.info(f"开始批量保存 {total_rows} 条记录到数据库")
        
        saved_count = 0
        for i in range(0, total_rows, self.batch_size):
            chunk = df.iloc[i:i + self.batch_size]
            session = get_db_session()
            try:
                if data_type == 'material':
                    for _, row in chunk.iterrows():
                        material = MaterialData(
                            material_type=str(row.get('material_type', '')),
                            source=str(row.get('source', '')),
                            thickness=self._safe_float(row.get('thickness')),
                            tensile_strength=self._safe_float(row.get('tensile_strength')),
                            water_content=self._safe_float(row.get('water_content')),
                            collagen_ratio=self._safe_float(row.get('collagen_ratio')),
                            age_years=self._safe_float(row.get('age_years')),
                            storage_condition=str(row.get('storage_condition', '')),
                            collection_date=row.get('collection_date')
                        )
                        session.add(material)
                
                session.commit()
                saved_count += len(chunk)
                logger.info(f"已保存: {saved_count}/{total_rows} 条记录")
            except Exception as e:
                session.rollback()
                logger.error(f"保存批次失败: {e}")
                raise e
            finally:
                session.close()
        
        logger.info(f"批量保存完成，共 {saved_count} 条记录")
        return True
    
    def _safe_float(self, value):
        try:
            if pd.isna(value):
                return None
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def get_all_materials(self):
        session = get_db_session()
        try:
            materials = session.query(MaterialData).all()
            data = []
            for m in materials:
                data.append({
                    'id': m.id,
                    'material_type': m.material_type,
                    'source': m.source,
                    'thickness': m.thickness,
                    'tensile_strength': m.tensile_strength,
                    'water_content': m.water_content,
                    'collagen_ratio': m.collagen_ratio,
                    'age_years': m.age_years,
                    'storage_condition': m.storage_condition,
                    'collection_date': m.collection_date
                })
            return pd.DataFrame(data)
        finally:
            session.close()
