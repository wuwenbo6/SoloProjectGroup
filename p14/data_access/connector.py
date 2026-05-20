import pandas as pd
import numpy as np
import json
import requests
from typing import Dict, Any, Optional, Union, List
import os


class DataConnector:
    def __init__(self):
        self.data: Optional[pd.DataFrame] = None
        self.source_type: Optional[str] = None
        self.source_info: Dict[str, Any] = {}
        self.use_chunking: bool = False
        self.chunk_size: int = 10000

    def _optimize_dtypes(self, df: pd.DataFrame) -> pd.DataFrame:
        for col in df.columns:
            col_type = df[col].dtype
            if col_type == 'object':
                num_unique = df[col].nunique()
                if num_unique / len(df) < 0.5:
                    df[col] = df[col].astype('category')
            elif col_type in ['int64', 'float64']:
                if col_type == 'int64':
                    df[col] = pd.to_numeric(df[col], downcast='integer')
                else:
                    df[col] = pd.to_numeric(df[col], downcast='float')
        return df

    def load_csv(self, file_path: str, use_chunking: bool = False, chunk_size: int = 10000, **kwargs) -> pd.DataFrame:
        try:
            file_size = os.path.getsize(file_path) / (1024 * 1024)
            if file_size > 100 or use_chunking:
                self.use_chunking = True
                self.chunk_size = chunk_size
                chunks = []
                for chunk in pd.read_csv(file_path, chunksize=chunk_size, **kwargs):
                    chunk = self._optimize_dtypes(chunk)
                    chunks.append(chunk)
                self.data = pd.concat(chunks, ignore_index=True)
            else:
                self.data = pd.read_csv(file_path, **kwargs)
                self.data = self._optimize_dtypes(self.data)
            
            self.source_type = "csv"
            self.source_info = {
                "file_path": file_path,
                "file_size_mb": round(file_size, 2),
                "use_chunking": self.use_chunking
            }
            return self.data
        except MemoryError:
            raise Exception("内存不足，请启用分块加载模式 (use_chunking=True)")
        except Exception as e:
            raise Exception(f"CSV加载失败: {str(e)}")

    def load_json(self, file_path: str, orient: str = "records", **kwargs) -> pd.DataFrame:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                self.data = pd.DataFrame(data)
            elif isinstance(data, dict):
                self.data = pd.read_json(file_path, orient=orient, **kwargs)
            else:
                raise ValueError("不支持的JSON格式")
            
            self.source_type = "json"
            self.source_info = {"file_path": file_path}
            return self.data
        except Exception as e:
            raise Exception(f"JSON加载失败: {str(e)}")

    def load_mysql(self, host: str, user: str, password: str, 
                   database: str, query: str, port: int = 3306) -> pd.DataFrame:
        try:
            import mysql.connector
            conn = mysql.connector.connect(
                host=host,
                user=user,
                password=password,
                database=database,
                port=port
            )
            self.data = pd.read_sql(query, conn)
            conn.close()
            self.source_type = "mysql"
            self.source_info = {"host": host, "database": database, "query": query}
            return self.data
        except ImportError:
            raise Exception("请安装mysql-connector-python: pip install mysql-connector-python")
        except Exception as e:
            raise Exception(f"MySQL加载失败: {str(e)}")

    def load_postgresql(self, host: str, user: str, password: str,
                        database: str, query: str, port: int = 5432) -> pd.DataFrame:
        try:
            import psycopg2
            conn = psycopg2.connect(
                host=host,
                user=user,
                password=password,
                database=database,
                port=port
            )
            self.data = pd.read_sql(query, conn)
            conn.close()
            self.source_type = "postgresql"
            self.source_info = {"host": host, "database": database, "query": query}
            return self.data
        except ImportError:
            raise Exception("请安装psycopg2-binary: pip install psycopg2-binary")
        except Exception as e:
            raise Exception(f"PostgreSQL加载失败: {str(e)}")

    def load_api(self, url: str, method: str = "GET", 
                 params: Optional[Dict] = None,
                 headers: Optional[Dict] = None,
                 data_key: Optional[str] = None) -> pd.DataFrame:
        try:
            if method.upper() == "GET":
                response = requests.get(url, params=params, headers=headers)
            elif method.upper() == "POST":
                response = requests.post(url, json=params, headers=headers)
            else:
                raise ValueError(f"不支持的HTTP方法: {method}")
            
            response.raise_for_status()
            json_data = response.json()
            
            if data_key and data_key in json_data:
                json_data = json_data[data_key]
            
            if isinstance(json_data, list):
                self.data = pd.DataFrame(json_data)
            elif isinstance(json_data, dict):
                self.data = pd.DataFrame([json_data])
            else:
                raise ValueError("API返回数据格式不支持")
            
            self.source_type = "api"
            self.source_info = {"url": url, "method": method}
            return self.data
        except Exception as e:
            raise Exception(f"API加载失败: {str(e)}")

    def load_data(self, source_config: Dict[str, Any]) -> pd.DataFrame:
        source_type = source_config.get("type", "").lower()
        
        if source_type == "csv":
            return self.load_csv(
                file_path=source_config["file_path"],
                **source_config.get("options", {})
            )
        elif source_type == "json":
            return self.load_json(
                file_path=source_config["file_path"],
                **source_config.get("options", {})
            )
        elif source_type == "mysql":
            return self.load_mysql(
                host=source_config["host"],
                user=source_config["user"],
                password=source_config["password"],
                database=source_config["database"],
                query=source_config["query"],
                port=source_config.get("port", 3306)
            )
        elif source_type == "postgresql":
            return self.load_postgresql(
                host=source_config["host"],
                user=source_config["user"],
                password=source_config["password"],
                database=source_config["database"],
                query=source_config["query"],
                port=source_config.get("port", 5432)
            )
        elif source_type == "api":
            return self.load_api(
                url=source_config["url"],
                method=source_config.get("method", "GET"),
                params=source_config.get("params"),
                headers=source_config.get("headers"),
                data_key=source_config.get("data_key")
            )
        else:
            raise ValueError(f"不支持的数据源类型: {source_type}")

    def get_data_info(self) -> Dict[str, Any]:
        if self.data is None:
            return {"status": "无数据"}
        
        return {
            "source_type": self.source_type,
            "source_info": self.source_info,
            "rows": len(self.data),
            "columns": len(self.data.columns),
            "column_names": list(self.data.columns),
            "dtypes": self.data.dtypes.astype(str).to_dict(),
            "missing_values": self.data.isnull().sum().to_dict()
        }

    def get_sample_data(self, n: int = 5) -> pd.DataFrame:
        if self.data is None:
            return pd.DataFrame()
        return self.data.head(n)
