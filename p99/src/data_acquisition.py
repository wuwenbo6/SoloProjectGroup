import numpy as np
import json
import csv
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class SensorDataImporter:
    def __init__(self):
        self.data = {}
        self.metadata = {}

    def import_csv(self, filepath: str, time_column: str = 'time',
                   encoding: str = 'utf-8') -> Dict[str, np.ndarray]:
        data_dict = {}
        raw_rows = []
        
        with open(filepath, 'r', encoding=encoding) as f:
            reader = csv.DictReader(f)
            columns = reader.fieldnames
            
            if columns is None:
                raise ValueError("CSV文件为空或格式错误")

            for row in reader:
                raw_rows.append(row)

            if len(raw_rows) == 0:
                raise ValueError("CSV文件没有数据行")

            for col in columns:
                values = []
                for row in raw_rows:
                    cell_value = row.get(col, '')
                    try:
                        if cell_value == '' or cell_value is None:
                            values.append(np.nan)
                        else:
                            values.append(float(cell_value))
                    except (ValueError, TypeError):
                        values.append(np.nan)
                
                valid_count = np.sum(~np.isnan(np.array(values)))
                if valid_count > len(values) * 0.5:
                    data_dict[col] = np.array(values)
                else:
                    string_values = [row.get(col, '') for row in raw_rows]
                    data_dict[col] = string_values

        if time_column not in data_dict:
            time_values = np.arange(len(raw_rows))
            data_dict[time_column] = time_values

        self.data = data_dict
        self.metadata['source'] = filepath
        self.metadata['import_time'] = datetime.now().isoformat()
        self.metadata['columns'] = list(data_dict.keys())
        self.metadata['row_count'] = len(raw_rows)

        return data_dict

    def import_json(self, filepath: str, encoding: str = 'utf-8') -> Dict[str, np.ndarray]:
        with open(filepath, 'r', encoding=encoding) as f:
            raw_data = json.load(f)

        data_dict = {}
        max_length = 0
        
        for key, value in raw_data.items():
            if isinstance(value, list):
                max_length = max(max_length, len(value))
                try:
                    numeric_values = []
                    for v in value:
                        if v == '' or v is None:
                            numeric_values.append(np.nan)
                        else:
                            numeric_values.append(float(v))
                    data_dict[key] = np.array(numeric_values)
                except (ValueError, TypeError):
                    data_dict[key] = value
            else:
                data_dict[key] = value

        if 'time' not in data_dict and max_length > 0:
            data_dict['time'] = np.arange(max_length)

        self.data = data_dict
        self.metadata['source'] = filepath
        self.metadata['import_time'] = datetime.now().isoformat()
        self.metadata['columns'] = list(data_dict.keys())

        return data_dict

    def get_time_series(self, parameter: str) -> Tuple[np.ndarray, np.ndarray]:
        if 'time' not in self.data:
            raise KeyError("时间列不存在，请确保数据包含'time'字段")

        if parameter not in self.data:
            raise KeyError(f"参数'{parameter}'不存在")

        return self.data['time'], self.data[parameter]

    def get_available_parameters(self) -> List[str]:
        return [k for k in self.data.keys() if k != 'time']


