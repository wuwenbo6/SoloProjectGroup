"""
烧制参数采集模块 - 传感器数据导入
Data Acquisition Module - Sensor Data Import
"""

import numpy as np
import pandas as pd
import warnings
import json
from typing import Dict, Optional, List, Tuple, Any
from dataclasses import dataclass
from pathlib import Path


class DataImportError(Exception):
    """数据导入异常类"""
    pass


class DataValidationError(Exception):
    """数据校验异常类"""
    pass


@dataclass
class SensorData:
    """传感器数据结构"""
    time: np.ndarray
    temperature: Optional[np.ndarray] = None
    humidity: Optional[np.ndarray] = None
    oxygen: Optional[np.ndarray] = None
    co2: Optional[np.ndarray] = None
    pressure: Optional[np.ndarray] = None
    source_file: Optional[str] = None
    
    def __post_init__(self):
        """初始化后数据类型转换"""
        # 确保所有数组为float64类型
        self.time = np.asarray(self.time, dtype=np.float64)
        if self.temperature is not None:
            self.temperature = np.asarray(self.temperature, dtype=np.float64)
        if self.humidity is not None:
            self.humidity = np.asarray(self.humidity, dtype=np.float64)
        if self.oxygen is not None:
            self.oxygen = np.asarray(self.oxygen, dtype=np.float64)
        if self.co2 is not None:
            self.co2 = np.asarray(self.co2, dtype=np.float64)
        if self.pressure is not None:
            self.pressure = np.asarray(self.pressure, dtype=np.float64)


