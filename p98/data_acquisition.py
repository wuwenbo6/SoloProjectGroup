import numpy as np
import pandas as pd
from typing import Dict, Optional, List, Tuple
from datetime import datetime
import json


class SensorDataLoader:
    def __init__(self):
        self.data = None
        self.metadata = {}

    def from_csv(self, filepath: str, time_column: str = 'time', 
                 delimiter: str = ',', encoding: str = 'utf-8') -> Dict:
        try:
            df = pd.read_csv(filepath, delimiter=delimiter, encoding=encoding)
            self.data = self._process_dataframe(df, time_column)
            self._validate_and_clean_data()
            return self.data
        except Exception as e:
            raise ValueError(f"CSV文件读取失败: {str(e)}")

    def from_excel(self, filepath: str, sheet_name: str = 0, 
                   time_column: str = 'time') -> Dict:
        try:
            df = pd.read_excel(filepath, sheet_name=sheet_name)
            self.data = self._process_dataframe(df, time_column)
            self._validate_and_clean_data()
            return self.data
        except Exception as e:
            raise ValueError(f"Excel文件读取失败: {str(e)}")

    def from_json(self, filepath: str, time_key: str = 'time') -> Dict:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
            
            if isinstance(raw_data, dict):
                if 'metadata' in raw_data:
                    self.metadata = raw_data['metadata']
                    raw_data = {k: v for k, v in raw_data.items() if k != 'metadata'}
                
                self.data = {}
                for k, v in raw_data.items():
                    if isinstance(v, list):
                        self.data[k] = np.array(v, dtype=float)
                    elif isinstance(v, np.ndarray):
                        self.data[k] = v.astype(float)
                    else:
                        self.data[k] = float(v) if isinstance(v, (int, float)) else v
                
                if time_key not in self.data and 'time' in self.data:
                    time_key = 'time'
            elif isinstance(raw_data, list):
                df = pd.DataFrame(raw_data)
                self.data = self._process_dataframe(df, time_key)
            
            self._validate_and_clean_data()
            return self.data
        except Exception as e:
            raise ValueError(f"JSON文件读取失败: {str(e)}")

    def _process_dataframe(self, df: pd.DataFrame, time_column: str) -> Dict:
        if time_column not in df.columns:
            possible_time_cols = [col for col in df.columns if 'time' in col.lower() or '时间' in col]
            if possible_time_cols:
                time_column = possible_time_cols[0]
            else:
                raise ValueError(f"时间列 '{time_column}' 不存在于数据中，可用列: {list(df.columns)}")
        
        df = df.dropna(subset=[time_column])
        
        time_data = self._parse_time(df[time_column])
        
        data = {'time': time_data}
        
        for col in df.columns:
            if col != time_column:
                col_values = df[col].copy()
                if pd.api.types.is_object_dtype(col_values):
                    col_values = pd.to_numeric(col_values, errors='coerce')
                col_values = col_values.fillna(method='ffill').fillna(0)
                data[col] = col_values.values.astype(float)
        
        return data

    def _parse_time(self, time_series: pd.Series) -> np.ndarray:
        try:
            if pd.api.types.is_numeric_dtype(time_series):
                time_values = time_series.values.astype(float)
                if len(time_values) > 1:
                    time_diff = np.diff(time_values)
                    if np.all(time_diff >= 0):
                        return time_values
                    else:
                        return np.arange(len(time_values)).astype(float)
                return time_values
            else:
                parsed_time = pd.to_datetime(time_series, errors='coerce')
                valid_mask = ~pd.isna(parsed_time)
                if not np.any(valid_mask):
                    return np.arange(len(time_series)).astype(float)
                
                start_time = parsed_time[valid_mask].min()
                time_hours = (parsed_time - start_time).dt.total_seconds().values / 3600
                time_hours[~valid_mask] = np.nan
                
                valid_idx = np.where(valid_mask)[0]
                for i in range(len(time_hours)):
                    if np.isnan(time_hours[i]):
                        prev_idx = valid_idx[valid_idx < i]
                        next_idx = valid_idx[valid_idx > i]
                        if len(prev_idx) > 0 and len(next_idx) > 0:
                            prev_t = time_hours[prev_idx[-1]]
                            next_t = time_hours[next_idx[0]]
                            time_hours[i] = prev_t + (next_t - prev_t) * (i - prev_idx[-1]) / (next_idx[0] - prev_idx[-1])
                        elif len(prev_idx) > 0:
                            time_hours[i] = time_hours[prev_idx[-1]]
                        else:
                            time_hours[i] = time_hours[next_idx[0]]
                
                return time_hours
        except Exception as e:
            print(f"时间解析警告: {str(e)}，使用默认索引")
            return np.arange(len(time_series)).astype(float)

    def _validate_and_clean_data(self) -> None:
        if self.data is None:
            return
        
        if 'time' not in self.data:
            raise ValueError("数据中缺少时间列")
        
        n_time = len(self.data['time'])
        for key, values in self.data.items():
            if key != 'time':
                if len(values) != n_time:
                    print(f"警告: 列 '{key}' 长度与时间列不匹配，已调整")
                    if len(values) > n_time:
                        self.data[key] = values[:n_time]
                    else:
                        self.data[key] = np.pad(values, (0, n_time - len(values)), mode='edge')
        
        sort_idx = np.argsort(self.data['time'])
        for key in self.data:
            self.data[key] = self.data[key][sort_idx]
        
        for key in self.data:
            if key != 'time':
                self.data[key] = np.nan_to_num(self.data[key], nan=0, posinf=0, neginf=0)

    def generate_sample_data(self, duration: float = 168, time_step: float = 1,
                            noise_level: float = 0.05) -> Dict:
        time = np.arange(0, duration + time_step, time_step)
        
        base_temp = 25 + 5 * np.sin(2 * np.pi * time / 24) + 2 * np.sin(2 * np.pi * time / 72)
        temperature = base_temp + np.random.normal(0, noise_level * base_temp, size=len(time))
        
        base_hum = 0.7 - 0.2 * np.exp(-time / 24) + 0.05 * np.sin(2 * np.pi * time / 12)
        humidity = np.clip(base_hum + np.random.normal(0, noise_level, size=len(time)), 0, 1)
        
        biomass = 0.1 * (1 - np.exp(-time / 20)) * (1 + 0.1 * np.sin(2 * np.pi * time / 48))
        biomass += np.random.normal(0, noise_level * biomass, size=len(time))
        
        substrate = 100 * np.exp(-time / 50) + np.random.normal(0, 2, size=len(time))
        substrate = np.maximum(substrate, 0)
        
        product = 80 * (1 - np.exp(-time / 40)) + np.random.normal(0, 1, size=len(time))
        
        self.data = {
            'time': time,
            'temperature': temperature,
            'humidity': humidity,
            'biomass': biomass,
            'substrate': substrate,
            'product': product
        }
        
        self.metadata = {
            'sample_rate': f'{time_step}h',
            'duration': f'{duration}h',
            'noise_level': noise_level,
            'generated_at': datetime.now().isoformat()
        }
        
        return self.data

    def get_data(self) -> Optional[Dict]:
        return self.data

    def get_time_range(self) -> Tuple[float, float]:
        if self.data is None:
            raise ValueError("没有加载数据")
        return (self.data['time'][0], self.data['time'][-1])

    def get_columns(self) -> List[str]:
        if self.data is None:
            return []
        return list(self.data.keys())

    def resample_data(self, new_time_step: float) -> Dict:
        if self.data is None:
            raise ValueError("没有加载数据")
        
        from scipy.interpolate import interp1d
        
        old_time = self.data['time']
        new_time = np.arange(old_time[0], old_time[-1] + new_time_step, new_time_step)
        
        resampled = {'time': new_time}
        
        for key, values in self.data.items():
            if key != 'time':
                interp_func = interp1d(old_time, values, kind='linear', fill_value='extrapolate')
                resampled[key] = interp_func(new_time)
        
        self.data = resampled
        return self.data

    def filter_outliers(self, column: str, z_threshold: float = 3) -> Dict:
        if self.data is None or column not in self.data:
            raise ValueError(f"数据或列 '{column}' 不存在")
        
        values = self.data[column]
        mean_val = np.mean(values)
        std_val = np.std(values)
        
        z_scores = np.abs((values - mean_val) / std_val)
        mask = z_scores <= z_threshold
        
        for key in self.data:
            self.data[key] = self.data[key][mask]
        
        return self.data

    def export_to_csv(self, filepath: str) -> None:
        if self.data is None:
            raise ValueError("没有可导出的数据")
        
        df = pd.DataFrame(self.data)
        df.to_csv(filepath, index=False, encoding='utf-8')

    def export_to_json(self, filepath: str) -> None:
        if self.data is None:
            raise ValueError("没有可导出的数据")
        
        export_data = {k: v.tolist() if isinstance(v, np.ndarray) else v 
                       for k, v in self.data.items()}
        export_data['metadata'] = self.metadata
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
