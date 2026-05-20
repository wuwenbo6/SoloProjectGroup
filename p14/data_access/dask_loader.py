import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List, Callable, Union
from datetime import datetime
import hashlib
import json
import os

try:
    import dask.dataframe as dd
    from dask.distributed import Client, LocalCluster
    DASK_AVAILABLE = True
except ImportError:
    DASK_AVAILABLE = False


class DaskDataLoader:
    """基于Dask的超大数据集加载器，支持超出内存的数据处理"""

    def __init__(self, use_dask: bool = True, n_workers: int = None,
                 memory_limit: str = '4GB', chunk_size: str = '100MB'):
        self.use_dask = use_dask and DASK_AVAILABLE
        self.client: Optional[Client] = None
        self.n_workers = n_workers
        self.memory_limit = memory_limit
        self.chunk_size = chunk_size
        self.data: Optional[Union[dd.DataFrame, pd.DataFrame]] = None
        self.metadata: Dict[str, Any] = {}
        self._init_client()

    def _init_client(self):
        """初始化Dask分布式客户端"""
        if self.use_dask and DASK_AVAILABLE:
            try:
                cluster = LocalCluster(
                    n_workers=self.n_workers,
                    memory_limit=self.memory_limit,
                    processes=True,
                    threads_per_worker=2
                )
                self.client = Client(cluster)
                print(f"✓ Dask客户端已启动: {self.client.dashboard_link}")
            except Exception as e:
                print(f"⚠ Dask初始化失败，将使用Pandas模式: {e}")
                self.use_dask = False

    def load_csv(self, file_path: str, **kwargs) -> Union[dd.DataFrame, pd.DataFrame]:
        """加载CSV文件，自动检测文件大小选择加载方式"""
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        file_size_mb = file_size / (1024 * 1024)

        # 大于100MB自动使用Dask
        use_dask_for_this = self.use_dask and (file_size_mb > 100 or kwargs.get('force_dask', False))

        self.metadata = {
            'source': file_path,
            'file_size_mb': file_size_mb,
            'load_method': 'dask' if use_dask_for_this else 'pandas',
            'loaded_at': datetime.now().isoformat()
        }

        if use_dask_for_this:
            kwargs.pop('force_dask', None)
            self.data = dd.read_csv(
                file_path,
                blocksize=self.chunk_size,
                **kwargs
            )
            print(f"✓ 使用Dask分块加载: {file_size_mb:.2f}MB")
        else:
            self.data = pd.read_csv(file_path, **kwargs)
            print(f"✓ 使用Pandas加载: {file_size_mb:.2f}MB")

        return self.data

    def load_parquet(self, file_path: str, **kwargs) -> Union[dd.DataFrame, pd.DataFrame]:
        """加载Parquet文件"""
        file_size = self._get_dir_size(file_path) if os.path.isdir(file_path) else os.path.getsize(file_path)
        file_size_mb = file_size / (1024 * 1024)

        use_dask_for_this = self.use_dask and (file_size_mb > 50 or kwargs.get('force_dask', False))

        self.metadata = {
            'source': file_path,
            'file_size_mb': file_size_mb,
            'load_method': 'dask' if use_dask_for_this else 'pandas',
            'loaded_at': datetime.now().isoformat()
        }

        if use_dask_for_this:
            kwargs.pop('force_dask', None)
            self.data = dd.read_parquet(file_path, **kwargs)
            print(f"✓ 使用Dask加载Parquet: {file_size_mb:.2f}MB")
        else:
            self.data = pd.read_parquet(file_path, **kwargs)
            print(f"✓ 使用Pandas加载Parquet: {file_size_mb:.2f}MB")

        return self.data

    def _get_dir_size(self, path: str) -> int:
        """计算目录总大小"""
        total = 0
        for entry in os.scandir(path):
            if entry.is_file():
                total += entry.stat().st_size
            elif entry.is_dir():
                total += self._get_dir_size(entry.path)
        return total

    def compute_summary(self) -> pd.DataFrame:
        """计算数据摘要统计（支持Dask分布式计算）"""
        if self.data is None:
            raise ValueError("请先加载数据")

        if isinstance(self.data, dd.DataFrame):
            numeric_cols = self.data.select_dtypes(include=[np.number]).columns.tolist()
            summary = self.data[numeric_cols].describe().compute()
        else:
            numeric_cols = self.data.select_dtypes(include=[np.number]).columns.tolist()
            summary = self.data[numeric_cols].describe()

        return summary

    def sample_data(self, n: int = 1000, random_state: int = 42) -> pd.DataFrame:
        """从数据中采样（Dask支持安全采样）"""
        if self.data is None:
            raise ValueError("请先加载数据")

        if isinstance(self.data, dd.DataFrame):
            frac = min(n / len(self.data), 1.0)
            return self.data.sample(frac=frac, random_state=random_state).compute()
        else:
            return self.data.sample(n=min(n, len(self.data)), random_state=random_state)

    def filter_data(self, filters: Dict[str, Any]) -> Union[dd.DataFrame, pd.DataFrame]:
        """应用过滤条件"""
        if self.data is None:
            raise ValueError("请先加载数据")

        result = self.data
        for col, condition in filters.items():
            if isinstance(condition, tuple) and len(condition) == 2:
                op, value = condition
                if op == '>':
                    result = result[result[col] > value]
                elif op == '>=':
                    result = result[result[col] >= value]
                elif op == '<':
                    result = result[result[col] < value]
                elif op == '<=':
                    result = result[result[col] <= value]
                elif op == '==':
                    result = result[result[col] == value]
                elif op == 'between':
                    result = result[result[col].between(*value)]
            elif isinstance(condition, list):
                result = result[result[col].isin(condition)]

        return result

    def to_pandas(self) -> pd.DataFrame:
        """转换为Pandas DataFrame（注意：仅在内存足够时使用）"""
        if isinstance(self.data, dd.DataFrame):
            return self.data.compute()
        return self.data

    def save_partitioned(self, output_dir: str, format: str = 'parquet',
                         partition_cols: List[str] = None):
        """分分区保存数据，支持断点续传"""
        if self.data is None:
            raise ValueError("请先加载数据")

        os.makedirs(output_dir, exist_ok=True)

        if isinstance(self.data, dd.DataFrame):
            if format == 'parquet':
                self.data.to_parquet(
                    output_dir,
                    partition_on=partition_cols,
                    write_index=False,
                    write_metadata_file=True
                )
            elif format == 'csv':
                self.data.to_csv(
                    os.path.join(output_dir, 'part-*.csv'),
                    index=False
                )
            print(f"✓ 分块保存完成: {output_dir}")
        else:
            if format == 'parquet':
                self.data.to_parquet(os.path.join(output_dir, 'data.parquet'), index=False)
            else:
                self.data.to_csv(os.path.join(output_dir, 'data.csv'), index=False)

    def get_progress(self) -> Dict[str, Any]:
        """获取处理进度信息"""
        if self.data is None:
            return {'status': 'no_data'}

        info = {
            'load_method': self.metadata.get('load_method', 'unknown'),
            'columns': list(self.data.columns),
            'dtypes': self.data.dtypes.astype(str).to_dict()
        }

        if isinstance(self.data, dd.DataFrame):
            info['npartitions'] = self.data.npartitions
            info['known_shape'] = self.data.known_shape
            if self.data.known_shape:
                info['shape'] = self.data.shape

        return info

    def close(self):
        """关闭Dask客户端"""
        if self.client:
            self.client.close()
            print("✓ Dask客户端已关闭")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class StreamingDataProcessor:
    """流式数据处理器，支持处理真正的超大数据"""

    def __init__(self, chunk_size: int = 10000):
        self.chunk_size = chunk_size
        self.aggregators: Dict[str, Callable] = {}
        self.results: Dict[str, Any] = {}

    def process_csv_stream(self, file_path: str, callback: Callable = None):
        """流式处理CSV文件"""
        chunk_iter = pd.read_csv(file_path, chunksize=self.chunk_size)
        total_rows = 0

        for i, chunk in enumerate(chunk_iter):
            total_rows += len(chunk)
            if callback:
                result = callback(chunk, i)
                if result:
                    self.results[f'chunk_{i}'] = result

        print(f"✓ 流式处理完成: {total_rows} 行, {i + 1} 个分块")
        return self.results

    def register_aggregator(self, name: str, func: Callable):
        """注册聚合计算函数"""
        self.aggregators[name] = func

    def run_aggregations(self, file_path: str) -> Dict[str, Any]:
        """在数据流上运行所有注册的聚合函数"""
        chunk_iter = pd.read_csv(file_path, chunksize=self.chunk_size)
        intermediate_results = {name: [] for name in self.aggregators}

        for chunk in chunk_iter:
            for name, func in self.aggregators.items():
                result = func(chunk)
                intermediate_results[name].append(result)

        # 合并结果
        final_results = {}
        for name, results in intermediate_results.items():
            if isinstance(results[0], dict):
                final_results[name] = self._merge_dict_results(results)
            elif isinstance(results[0], (int, float, np.number)):
                final_results[name] = np.mean(results)
            else:
                final_results[name] = results

        return final_results

    def _merge_dict_results(self, results: List[Dict]) -> Dict:
        """合并字典类型的聚合结果"""
        merged = {}
        for r in results:
            for k, v in r.items():
                if k not in merged:
                    merged[k] = []
                merged[k].append(v)
        return {k: np.mean(v) for k, v in merged.items()}
