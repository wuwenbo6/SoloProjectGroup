import os
import json
import zipfile
import io
from typing import List, Dict, Optional
from datetime import datetime
import soundfile as sf
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

logger = logging.getLogger(__name__)

class BatchSynthesisExporter:
    def __init__(self, sample_rate: int = 22050, output_dir: str = "./batch_output"):
        self.sample_rate = sample_rate
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.max_workers = min(4, os.cpu_count() or 2)
    
    def _generate_filename(self, text: str, dialect_id: int, emotion: str, index: int) -> str:
        text_preview = text[:20].replace(" ", "_").replace("/", "_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{index:04d}_dialect{dialect_id}_{emotion}_{text_preview}_{timestamp}.wav"
    
    def _create_metadata(self, results: List[Dict]) -> Dict:
        return {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "total_items": len(results),
            "sample_rate": self.sample_rate,
            "items": [
                {
                    "index": i,
                    "filename": r.get("filename", ""),
                    "text": r.get("text", ""),
                    "dialect_id": r.get("dialect_id", 0),
                    "emotion": r.get("emotion", "neutral"),
                    "speed": r.get("speed", 1.0),
                    "pitch": r.get("pitch", 1.0),
                    "duration": r.get("duration", 0),
                    "success": r.get("success", False)
                }
                for i, r in enumerate(results)
            ]
        }
    
    def export_to_zip(
        self,
        synthesis_results: List[Dict],
        waveforms: List[np.ndarray],
        texts: List[str],
        zip_filename: Optional[str] = None
    ) -> Dict:
        try:
            if zip_filename is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                zip_filename = f"dialect_synthesis_batch_{timestamp}.zip"
            
            zip_path = os.path.join(self.output_dir, zip_filename)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                metadata = self._create_metadata(synthesis_results)
                
                for i, (result, waveform, text) in enumerate(zip(synthesis_results, waveforms, texts)):
                    if result.get("success", False) and waveform is not None:
                        filename = self._generate_filename(
                            text,
                            result.get("dialect_id", 0),
                            result.get("emotion", "neutral"),
                            i
                        )
                        
                        wav_buffer = io.BytesIO()
                        sf.write(wav_buffer, waveform, self.sample_rate, format='WAV')
                        wav_buffer.seek(0)
                        
                        zipf.writestr(filename, wav_buffer.read())
                        
                        result["filename"] = filename
                
                metadata_json = json.dumps(metadata, indent=2, ensure_ascii=False)
                zipf.writestr("metadata.json", metadata_json)
                
                readme = self._generate_readme(metadata)
                zipf.writestr("README.txt", readme)
            
            file_size = os.path.getsize(zip_path)
            
            return {
                "success": True,
                "zip_path": zip_path,
                "zip_filename": zip_filename,
                "file_size_mb": file_size / (1024 * 1024),
                "total_files": len(synthesis_results),
                "successful_files": sum(1 for r in synthesis_results if r.get("success", False))
            }
            
        except Exception as e:
            logger.error(f"ZIP导出失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _generate_readme(self, metadata: Dict) -> str:
        readme = f"""方言语音合成批量导出结果
{'='*50}

生成时间: {metadata['generated_at']}
文件总数: {metadata['total_items']}
采样率: {metadata['sample_rate']} Hz

文件说明:
- *.wav: 合成的语音文件
- metadata.json: 详细元数据，包含每个文件的合成参数

合成参数说明:
- dialect_id: 方言ID (1-福州话, 2-厦门话, 3-长沙话, 4-双峰话, 5-莆田话)
- emotion: 情感类型 (neutral-中性, happy-喜悦, sad-悲伤, angry-愤怒, surprise-惊讶, calm-平静)
- speed: 语速倍率
- pitch: 音调倍率

联系方式: 小众方言保护项目
"""
        return readme
    
    def export_to_directory(
        self,
        synthesis_results: List[Dict],
        waveforms: List[np.ndarray],
        texts: List[str],
        directory_name: Optional[str] = None
    ) -> Dict:
        try:
            if directory_name is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                directory_name = f"batch_{timestamp}"
            
            dir_path = os.path.join(self.output_dir, directory_name)
            os.makedirs(dir_path, exist_ok=True)
            
            metadata = self._create_metadata(synthesis_results)
            
            for i, (result, waveform, text) in enumerate(zip(synthesis_results, waveforms, texts)):
                if result.get("success", False) and waveform is not None:
                    filename = self._generate_filename(
                        text,
                        result.get("dialect_id", 0),
                        result.get("emotion", "neutral"),
                        i
                    )
                    
                    file_path = os.path.join(dir_path, filename)
                    sf.write(file_path, waveform, self.sample_rate)
                    
                    result["filename"] = filename
                    result["file_path"] = file_path
            
            metadata_path = os.path.join(dir_path, "metadata.json")
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            readme_path = os.path.join(dir_path, "README.txt")
            with open(readme_path, 'w', encoding='utf-8') as f:
                f.write(self._generate_readme(metadata))
            
            return {
                "success": True,
                "directory_path": dir_path,
                "total_files": len(synthesis_results),
                "successful_files": sum(1 for r in synthesis_results if r.get("success", False))
            }
            
        except Exception as e:
            logger.error(f"目录导出失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }

class ParallelSynthesizer:
    def __init__(self, synthesizer, max_workers: int = 4):
        self.synthesizer = synthesizer
        self.max_workers = max_workers
        self.exporter = BatchSynthesisExporter()
    
    def _single_synthesis(self, request: Dict) -> Dict:
        try:
            result = self.synthesizer.synthesize(
                text=request.get("text", ""),
                dialect_id=request.get("dialect_id", 1),
                emotion=request.get("emotion", "neutral"),
                speed=request.get("speed", 1.0),
                pitch=request.get("pitch", 1.0),
                emotion_intensity=request.get("emotion_intensity", 1.0),
                output_path=None,
                use_cache=True
            )
            result["text"] = request.get("text", "")
            return result
        except Exception as e:
            logger.error(f"单条合成失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "text": request.get("text", "")
            }
    
    def batch_synthesize_parallel(
        self,
        requests: List[Dict],
        export_format: str = "zip",
        output_filename: Optional[str] = None
    ) -> Dict:
        if not requests:
            return {
                "success": False,
                "error": "合成请求列表为空"
            }
        
        logger.info(f"开始批量合成: {len(requests)} 条")
        
        results = []
        waveforms = []
        texts = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_request = {
                executor.submit(self._single_synthesis, req): req 
                for req in requests
            }
            
            for future in as_completed(future_to_request):
                result = future.result()
                results.append(result)
                texts.append(future_to_request[future].get("text", ""))
                
                if result.get("success", False):
                    waveforms.append(result.get("waveform", None))
                else:
                    waveforms.append(None)
        
        if export_format == "zip":
            export_result = self.exporter.export_to_zip(results, waveforms, texts, output_filename)
        else:
            export_result = self.exporter.export_to_directory(results, waveforms, texts, output_filename)
        
        return {
            "success": True,
            "total_requests": len(requests),
            "successful_count": sum(1 for r in results if r.get("success", False)),
            "failed_count": sum(1 for r in results if not r.get("success", False)),
            "export_result": export_result,
            "results": results
        }
    
    def create_emotion_variations(
        self,
        text: str,
        dialect_id: int,
        emotions: List[str] = None,
        intensities: List[float] = None
    ) -> List[Dict]:
        if emotions is None:
            emotions = ["neutral", "happy", "sad", "calm"]
        if intensities is None:
            intensities = [1.0]
        
        requests = []
        for emotion in emotions:
            for intensity in intensities:
                requests.append({
                    "text": text,
                    "dialect_id": dialect_id,
                    "emotion": emotion,
                    "emotion_intensity": intensity,
                    "speed": 1.0,
                    "pitch": 1.0
                })
        
        return requests
    
    def create_dialect_comparison(
        self,
        text: str,
        dialect_ids: List[int] = None,
        emotion: str = "neutral"
    ) -> List[Dict]:
        if dialect_ids is None:
            dialect_ids = [1, 2, 3, 4, 5]
        
        requests = []
        for dialect_id in dialect_ids:
            requests.append({
                "text": text,
                "dialect_id": dialect_id,
                "emotion": emotion,
                "emotion_intensity": 1.0,
                "speed": 1.0,
                "pitch": 1.0
            })
        
        return requests
