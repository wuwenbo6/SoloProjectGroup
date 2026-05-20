import numpy as np
import h5py
import json
import os
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, List, Any, Iterator, Tuple
from datetime import datetime
import pickle
import zlib


@dataclass
class SimulationResultMetadata:
    simulation_id: str
    start_time: float
    end_time: float
    n_steps: int
    config_hash: str
    clay_type: str
    atmosphere: str
    target_temp: float
    memory_usage_mb: float
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


class MemoryMappedResult:
    def __init__(self, filepath: str, mode: str = 'r'):
        self.filepath = filepath
        self.mode = mode
        self._file = None
        self._open()

    def _open(self):
        self._file = h5py.File(self.filepath, self.mode)

    def close(self):
        if self._file is not None:
            self._file.close()
            self._file = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    @property
    def time(self) -> np.ndarray:
        return self._file['data/time'][:]

    @property
    def temperature(self) -> np.ndarray:
        return self._file['data/temperature'][:]

    @property
    def humidity(self) -> np.ndarray:
        return self._file['data/humidity'][:]

    @property
    def oxygen(self) -> np.ndarray:
        return self._file['data/oxygen'][:]

    @property
    def shrinkage(self) -> np.ndarray:
        return self._file['data/shrinkage'][:]

    def get_slice(self, start: int, end: int) -> Dict[str, np.ndarray]:
        return {
            'time': self._file['data/time'][start:end],
            'temperature': self._file['data/temperature'][start:end],
            'humidity': self._file['data/humidity'][start:end],
            'oxygen': self._file['data/oxygen'][start:end],
            'shrinkage': self._file['data/shrinkage'][start:end],
        }

    def get_metadata(self) -> Dict[str, Any]:
        return dict(self._file['metadata'].attrs)

    def iter_chunks(self, chunk_size: int = 1000) -> Iterator[Dict[str, np.ndarray]]:
        n = len(self.time)
        for i in range(0, n, chunk_size):
            yield self.get_slice(i, min(i + chunk_size, n))


class IncrementalResultWriter:
    def __init__(self, filepath: str, config: Dict[str, Any], compression: str = 'gzip'):
        self.filepath = filepath
        self.config = config
        self.compression = compression
        self._buffer_size = 10000
        self._buffers = {
            'time': [],
            'temperature': [],
            'humidity': [],
            'oxygen': [],
            'shrinkage': [],
        }
        self._written_count = 0
        self._file = None
        self._initialize_file()

    def _initialize_file(self):
        with h5py.File(self.filepath, 'w') as f:
            data_group = f.create_group('data')

            data_group.create_dataset(
                'time', shape=(0,), maxshape=(None,),
                dtype=np.float64, compression=self.compression,
                chunks=(self._buffer_size,)
            )
            data_group.create_dataset(
                'temperature', shape=(0,), maxshape=(None,),
                dtype=np.float64, compression=self.compression,
                chunks=(self._buffer_size,)
            )
            data_group.create_dataset(
                'humidity', shape=(0,), maxshape=(None,),
                dtype=np.float64, compression=self.compression,
                chunks=(self._buffer_size,)
            )
            data_group.create_dataset(
                'oxygen', shape=(0,), maxshape=(None,),
                dtype=np.float64, compression=self.compression,
                chunks=(self._buffer_size,)
            )
            data_group.create_dataset(
                'shrinkage', shape=(0,), maxshape=(None,),
                dtype=np.float64, compression=self.compression,
                chunks=(self._buffer_size,)
            )

            meta_group = f.create_group('metadata')
            for key, value in self.config.items():
                if isinstance(value, (int, float, str, bool)):
                    meta_group.attrs[key] = value

    def append(self, data: Dict[str, np.ndarray]):
        for key in self._buffers:
            self._buffers[key].extend(data[key])

        if len(self._buffers['time']) >= self._buffer_size:
            self._flush_buffer()

    def _flush_buffer(self):
        if not self._buffers['time']:
            return

        n_new = len(self._buffers['time'])
        new_total = self._written_count + n_new

        with h5py.File(self.filepath, 'a') as f:
            for key in self._buffers:
                dset = f[f'data/{key}']
                dset.resize((new_total,))
                dset[self._written_count:new_total] = self._buffers[key]

        for key in self._buffers:
            self._buffers[key].clear()

        self._written_count = new_total

    def finalize(self, metadata: Optional[Dict[str, Any]] = None):
        self._flush_buffer()

        if metadata:
            with h5py.File(self.filepath, 'a') as f:
                meta_group = f['metadata']
                for key, value in metadata.items():
                    if isinstance(value, (int, float, str, bool)):
                        meta_group.attrs[key] = value


