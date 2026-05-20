import h5py
import json
import numpy as np
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime


class DataStorage:
    def __init__(self, data_dir: str = './data'):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.hdf5_path = self.data_dir / 'simulation_results.h5'
        self.config_dir = self.data_dir / 'configs'
        self.config_dir.mkdir(exist_ok=True)
    
    def save_simulation_result(self, time: np.ndarray, tension: np.ndarray,
                                params: Dict[str, Any], metadata: Optional[Dict] = None,
                                dataset_name: Optional[str] = None) -> str:
        if dataset_name is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            dataset_name = f"sim_{timestamp}"
        
        with h5py.File(self.hdf5_path, 'a') as f:
            if dataset_name in f:
                del f[dataset_name]
            
            grp = f.create_group(dataset_name)
            
            grp.create_dataset('time', data=time, compression='gzip')
            grp.create_dataset('tension', data=tension, compression='gzip')
            
            grp.attrs['saved_at'] = datetime.now().isoformat()
            
            for key, value in params.items():
                if isinstance(value, (int, float, str)):
                    grp.attrs[f'param_{key}'] = value
            
            if metadata:
                for key, value in metadata.items():
                    if isinstance(value, (int, float, str, list)):
                        if isinstance(value, list):
                            value = json.dumps(value)
                        grp.attrs[f'meta_{key}'] = value
        
        return dataset_name
    
    def load_simulation_result(self, dataset_name: str) -> Dict[str, Any]:
        with h5py.File(self.hdf5_path, 'r') as f:
            if dataset_name not in f:
                raise ValueError(f"Dataset {dataset_name} not found")
            
            grp = f[dataset_name]
            
            time = np.array(grp['time'])
            tension = np.array(grp['tension'])
            
            params = {}
            metadata = {}
            
            for key, value in grp.attrs.items():
                if key.startswith('param_'):
                    params[key[6:]] = value
                elif key.startswith('meta_'):
                    try:
                        metadata[key[5:]] = json.loads(value)
                    except (json.JSONDecodeError, TypeError):
                        metadata[key[5:]] = value
            
            return {
                'time': time,
                'tension': tension,
                'params': params,
                'metadata': metadata
            }
    
    def list_datasets(self) -> List[str]:
        if not self.hdf5_path.exists():
            return []
        
        with h5py.File(self.hdf5_path, 'r') as f:
            return list(f.keys())
    
    def get_dataset_info(self, dataset_name: str) -> Dict[str, Any]:
        with h5py.File(self.hdf5_path, 'r') as f:
            if dataset_name not in f:
                raise ValueError(f"Dataset {dataset_name} not found")
            
            grp = f[dataset_name]
            
            info = {
                'name': dataset_name,
                'n_samples': len(grp['time']),
                'time_range': (float(grp['time'][0]), float(grp['time'][-1])),
                'tension_range': (float(np.min(grp['tension'])), float(np.max(grp['tension']))),
                'saved_at': grp.attrs.get('saved_at', 'unknown')
            }
            
            params = {}
            for key, value in grp.attrs.items():
                if key.startswith('param_'):
                    params[key[6:]] = value
            info['params'] = params
            
            return info
    
    def delete_dataset(self, dataset_name: str) -> bool:
        with h5py.File(self.hdf5_path, 'a') as f:
            if dataset_name in f:
                del f[dataset_name]
                return True
            return False
    
    def save_config(self, config: Dict[str, Any], config_name: str) -> str:
        config_path = self.config_dir / f"{config_name}.json"
        
        config_with_meta = {
            'config': config,
            'saved_at': datetime.now().isoformat(),
            'version': '1.0'
        }
        
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_with_meta, f, indent=2, ensure_ascii=False)
        
        return str(config_path)
    
    def load_config(self, config_name: str) -> Dict[str, Any]:
        config_path = self.config_dir / f"{config_name}.json"
        
        if not config_path.exists():
            raise ValueError(f"Config {config_name} not found")
        
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return data.get('config', data)
    
    def list_configs(self) -> List[str]:
        configs = []
        for f in self.config_dir.glob('*.json'):
            configs.append(f.stem)
        return configs
    
    def save_batch_results(self, results: List[Dict], batch_name: str) -> str:
        with h5py.File(self.hdf5_path, 'a') as f:
            if batch_name in f:
                del f[batch_name]
            
            grp = f.create_group(batch_name)
            grp.attrs['type'] = 'batch'
            grp.attrs['count'] = len(results)
            grp.attrs['saved_at'] = datetime.now().isoformat()
            
            for i, result in enumerate(results):
                subgrp = grp.create_group(f'result_{i}')
                subgrp.create_dataset('time', data=result['time'], compression='gzip')
                subgrp.create_dataset('tension', data=result['tension'], compression='gzip')
                
                if 'params' in result:
                    for key, value in result['params'].items():
                        if isinstance(value, (int, float, str)):
                            subgrp.attrs[f'param_{key}'] = value
        
        return batch_name
    
    def load_batch_results(self, batch_name: str) -> List[Dict]:
        with h5py.File(self.hdf5_path, 'r') as f:
            if batch_name not in f:
                raise ValueError(f"Batch {batch_name} not found")
            
            grp = f[batch_name]
            results = []
            
            for key in sorted(grp.keys()):
                if key.startswith('result_'):
                    subgrp = grp[key]
                    result = {
                        'time': np.array(subgrp['time']),
                        'tension': np.array(subgrp['tension']),
                        'params': {}
                    }
                    
                    for attr_key, value in subgrp.attrs.items():
                        if attr_key.startswith('param_'):
                            result['params'][attr_key[6:]] = value
                    
                    results.append(result)
            
            return results
    
    def export_to_csv(self, dataset_name: str, output_path: Optional[str] = None) -> str:
        result = self.load_simulation_result(dataset_name)
        
        if output_path is None:
            output_path = self.data_dir / f"{dataset_name}.csv"
        
        output_path = Path(output_path)
        
        header = "time,tension"
        for key, value in result['params'].items():
            header += f",{key}"
        
        data = np.column_stack([result['time'], result['tension']])
        for _ in range(len(result['params'])):
            data = np.column_stack([data, np.full(len(result['time']), list(result['params'].values())[list(result['params']).index(list(result['params'].keys())[0])])])
        
        np.savetxt(output_path, data, delimiter=',', header=header, comments='')
        
        return str(output_path)
    
    def get_statistics_summary(self) -> Dict[str, Any]:
        datasets = self.list_datasets()
        
        if not datasets:
            return {'datasets': []}
        
        summary = {
            'total_datasets': len(datasets),
            'datasets': []
        }
        
        for ds in datasets:
            try:
                info = self.get_dataset_info(ds)
                summary['datasets'].append({
                    'name': ds,
                    'n_samples': info['n_samples'],
                    'mean_tension': (info['tension_range'][0] + info['tension_range'][1]) / 2
                })
            except Exception:
                continue
        
        return summary
    
    def backup_data(self, backup_name: Optional[str] = None) -> str:
        if backup_name is None:
            backup_name = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        backup_path = self.data_dir / f"{backup_name}.h5"
        
        if self.hdf5_path.exists():
            import shutil
            shutil.copy2(self.hdf5_path, backup_path)
        
        return str(backup_path)
    
    def optimize_storage(self) -> Dict[str, int]:
        if not self.hdf5_path.exists():
            return {'reclaimed': 0}
        
        original_size = self.hdf5_path.stat().st_size
        
        temp_path = self.data_dir / 'temp_optimized.h5'
        
        with h5py.File(self.hdf5_path, 'r') as src:
            with h5py.File(temp_path, 'w') as dst:
                for key in src.keys():
                    src.copy(key, dst)
        
        temp_path.replace(self.hdf5_path)
        
        new_size = self.hdf5_path.stat().st_size
        
        return {
            'original_size': original_size,
            'new_size': new_size,
            'reclaimed': original_size - new_size
        }