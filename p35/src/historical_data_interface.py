import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime
import json
import os
from pathlib import Path


@dataclass
class HistoricalBatchData:
    """历史批次数据结构"""
    batch_id: str
    product_type: str
    start_date: str
    end_date: str
    duration_hours: float
    initial_conditions: Dict[str, float]
    time_series: Dict[str, np.ndarray]
    process_parameters: Dict[str, float]
    quality_metrics: Dict[str, float]
    notes: str = ""
    metadata: Dict = field(default_factory=dict)


class HistoricalDataInterface:
    """古法酿造历史数据接口"""

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = Path(data_dir) if data_dir else Path.home() / "fermentation_data"
        self.data_dir.mkdir(exist_ok=True, parents=True)
        self.batch_cache: Dict[str, HistoricalBatchData] = {}
        self._supported_formats = ['.csv', '.json', '.h5', '.xlsx']

    def discover_batches(self) -> List[str]:
        """发现所有可用的历史批次数据文件"""
        batch_files = []
        for ext in self._supported_formats:
            batch_files.extend(self.data_dir.glob(f"*{ext}"))
        return [str(f) for f in batch_files]

    def import_batch_from_csv(self, filepath: str, product_type: str = "米酒") -> HistoricalBatchData:
        """从CSV文件导入单批次数据"""
        df = pd.read_csv(filepath)

        time_col = None
        for col in df.columns:
            if 'time' in col.lower() or 'hour' in col.lower():
                time_col = col
                break

        if time_col is None:
            time_data = np.arange(len(df)) * 1.0
        else:
            time_data = df[time_col].values

        time_series = {}
        for col in df.columns:
            if col != time_col:
                time_series[col] = df[col].values

        batch_id = Path(filepath).stem
        duration = float(time_data[-1]) if len(time_data) > 0 else 0.0

        initial_conditions = {}
        for key, values in time_series.items():
            if len(values) > 0:
                initial_conditions[key] = float(values[0])

        process_params = self._extract_process_params(time_series)
        quality_metrics = self._calculate_quality_metrics(time_series)

        batch_data = HistoricalBatchData(
            batch_id=batch_id,
            product_type=product_type,
            start_date=str(df.index[0]) if hasattr(df.index[0], 'strftime') else "",
            end_date=str(df.index[-1]) if hasattr(df.index[-1], 'strftime') else "",
            duration_hours=duration,
            initial_conditions=initial_conditions,
            time_series=time_series,
            process_parameters=process_params,
            quality_metrics=quality_metrics
        )

        self.batch_cache[batch_id] = batch_data
        return batch_data

    def import_batch_from_json(self, filepath: str) -> HistoricalBatchData:
        """从JSON文件导入单批次数据"""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        time_series = {}
        for key, values in data.get('time_series', {}).items():
            time_series[key] = np.array(values, dtype=np.float64)

        batch_data = HistoricalBatchData(
            batch_id=data.get('batch_id', Path(filepath).stem),
            product_type=data.get('product_type', '米酒'),
            start_date=data.get('start_date', ''),
            end_date=data.get('end_date', ''),
            duration_hours=float(data.get('duration_hours', 0)),
            initial_conditions=data.get('initial_conditions', {}),
            time_series=time_series,
            process_parameters=data.get('process_parameters', {}),
            quality_metrics=data.get('quality_metrics', {}),
            notes=data.get('notes', ''),
            metadata=data.get('metadata', {})
        )

        self.batch_cache[batch_data.batch_id] = batch_data
        return batch_data

    def _extract_process_params(self, time_series: Dict[str, np.ndarray]) -> Dict[str, float]:
        """从时间序列提取工艺参数"""
        params = {}

        temp_key = None
        for key in time_series.keys():
            if 'temp' in key.lower() or '温度' in key:
                temp_key = key
                break

        if temp_key:
            temps = time_series[temp_key]
            params['avg_temperature'] = float(np.mean(temps))
            params['max_temperature'] = float(np.max(temps))
            params['min_temperature'] = float(np.min(temps))
            params['temp_std'] = float(np.std(temps))

        ph_key = None
        for key in time_series.keys():
            if 'ph' in key.lower():
                ph_key = key
                break

        if ph_key:
            phs = time_series[ph_key]
            params['avg_ph'] = float(np.mean(phs))
            params['final_ph'] = float(phs[-1])

        sugar_key = None
        for key in time_series.keys():
            if 'sugar' in key.lower() or '糖' in key:
                sugar_key = key
                break

        if sugar_key:
            sugars = time_series[sugar_key]
            params['initial_sugar'] = float(sugars[0])
            params['final_sugar'] = float(sugars[-1])
            params['sugar_consumption'] = float(sugars[0] - sugars[-1])

        alcohol_key = None
        for key in time_series.keys():
            if 'alcohol' in key.lower() or '酒' in key:
                alcohol_key = key
                break

        if alcohol_key:
            alcohols = time_series[alcohol_key]
            params['final_alcohol'] = float(alcohols[-1])
            params['max_alcohol'] = float(np.max(alcohols))

        return params

    def _calculate_quality_metrics(self, time_series: Dict[str, np.ndarray]) -> Dict[str, float]:
        """计算质量指标"""
        metrics = {
            'fermentation_efficiency': 0.0,
            'sugar_utilization': 0.0,
            'process_stability': 0.0
        }

        sugar_key = None
        alcohol_key = None
        temp_key = None

        for key in time_series.keys():
            if 'sugar' in key.lower() or '糖' in key:
                sugar_key = key
            elif 'alcohol' in key.lower() or '酒' in key:
                alcohol_key = key
            elif 'temp' in key.lower() or '温度' in key:
                temp_key = key

        if sugar_key and alcohol_key:
            sugars = time_series[sugar_key]
            alcohols = time_series[alcohol_key]
            if sugars[0] > 0:
                metrics['sugar_utilization'] = float((sugars[0] - sugars[-1]) / sugars[0])
                metrics['fermentation_efficiency'] = float(alcohols[-1] / (sugars[0] + 1e-6) * 100)

        if temp_key:
            temps = time_series[temp_key]
            target_temp = 30.0
            deviations = np.abs(temps - target_temp) / target_temp
            metrics['process_stability'] = float(1.0 - np.mean(deviations))

        return metrics

    def auto_import_all(self, product_type: Optional[str] = None) -> List[HistoricalBatchData]:
        """自动导入目录下所有历史数据"""
        all_batches = []
        batch_files = self.discover_batches()

        for filepath in batch_files:
            try:
                if filepath.endswith('.csv'):
                    batch = self.import_batch_from_csv(filepath, product_type or "米酒")
                    all_batches.append(batch)
                elif filepath.endswith('.json'):
                    batch = self.import_batch_from_json(filepath)
                    all_batches.append(batch)
            except Exception as e:
                print(f"导入文件 {filepath} 时出错: {e}")

        return all_batches

    def get_batch_by_id(self, batch_id: str) -> Optional[HistoricalBatchData]:
        """根据批次ID获取数据"""
        return self.batch_cache.get(batch_id)

    def get_batches_by_product(self, product_type: str) -> List[HistoricalBatchData]:
        """根据产品类型筛选批次"""
        return [b for b in self.batch_cache.values() if b.product_type == product_type]

    def export_batch_to_json(self, batch_id: str, output_path: Optional[str] = None) -> str:
        """导出批次数据到JSON"""
        batch = self.get_batch_by_id(batch_id)
        if not batch:
            raise ValueError(f"批次 {batch_id} 不存在")

        serializable = {
            'batch_id': batch.batch_id,
            'product_type': batch.product_type,
            'start_date': batch.start_date,
            'end_date': batch.end_date,
            'duration_hours': batch.duration_hours,
            'initial_conditions': batch.initial_conditions,
            'time_series': {k: v.tolist() for k, v in batch.time_series.items()},
            'process_parameters': batch.process_parameters,
            'quality_metrics': batch.quality_metrics,
            'notes': batch.notes,
            'metadata': batch.metadata
        }

        if output_path is None:
            output_path = str(self.data_dir / f"{batch_id}_export.json")

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(serializable, f, indent=2, ensure_ascii=False)

        return output_path