class DataPreprocessor:
    @staticmethod
    def remove_outliers(data: np.ndarray, threshold: float = 3.0) -> np.ndarray:
        data = np.asarray(data, dtype=np.float64)
        valid_mask = ~np.isnan(data)
        
        if np.sum(valid_mask) == 0:
            return data
        
        mean = np.mean(data[valid_mask])
        std = np.std(data[valid_mask])
        if std == 0:
            std = 1.0
        
        z_scores = np.abs((data - mean) / std)
        cleaned = np.where(z_scores > threshold, np.nan, data)
        return cleaned

    @staticmethod
    def interpolate_missing(time: np.ndarray, data: np.ndarray,
                             method: str = 'linear') -> np.ndarray:
        from scipy.interpolate import interp1d

        time = np.asarray(time, dtype=np.float64)
        data = np.asarray(data, dtype=np.float64)
        
        valid_mask = ~np.isnan(data)
        if np.all(valid_mask):
            return data

        valid_time = time[valid_mask]
        valid_data = data[valid_mask]

        if len(valid_time) < 2:
            fill_value = valid_data[0] if len(valid_data) > 0 else np.nan
            return np.full_like(data, fill_value)

        f = interp1d(valid_time, valid_data, kind=method,
                     bounds_error=False,
                     fill_value=(valid_data[0], valid_data[-1]))
        return f(time)

    @staticmethod
    def smooth_data(data: np.ndarray, window_size: int = 5) -> np.ndarray:
        data = np.asarray(data, dtype=np.float64)
        
        if window_size < 3 or len(data) < window_size:
            return data

        nan_mask = np.isnan(data)
        if np.any(nan_mask):
            data_filled = data.copy()
            data_filled[nan_mask] = np.interp(
                np.flatnonzero(nan_mask),
                np.flatnonzero(~nan_mask),
                data[~nan_mask]
            )
            data = data_filled

        kernel = np.ones(window_size) / window_size
        smoothed = np.convolve(data, kernel, mode='same')
        return smoothed

    @staticmethod
    def resample(time_old: np.ndarray, data: np.ndarray,
                  time_new: np.ndarray, method: str = 'linear') -> np.ndarray:
        from scipy.interpolate import interp1d
        
        time_old = np.asarray(time_old, dtype=np.float64)
        data = np.asarray(data, dtype=np.float64)
        time_new = np.asarray(time_new, dtype=np.float64)
        
        nan_mask = np.isnan(data)
        if np.any(nan_mask):
            data = DataPreprocessor.interpolate_missing(time_old, data, method)
        
        f = interp1d(time_old, data, kind=method,
                     bounds_error=False,
                     fill_value=(data[0], data[-1]))
        return f(time_new)

    @staticmethod
    def calculate_gradient(time: np.ndarray, data: np.ndarray) -> np.ndarray:
        time = np.asarray(time, dtype=np.float64)
        data = np.asarray(data, dtype=np.float64)
        
        nan_mask = np.isnan(data)
        if np.any(nan_mask):
            data = DataPreprocessor.interpolate_missing(time, data)
        
        return np.gradient(data, time)


class KilnDataProcessor:
    def __init__(self):
        self.importer = SensorDataImporter()
        self.preprocessor = DataPreprocessor()
        self.processed_data = {}

    def load_and_process(self, filepath: str, file_type: str = 'csv',
                         smooth_window: int = 5) -> Dict[str, np.ndarray]:
        if file_type == 'csv':
            raw_data = self.importer.import_csv(filepath)
        elif file_type == 'json':
            raw_data = self.importer.import_json(filepath)
        else:
            raise ValueError(f"不支持的文件类型: {file_type}")

        time = raw_data.get('time')
        if time is None:
            raise ValueError("数据中缺少时间列")

        self.processed_data['time'] = time

        for param in self.importer.get_available_parameters():
            data = raw_data[param]
            if isinstance(data, np.ndarray) and np.issubdtype(data.dtype, np.number):
                cleaned = self.preprocessor.remove_outliers(data)
                interpolated = self.preprocessor.interpolate_missing(time, cleaned)
                smoothed = self.preprocessor.smooth_data(interpolated, smooth_window)
                self.processed_data[param] = smoothed
                self.processed_data[f'{param}_gradient'] = \
                    self.preprocessor.calculate_gradient(time, smoothed)
            else:
                self.processed_data[param] = data

        return self.processed_data

    def extract_temperature_profile(self) -> List[List[float]]:
        if 'temperature' not in self.processed_data:
            raise KeyError("处理后的数据中没有温度数据")

        time = self.processed_data['time']
        temp = self.processed_data['temperature']

        profile_points = []
        for i in range(0, len(time), max(1, len(time) // 50)):
            profile_points.append([float(time[i]), float(temp[i])])

        if profile_points[-1][0] != time[-1]:
            profile_points.append([float(time[-1]), float(temp[-1])])

        return profile_points

    def save_processed_data(self, filepath: str):
        save_dict = {}
        for key, value in self.processed_data.items():
            if isinstance(value, np.ndarray):
                save_dict[key] = value.tolist()
            else:
                save_dict[key] = value

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(save_dict, f, indent=4, ensure_ascii=False)
