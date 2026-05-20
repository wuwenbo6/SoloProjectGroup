import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union
from sklearn.preprocessing import StandardScaler, MinMaxScaler


class DataCleaner:
    def __init__(self, data: Optional[pd.DataFrame] = None):
        self.data = data
        self.cleaning_history: List[Dict[str, Any]] = []

    def set_data(self, data: pd.DataFrame):
        self.data = data.copy()
        self.cleaning_history = []

    def _is_numeric_column(self, col: str) -> bool:
        return np.issubdtype(self.data[col].dtype, np.number)

    def get_missing_summary(self) -> Dict[str, Any]:
        if self.data is None:
            return {}
        
        missing = self.data.isnull().sum()
        missing_percent = (missing / len(self.data)) * 100
        
        return {
            "total_missing": int(missing.sum()),
            "missing_by_column": missing.to_dict(),
            "missing_percent_by_column": missing_percent.to_dict(),
            "columns_with_missing": list(missing[missing > 0].index)
        }

    def handle_missing_values(self, strategy: str = "drop", 
                              columns: Optional[List[str]] = None,
                              fill_value: Any = None) -> pd.DataFrame:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.data.columns.tolist()
        processed_cols = []
        
        if strategy == "drop":
            before_rows = len(self.data)
            self.data = self.data.dropna(subset=target_cols)
            after_rows = len(self.data)
            self._record_history("缺失值处理", f"删除含缺失值行，减少 {before_rows - after_rows} 行")
        
        elif strategy == "fill_mean":
            for col in target_cols:
                if self._is_numeric_column(col):
                    mean_val = self.data[col].mean(skipna=True)
                    before_missing = self.data[col].isnull().sum()
                    self.data[col] = self.data[col].fillna(mean_val)
                    if before_missing > 0:
                        processed_cols.append(f"{col}({before_missing})")
            self._record_history("缺失值处理", f"用均值填充数值列: {', '.join(processed_cols)}")
        
        elif strategy == "fill_median":
            for col in target_cols:
                if self._is_numeric_column(col):
                    median_val = self.data[col].median(skipna=True)
                    before_missing = self.data[col].isnull().sum()
                    self.data[col] = self.data[col].fillna(median_val)
                    if before_missing > 0:
                        processed_cols.append(f"{col}({before_missing})")
            self._record_history("缺失值处理", f"用中位数填充数值列: {', '.join(processed_cols)}")
        
        elif strategy == "fill_mode":
            for col in target_cols:
                before_missing = self.data[col].isnull().sum()
                mode_series = self.data[col].mode(dropna=True)
                if not mode_series.empty:
                    mode_val = mode_series.iloc[0]
                elif fill_value is not None:
                    mode_val = fill_value
                else:
                    continue
                self.data[col] = self.data[col].fillna(mode_val)
                if before_missing > 0:
                    processed_cols.append(f"{col}({before_missing})")
            self._record_history("缺失值处理", f"用众数填充: {', '.join(processed_cols)}")
        
        elif strategy == "fill_value":
            if fill_value is None:
                raise ValueError("fill_value不能为空")
            for col in target_cols:
                before_missing = self.data[col].isnull().sum()
                self.data[col] = self.data[col].fillna(fill_value)
                if before_missing > 0:
                    processed_cols.append(f"{col}({before_missing})")
            self._record_history("缺失值处理", f"用指定值填充: {fill_value}, 列: {', '.join(processed_cols)}")
        
        elif strategy == "ffill":
            for col in target_cols:
                before_missing = self.data[col].isnull().sum()
                self.data[col] = self.data[col].ffill()
                if before_missing > 0:
                    processed_cols.append(f"{col}({before_missing})")
            self._record_history("缺失值处理", f"前向填充: {', '.join(processed_cols)}")
        
        elif strategy == "bfill":
            for col in target_cols:
                before_missing = self.data[col].isnull().sum()
                self.data[col] = self.data[col].bfill()
                if before_missing > 0:
                    processed_cols.append(f"{col}({before_missing})")
            self._record_history("缺失值处理", f"后向填充: {', '.join(processed_cols)}")
        
        else:
            raise ValueError(f"不支持的缺失值处理策略: {strategy}")
        
        return self.data

    def detect_outliers(self, method: str = "iqr", 
                        columns: Optional[List[str]] = None,
                        threshold: float = 1.5) -> Dict[str, Any]:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.data.select_dtypes(include=[np.number]).columns.tolist()
        outlier_summary = {}
        
        for col in target_cols:
            if method == "iqr":
                Q1 = self.data[col].quantile(0.25)
                Q3 = self.data[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - threshold * IQR
                upper_bound = Q3 + threshold * IQR
                outliers = self.data[(self.data[col] < lower_bound) | (self.data[col] > upper_bound)]
                
                outlier_summary[col] = {
                    "count": len(outliers),
                    "percent": len(outliers) / len(self.data) * 100,
                    "lower_bound": lower_bound,
                    "upper_bound": upper_bound,
                    "indices": outliers.index.tolist()
                }
            
            elif method == "zscore":
                z_scores = np.abs((self.data[col] - self.data[col].mean()) / self.data[col].std())
                outliers = self.data[z_scores > threshold]
                
                outlier_summary[col] = {
                    "count": len(outliers),
                    "percent": len(outliers) / len(self.data) * 100,
                    "threshold": threshold,
                    "indices": outliers.index.tolist()
                }
        
        return outlier_summary

    def handle_outliers(self, method: str = "cap",
                        columns: Optional[List[str]] = None,
                        detect_method: str = "iqr",
                        threshold: float = 1.5) -> pd.DataFrame:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.data.select_dtypes(include=[np.number]).columns.tolist()
        
        for col in target_cols:
            if detect_method == "iqr":
                Q1 = self.data[col].quantile(0.25)
                Q3 = self.data[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - threshold * IQR
                upper_bound = Q3 + threshold * IQR
            else:
                mean_val = self.data[col].mean()
                std_val = self.data[col].std()
                lower_bound = mean_val - threshold * std_val
                upper_bound = mean_val + threshold * std_val
            
            if method == "remove":
                self.data = self.data[(self.data[col] >= lower_bound) & (self.data[col] <= upper_bound)]
            elif method == "cap":
                self.data[col] = np.where(self.data[col] < lower_bound, lower_bound, self.data[col])
                self.data[col] = np.where(self.data[col] > upper_bound, upper_bound, self.data[col])
            elif method == "mean":
                mean_val = self.data[col].mean()
                self.data[col] = np.where(
                    (self.data[col] < lower_bound) | (self.data[col] > upper_bound),
                    mean_val,
                    self.data[col]
                )
        
        self._record_history("异常值处理", f"使用{method}方法处理异常值")
        return self.data

    def convert_data_types(self, type_mapping: Dict[str, str]) -> pd.DataFrame:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        for col, dtype in type_mapping.items():
            try:
                if dtype == "datetime":
                    self.data[col] = pd.to_datetime(self.data[col])
                elif dtype == "category":
                    self.data[col] = self.data[col].astype("category")
                else:
                    self.data[col] = self.data[col].astype(dtype)
            except Exception as e:
                print(f"列 {col} 转换为 {dtype} 失败: {str(e)}")
        
        self._record_history("类型转换", f"转换 {len(type_mapping)} 列的数据类型")
        return self.data

    def standardize_text(self, columns: Optional[List[str]] = None) -> pd.DataFrame:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.data.select_dtypes(include=['object']).columns.tolist()
        
        for col in target_cols:
            self.data[col] = self.data[col].astype(str).str.strip()
            self.data[col] = self.data[col].str.lower()
        
        self._record_history("文本标准化", f"标准化 {len(target_cols)} 列文本")
        return self.data

    def remove_duplicates(self, columns: Optional[List[str]] = None) -> pd.DataFrame:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        before_count = len(self.data)
        
        if columns:
            self.data = self.data.drop_duplicates(subset=columns)
        else:
            self.data = self.data.drop_duplicates()
        
        after_count = len(self.data)
        self._record_history("去重", f"删除 {before_count - after_count} 条重复记录")
        return self.data

    def scale_features(self, columns: Optional[List[str]] = None,
                       method: str = "standard") -> pd.DataFrame:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.data.select_dtypes(include=[np.number]).columns.tolist()
        
        if method == "standard":
            scaler = StandardScaler()
        elif method == "minmax":
            scaler = MinMaxScaler()
        else:
            raise ValueError(f"不支持的缩放方法: {method}")
        
        self.data[target_cols] = scaler.fit_transform(self.data[target_cols])
        self._record_history("特征缩放", f"使用{method}方法缩放特征")
        return self.data

    def apply_cleaning_rules(self, rules: Dict[str, Any]) -> pd.DataFrame:
        if "missing_values" in rules:
            self.handle_missing_values(**rules["missing_values"])
        
        if "outliers" in rules:
            self.handle_outliers(**rules["outliers"])
        
        if "type_conversion" in rules:
            self.convert_data_types(rules["type_conversion"])
        
        if "text_standardize" in rules and rules["text_standardize"]:
            self.standardize_text()
        
        if "remove_duplicates" in rules and rules["remove_duplicates"]:
            self.remove_duplicates()
        
        if "feature_scaling" in rules:
            self.scale_features(**rules["feature_scaling"])
        
        return self.data

    def _record_history(self, operation: str, details: str):
        self.cleaning_history.append({
            "operation": operation,
            "details": details,
            "timestamp": pd.Timestamp.now().isoformat()
        })

    def get_cleaning_report(self) -> Dict[str, Any]:
        return {
            "history": self.cleaning_history,
            "missing_summary": self.get_missing_summary(),
            "data_shape": self.data.shape if self.data is not None else None,
            "data_types": self.data.dtypes.astype(str).to_dict() if self.data is not None else None
        }

    def get_cleaned_data(self) -> pd.DataFrame:
        if self.data is None:
            raise ValueError("请先设置数据")
        return self.data.copy()