class CompressedResultStore:
    def __init__(self, base_dir: str = "results"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)
        self.index_file = self.base_dir / "index.json"
        self._index = self._load_index()

    def _load_index(self) -> Dict[str, Any]:
        if self.index_file.exists():
            with open(self.index_file, 'r') as f:
                return json.load(f)
        return {"simulations": {}}

    def _save_index(self):
        with open(self.index_file, 'w') as f:
            json.dump(self._index, f, indent=2)

    def _generate_id(self) -> str:
        return f"sim_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"

    def save_result(
        self,
        result: Dict[str, np.ndarray],
        config: Dict[str, Any],
        compress: bool = True,
    ) -> str:
        sim_id = self._generate_id()
        filepath = self.base_dir / f"{sim_id}.h5"

        writer = IncrementalResultWriter(str(filepath), config)
        writer.append(result)

        metadata = {
            "simulation_id": sim_id,
            "n_steps": len(result['time']),
            "start_time": float(result['time'][0]),
            "end_time": float(result['time'][-1]),
        }
        writer.finalize(metadata)

        self._index["simulations"][sim_id] = {
            "filepath": str(filepath.name),
            "config": {k: v for k, v in config.items()
                      if isinstance(v, (int, float, str, bool))},
            "metadata": metadata,
            "created_at": datetime.now().isoformat(),
        }
        self._save_index()

        return sim_id

    def load_result(self, sim_id: str) -> MemoryMappedResult:
        if sim_id not in self._index["simulations"]:
            raise ValueError(f"Simulation {sim_id} not found")

        info = self._index["simulations"][sim_id]
        filepath = self.base_dir / info["filepath"]
        return MemoryMappedResult(str(filepath))

    def list_simulations(self, **filters) -> List[Dict[str, Any]]:
        results = []
        for sim_id, info in self._index["simulations"].items():
            match = True
            for key, value in filters.items():
                if info.get("config", {}).get(key) != value:
                    match = False
                    break
            if match:
                results.append({"id": sim_id, **info})
        return results

    def delete_result(self, sim_id: str) -> bool:
        if sim_id not in self._index["simulations"]:
            return False

        info = self._index["simulations"][sim_id]
        filepath = self.base_dir / info["filepath"]
        if filepath.exists():
            filepath.unlink()

        del self._index["simulations"][sim_id]
        self._save_index()
        return True


class LightweightResult:
    __slots__ = ['time', 'temperature', 'humidity', 'oxygen', 'shrinkage', '_nbytes']

    def __init__(self, result: Dict[str, np.ndarray]):
        self.time = result['time'].astype(np.float32)
        self.temperature = result['temperature'].astype(np.float32)
        self.humidity = result['humidity'].astype(np.float32)
        self.oxygen = result['oxygen'].astype(np.float32)
        self.shrinkage = result['shrinkage'].astype(np.float32)
        self._nbytes = sum(
            arr.nbytes for arr in
            [self.time, self.temperature, self.humidity, self.oxygen, self.shrinkage]
        )

    @property
    def nbytes(self) -> int:
        return self._nbytes

    def to_dict(self) -> Dict[str, np.ndarray]:
        return {
            'time': self.time,
            'temperature': self.temperature,
            'humidity': self.humidity,
            'oxygen': self.oxygen,
            'shrinkage': self.shrinkage,
        }

    def compress(self) -> bytes:
        data = {
            'time': self.time.tobytes(),
            'temperature': self.temperature.tobytes(),
            'humidity': self.humidity.tobytes(),
            'oxygen': self.oxygen.tobytes(),
            'shrinkage': self.shrinkage.tobytes(),
            'dtype': str(self.time.dtype),
            'shape': self.time.shape,
        }
        pickled = pickle.dumps(data, protocol=pickle.HIGHEST_PROTOCOL)
        return zlib.compress(pickled, level=6)

    @classmethod
    def decompress(cls, compressed_data: bytes) -> 'LightweightResult':
        decompressed = zlib.decompress(compressed_data)
        data = pickle.loads(decompressed)
        dtype = np.dtype(data['dtype'])
        shape = data['shape']

        result = {
            'time': np.frombuffer(data['time'], dtype=dtype).reshape(shape),
            'temperature': np.frombuffer(data['temperature'], dtype=dtype).reshape(shape),
            'humidity': np.frombuffer(data['humidity'], dtype=dtype).reshape(shape),
            'oxygen': np.frombuffer(data['oxygen'], dtype=dtype).reshape(shape),
            'shrinkage': np.frombuffer(data['shrinkage'], dtype=dtype).reshape(shape),
        }
        return cls(result)


def calculate_memory_savings(original: Dict[str, np.ndarray]) -> Dict[str, float]:
    original_mb = sum(arr.nbytes for arr in original.values()) / (1024 * 1024)
    lightweight = LightweightResult(original)
    lightweight_mb = lightweight.nbytes / (1024 * 1024)
    compressed = lightweight.compress()
    compressed_mb = len(compressed) / (1024 * 1024)

    return {
        'original_mb': original_mb,
        'lightweight_mb': lightweight_mb,
        'compressed_mb': compressed_mb,
        'lightweight_saving_pct': (1 - lightweight_mb / original_mb) * 100,
        'compressed_saving_pct': (1 - compressed_mb / original_mb) * 100,
    }


class ResultCache:
    def __init__(self, max_size_mb: float = 100.0):
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self._cache: Dict[str, LightweightResult] = {}
        self._current_size = 0

    def get(self, key: str) -> Optional[Dict[str, np.ndarray]]:
        if key in self._cache:
            return self._cache[key].to_dict()
        return None

    def put(self, key: str, result: Dict[str, np.ndarray]) -> bool:
        if key in self._cache:
            self._current_size -= self._cache[key].nbytes
            del self._cache[key]

        lightweight = LightweightResult(result)
        if self._current_size + lightweight.nbytes > self.max_size_bytes:
            self._evict(lightweight.nbytes)

        if self._current_size + lightweight.nbytes <= self.max_size_bytes:
            self._cache[key] = lightweight
            self._current_size += lightweight.nbytes
            return True
        return False

    def _evict(self, needed_bytes: int):
        keys = list(self._cache.keys())
        for key in keys:
            if self._current_size < needed_bytes:
                break
            self._current_size -= self._cache[key].nbytes
            del self._cache[key]

    def clear(self):
        self._cache.clear()
        self._current_size = 0

    @property
    def usage_pct(self) -> float:
        return (self._current_size / self.max_size_bytes) * 100