class SampleDataGenerator:
    """古法酿造示例数据生成器"""

    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)

    def generate_rice_wine_samples(self, n_batches: int = 5) -> List[str]:
        """生成米酒发酵示例数据"""
        files = []

        recipes = [
            {"name": "传统甜型", "temp": 28, "duration": 96, "sugar": 180},
            {"name": "半干型", "temp": 30, "duration": 120, "sugar": 200},
            {"name": "干型", "temp": 32, "duration": 144, "sugar": 220},
            {"name": "香雪型", "temp": 26, "duration": 72, "sugar": 160},
            {"name": "加饭型", "temp": 31, "duration": 168, "sugar": 240}
        ]

        for i in range(min(n_batches, len(recipes))):
            recipe = recipes[i]
            batch_id = f"RW_{datetime.now().strftime('%Y%m%d')}_{i+1:03d}"
            files.append(self._generate_single_batch(batch_id, recipe))

        return files

    def _generate_single_batch(self, batch_id: str, recipe: Dict) -> str:
        """生成单批次示例数据"""
        np.random.seed(hash(batch_id) % 10000)

        n_hours = int(recipe['duration'])
        time = np.arange(n_hours)

        temp_base = recipe['temp']
        temp_variation = 2 * np.sin(time / 12) + np.random.normal(0, 0.3, n_hours)
        temperature = temp_base + temp_variation

        ph_initial = 5.5
        ph_final = 3.8 + np.random.uniform(-0.2, 0.2)
        ph = ph_initial - (ph_initial - ph_final) * (1 - np.exp(-time / 24))
        ph += np.random.normal(0, 0.05, n_hours)

        sugar_initial = recipe['sugar']
        sugar = sugar_initial * np.exp(-time / 30)
        sugar += np.random.normal(0, 2, n_hours)
        sugar = np.maximum(sugar, 0)

        alcohol = (sugar_initial - sugar) * 0.51
        alcohol += np.random.normal(0, 0.5, n_hours)
        alcohol = np.maximum(alcohol, 0)

        yeast = 1e6 * (1 + 0.5 * np.sin(time / 10)) * np.exp(-time / 100)
        yeast += np.random.normal(0, 1e5, n_hours)
        yeast = np.maximum(yeast, 1e5)

        df = pd.DataFrame({
            'time_hours': time,
            'temperature': temperature.round(2),
            'ph': ph.round(3),
            'sugar_concentration': sugar.round(2),
            'alcohol_content': alcohol.round(2),
            'yeast_count': yeast.astype(int)
        })

        filepath = self.output_dir / f"{batch_id}.csv"
        df.to_csv(filepath, index=False)
        return str(filepath)


class APIClient:
    """外部API数据客户端"""

    def __init__(self, base_url: str = "http://api.fermentation.example.com"):
        self.base_url = base_url
        self.session = None

    def fetch_batch_list(self, start_date: str, end_date: str) -> List[Dict]:
        """从API获取批次列表（模拟实现）"""
        return [
            {"batch_id": f"API_{i:03d}", "date": f"2024-{m:02d}-{d:02d}"}
            for i, (m, d) in enumerate(zip(range(1, 7), range(5, 30, 5)))
        ]

    def fetch_batch_data(self, batch_id: str) -> Optional[Dict]:
        """从API获取单批次数据（模拟）"""
        return None