@dataclass
class DataValidationReport:
    """数据校验报告"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    stats: Dict[str, Any]


class SensorDataImporter:
    """传感器数据导入器 - 支持多种格式与校验"""
    
    # 支持的列名别名
    COLUMN_ALIASES = {
        'time': ['time', 'Time', 'timestamp', 'Timestamp', 't', 'minute', '分钟'],
        'temperature': ['temperature', 'Temperature', 'temp', 'Temp', 'T', '温度', '窑温'],
        'humidity': ['humidity', 'Humidity', 'hum', 'Hum', '湿度'],
        'oxygen': ['oxygen', 'Oxygen', 'o2', 'O2', 'O_2', '氧气'],
        'co2': ['co2', 'CO2', 'Co2', 'carbon_dioxide', '二氧化碳'],
        'pressure': ['pressure', 'Pressure', 'press', '气压', '压力']
    }
    
    # 数据合理范围（基于古法烧制经验）
    DATA_RANGES = {
        'time': (0, 1440),      # 时间范围0-1440分钟
        'temperature': (20, 1450),  # 温度范围20-1450°C
        'humidity': (0, 100),       # 湿度范围0-100%
        'oxygen': (0, 21),          # 氧气0-21%
        'co2': (0, 20),             # CO2 0-20%
        'pressure': (80, 120)       # 气压80-120 kPa
    }
    
    def __init__(self):
        self.data = None
        self.raw_data = None
    
    def _find_column(self, df: pd.DataFrame, column_type: str) -> Optional[str]:
        """查找列名，支持别名"""
        aliases = self.COLUMN_ALIASES.get(column_type, [column_type])
        for alias in aliases:
            if alias in df.columns:
                return alias
        return None
    
    def _convert_to_numeric(self, series: pd.Series, column_name: str) -> np.ndarray:
        """安全转换为数值类型，支持多种格式"""
        try:
            # 移除可能的单位字符
            if series.dtype == object:
                series = series.astype(str)
                # 移除常见单位
                for unit in ['°C', 'C', '%', 'kPa', 'min', 's']:
                    series = series.str.replace(unit, '', regex=False)
                # 处理空值和异常值
                series = series.replace(['', ' ', 'NA', 'NaN', 'None', 'nan'], np.nan)
            
            # 转换为数值
            numeric_values = pd.to_numeric(series, errors='coerce').values
            
            # NaN处理 - 线性插值
            if np.any(np.isnan(numeric_values)):
                nan_count = np.sum(np.isnan(numeric_values))
                warnings.warn(f"{column_name} 列包含 {nan_count} 个 NaN 值，已进行插值处理")
                
                # 线性插值填充NaN
                valid_mask = ~np.isnan(numeric_values)
                if np.any(valid_mask):
                    x = np.arange(len(numeric_values))
                    numeric_values = np.interp(
                        x, x[valid_mask], numeric_values[valid_mask],
                        left=numeric_values[valid_mask][0] if len(numeric_values[valid_mask]) > 0 else 0,
                        right=numeric_values[valid_mask][-1] if len(numeric_values[valid_mask]) > 0 else 0
                    )
            
            return numeric_values
            
        except Exception as e:
            raise DataImportError(f"转换 {column_name} 列失败: {e}")
    
    def _validate_data(self, data: SensorData) -> DataValidationReport:
        """数据校验"""
        errors = []
        warnings_list = []
        stats = {}
        
        # 时间校验
        if len(data.time) < 2:
            errors.append("数据点太少，至少需要2个数据点")
        else:
            time_min, time_max = self.DATA_RANGES['time']
            if np.any(data.time < time_min) or np.any(data.time > time_max):
                warnings_list.append(f"时间超出合理范围 [{time_min}, {time_max}] 分钟")
            
            # 时间单调性检查
            if not np.all(np.diff(data.time) >= 0):
                warnings_list.append("时间序列非单调递增")
            
            # 时间步长检查
            time_diffs = np.diff(data.time)
            if np.std(time_diffs) > np.mean(time_diffs) * 0.1:
                warnings_list.append("时间步长不均匀")
            
            stats['time'] = {
                'min': float(np.min(data.time)),
                'max': float(np.max(data.time)),
                'mean_step': float(np.mean(time_diffs)) if len(time_diffs) > 0 else 0,
                'count': len(data.time)
            }
        
        # 温度校验
        if data.temperature is not None:
            temp_min, temp_max = self.DATA_RANGES['temperature']
            temp_out_of_range = np.sum((data.temperature < temp_min) | (data.temperature > temp_max))
            if temp_out_of_range > 0:
                warnings_list.append(f"温度有 {temp_out_of_range} 个点超出合理范围 [{temp_min}, {temp_max}]°C")
            
            stats['temperature'] = {
                'min': float(np.min(data.temperature)),
                'max': float(np.max(data.temperature)),
                'mean': float(np.mean(data.temperature)),
                'out_of_range_count': int(temp_out_of_range)
            }
        
        # 湿度校验
        if data.humidity is not None:
            hum_min, hum_max = self.DATA_RANGES['humidity']
            hum_out_of_range = np.sum((data.humidity < hum_min) | (data.humidity > hum_max))
            if hum_out_of_range > 0:
                warnings_list.append(f"湿度有 {hum_out_of_range} 个点超出合理范围")
            
            stats['humidity'] = {
                'min': float(np.min(data.humidity)),
                'max': float(np.max(data.humidity)),
                'mean': float(np.mean(data.humidity))
            }
        
        # NaN检查
        for attr in ['temperature', 'humidity', 'oxygen', 'co2', 'pressure']:
            values = getattr(data, attr)
            if values is not None:
                nan_count = np.sum(np.isnan(values))
                if nan_count > 0:
                    warnings_list.append(f"{attr} 包含 {nan_count} 个 NaN 值")
        
        is_valid = len(errors) == 0
        
        return DataValidationReport(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings_list,
            stats=stats
        )
    
    def from_csv(self, file_path: str, encoding: str = 'utf-8',
                 auto_detect_columns: bool = True) -> SensorData:
        """从CSV文件导入数据"""
        try:
            if not Path(file_path).exists():
                raise DataImportError(f"文件不存在: {file_path}")
            
            df = pd.read_csv(file_path, encoding=encoding)
            self.raw_data = df
            
            if auto_detect_columns:
                return self._from_dataframe(df, file_path)
            else:
                return self._from_dataframe_with_columns(df, file_path)
                
        except UnicodeDecodeError:
            # 尝试其他编码
            try:
                df = pd.read_csv(file_path, encoding='gbk')
                self.raw_data = df
                return self._from_dataframe(df, file_path)
            except Exception as e:
                raise DataImportError(f"CSV文件编码错误: {e}")
        except Exception as e:
            raise DataImportError(f"导入CSV文件失败: {e}")
    
    def from_excel(self, file_path: str, sheet_name: str = None,
                   auto_detect_columns: bool = True) -> SensorData:
        """从Excel文件导入数据"""
        try:
            if not Path(file_path).exists():
                raise DataImportError(f"文件不存在: {file_path}")
            
            # 如果未指定sheet，尝试找到数据sheet
            if sheet_name is None:
                xl = pd.ExcelFile(file_path)
                for sheet in xl.sheet_names:
                    df = pd.read_excel(file_path, sheet_name=sheet, nrows=5)
                    if len(df.columns) >= 2:
                        sheet_name = sheet
                        break
                if sheet_name is None:
                    sheet_name = 0
            
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            self.raw_data = df
            
            if auto_detect_columns:
                return self._from_dataframe(df, file_path)
            else:
                return self._from_dataframe_with_columns(df, file_path)
                
        except Exception as e:
            raise DataImportError(f"导入Excel文件失败: {e}")
    
    def from_json(self, file_path: str) -> SensorData:
        """从JSON文件导入数据"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            
            # 支持数组格式或对象格式
            if isinstance(json_data, list):
                df = pd.DataFrame(json_data)
            elif isinstance(json_data, dict):
                df = pd.DataFrame(json_data)
            else:
                raise DataImportError("不支持的JSON格式")
            
            self.raw_data = df
            return self._from_dataframe(df, file_path)
            
        except Exception as e:
            raise DataImportError(f"导入JSON文件失败: {e}")
    
    def _from_dataframe(self, df: pd.DataFrame, source_file: str) -> SensorData:
        """从DataFrame转换为SensorData，自动检测列"""
        data_dict = {'source_file': source_file}
        
        # 查找时间列
        time_col = self._find_column(df, 'time')
        if time_col is None:
            raise DataImportError("未找到时间列")
        data_dict['time'] = self._convert_to_numeric(df[time_col], 'time')
        
        # 自动查找其他列
        for data_type in ['temperature', 'humidity', 'oxygen', 'co2', 'pressure']:
            col_name = self._find_column(df, data_type)
            if col_name is not None:
                data_dict[data_type] = self._convert_to_numeric(df[col_name], data_type)
        
        self.data = SensorData(**data_dict)
        
        # 数据校验
        report = self._validate_data(self.data)
        if not report.is_valid:
            raise DataValidationError(f"数据校验失败: {'; '.join(report.errors)}")
        
        for warning in report.warnings:
            warnings.warn(warning)
        
        return self.data
    
    def _from_dataframe_with_columns(self, df: pd.DataFrame, source_file: str,
                                      column_mapping: Dict[str, str] = None) -> SensorData:
        """使用指定列名从DataFrame转换"""
        if column_mapping is None:
            column_mapping = {}
        
        data_dict = {'source_file': source_file}
        
        for data_type, col_name in column_mapping.items():
            if col_name in df.columns:
                data_dict[data_type] = self._convert_to_numeric(df[col_name], data_type)
        
        if 'time' not in data_dict:
            raise DataImportError("必须指定时间列")
        
        self.data = SensorData(**data_dict)
        
        # 数据校验
        report = self._validate_data(self.data)
        if not report.is_valid:
            raise DataValidationError(f"数据校验失败: {'; '.join(report.errors)}")
        
        return self.data
    
    def generate_sample_data(self, duration: float = 600.0, 
                             steps: int = 1000, noise: float = 2.0) -> SensorData:
        """生成模拟传感器数据（带噪声）"""
        time = np.linspace(0, duration, steps)
        
        target_temp = 1300.0
        heating_rate = 150.0
        heating_time = (target_temp - 25) / heating_rate
        holding_time = 120.0
        
        temperature = np.zeros_like(time)
        for i, t in enumerate(time):
            if t <= heating_time:
                temperature[i] = 25 + heating_rate * t
            elif t <= heating_time + holding_time:
                temperature[i] = target_temp
            else:
                cooling_t = t - heating_time - holding_time
                temperature[i] = max(25, target_temp - 100 * cooling_t)
        
        temperature += np.random.normal(0, noise, size=len(time))
        
        humidity = 60 * np.exp(-0.02 * time)
        humidity = np.maximum(humidity, 0.5)
        humidity += np.random.normal(0, 1.0, size=len(time))
        
        oxygen = np.where(time < heating_time * 0.5, 20.9,
                         np.where(time < heating_time + holding_time, 
                                 8 + 12.9 * np.minimum(1.0, (time - heating_time * 0.5) / (heating_time * 0.5 + holding_time)),
                                 20.9))
        oxygen += np.random.normal(0, 0.5, size=len(time))
        
        co2 = np.where(time < heating_time * 0.5, 0.03,
                      np.where(time < heating_time + holding_time, 3.0, 0.03))
        co2 += np.random.normal(0, 0.1, size=len(time))
        
        self.data = SensorData(
            time=time,
            temperature=temperature,
            humidity=humidity,
            oxygen=oxygen,
            co2=co2
        )
        
        return self.data
    
    def resample(self, new_time: np.ndarray, method: str = 'linear') -> SensorData:
        """重采样数据到新时间轴"""
        if self.data is None:
            raise ValueError("No data loaded")
        
        from scipy.interpolate import interp1d
        
        # 确保新时间轴在原始数据范围内
        new_time = np.asarray(new_time, dtype=np.float64)
        new_time = np.clip(new_time, np.min(self.data.time), np.max(self.data.time))
        
        resampled = SensorData(time=new_time)
        
        # 支持的插值方法
        interpolate_methods = ['linear', 'nearest', 'zero', 'slinear', 'quadratic', 'cubic']
        if method not in interpolate_methods:
            warnings.warn(f"不支持的插值方法 {method}，使用 linear")
            method = 'linear'
        
        for attr in ['temperature', 'humidity', 'oxygen', 'co2', 'pressure']:
            values = getattr(self.data, attr)
            if values is not None:
                try:
                    f = interp1d(self.data.time, values, 
                                kind=method, fill_value='extrapolate',
                                bounds_error=False)
                    setattr(resampled, attr, f(new_time))
                except Exception as e:
                    warnings.warn(f"{attr} 插值失败: {e}")
        
        return resampled
    
    def smooth_data(self, window_size: int = 5) -> SensorData:
        """数据平滑处理"""
        if self.data is None:
            raise ValueError("No data loaded")
        
        if window_size < 3:
            window_size = 3
        
        smoothed = SensorData(time=self.data.time.copy())
        
        for attr in ['temperature', 'humidity', 'oxygen', 'co2', 'pressure']:
            values = getattr(self.data, attr)
            if values is not None:
                # 移动平均平滑
                kernel = np.ones(window_size) / window_size
                smoothed_values = np.convolve(values, kernel, mode='same')
                # 边缘处理
                smoothed_values[:window_size//2] = values[:window_size//2]
                smoothed_values[-window_size//2:] = values[-window_size//2:]
                setattr(smoothed, attr, smoothed_values)
        
        return smoothed
    
    def remove_outliers(self, threshold: float = 3.0) -> SensorData:
        """移除异常值"""
        if self.data is None:
            raise ValueError("No data loaded")
        
        cleaned = SensorData(time=self.data.time.copy())
        
        for attr in ['temperature', 'humidity', 'oxygen', 'co2', 'pressure']:
            values = getattr(self.data, attr)
            if values is not None:
                # Z-score方法检测异常值
                mean_val = np.mean(values)
                std_val = np.std(values)
                if std_val > 0:
                    z_scores = np.abs((values - mean_val) / std_val)
                    outlier_mask = z_scores > threshold
                    
                    # 插值替换异常值
                    cleaned_values = values.copy()
                    valid_mask = ~outlier_mask
                    if np.any(valid_mask):
                        cleaned_values[outlier_mask] = np.interp(
                            np.where(outlier_mask)[0],
                            np.where(valid_mask)[0],
                            values[valid_mask]
                        )
                    setattr(cleaned, attr, cleaned_values)
                else:
                    setattr(cleaned, attr, values.copy())
        
        return cleaned
    
    def get_validation_report(self) -> DataValidationReport:
        """获取数据校验报告"""
        if self.data is None:
            raise ValueError("No data loaded")
        return self._validate_data(self.data)
    
    def get_statistics(self) -> Dict:
        """获取数据统计信息"""
        if self.data is None:
            raise ValueError("No data loaded")
        
        stats = {
            'time_range': [float(self.data.time.min()), float(self.data.time.max())],
            'sample_count': len(self.data.time)
        }
        
        for attr in ['temperature', 'humidity', 'oxygen', 'co2', 'pressure']:
            values = getattr(self.data, attr)
            if values is not None:
                stats[attr] = {
                    'min': float(np.nanmin(values)),
                    'max': float(np.nanmax(values)),
                    'mean': float(np.nanmean(values)),
                    'std': float(np.nanstd(values)),
                    'nan_count': int(np.sum(np.isnan(values)))
                }
        
        return stats
    
    def save_data(self, output_path: str, format: str = 'csv'):
        """保存数据到文件，支持多种格式"""
        if self.data is None:
            raise ValueError("No data to save")
        
        data_dict = {'time': self.data.time}
        
        for attr in ['temperature', 'humidity', 'oxygen', 'co2', 'pressure']:
            values = getattr(self.data, attr)
            if values is not None:
                data_dict[attr] = values
        
        df = pd.DataFrame(data_dict)
        
        output_path = Path(output_path)
        
        if format.lower() == 'csv':
            df.to_csv(output_path, index=False, encoding='utf-8')
        elif format.lower() == 'excel':
            if output_path.suffix not in ['.xlsx', '.xls']:
                output_path = output_path.with_suffix('.xlsx')
            df.to_excel(output_path, index=False)
        elif format.lower() == 'json':
            df.to_json(output_path, orient='records', force_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的保存格式: {format}")
    
    def auto_import(self, file_path: str) -> SensorData:
        """自动识别文件格式并导入"""
        path = Path(file_path)
        suffix = path.suffix.lower()
        
        if suffix == '.csv':
            return self.from_csv(file_path)
        elif suffix in ['.xlsx', '.xls', '.xlsm']:
            return self.from_excel(file_path)
        elif suffix == '.json':
            return self.from_json(file_path)
        else:
            # 尝试所有格式
            for import_func in [self.from_csv, self.from_excel, self.from_json]:
                try:
                    return import_func(file_path)
                except:
                    continue
            raise DataImportError(f"无法识别文件格式: {file_path}")
