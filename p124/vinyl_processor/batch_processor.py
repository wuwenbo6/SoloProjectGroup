import numpy as np
from typing import Dict, List, Optional, Tuple, Callable
import os
import time
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

try:
    import soundfile as sf
    SOUNDFILE_AVAILABLE = True
except ImportError:
    SOUNDFILE_AVAILABLE = False
    print("soundfile 未安装，音频导出功能受限")

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    print("librosa 未安装，音频加载功能受限")

try:
    from .noise_reduction import NoiseReducer
    from .speed_correction import SpeedCorrector
    from .audio_segmenter import AudioSegmenter
    from .file_exporter import FileExporter
    from .turntable_config import TurntableConfigurator
    from .tone_enhancer import ToneEnhancer
    from .album_matcher import AlbumMatcher
except ImportError:
    from vinyl_processor.noise_reduction import NoiseReducer
    from vinyl_processor.speed_correction import SpeedCorrector
    from vinyl_processor.audio_segmenter import AudioSegmenter
    from vinyl_processor.file_exporter import FileExporter
    from vinyl_processor.turntable_config import TurntableConfigurator
    from vinyl_processor.tone_enhancer import ToneEnhancer
    from vinyl_processor.album_matcher import AlbumMatcher


class ProcessingConfig:
    def __init__(self):
        self.sample_rate = 44100
        self.noise_reduction_enabled = True
        self.noise_profile = None
        self.click_removal_enabled = True
        self.speed_correction_enabled = True
        self.target_speed = 1.0
        self.segmentation_enabled = True
        self.min_segment_duration = 2.0
        self.max_silence_duration = 3.0
        self.equalization_enabled = True
        self.equalization_preset = "vintage"
        self.stereo_enhancement = 1.0
        self.harmonic_enhancement = 0.0
        self.warmth_enhancement = 0.3
        self.compression_enabled = False
        self.turntable_profile = ""
        self.auto_metadata = True
        self.write_id3_tags = True
        self.output_format = "FLAC"
        self.output_bit_depth = 24
        self.output_sample_rate = 44100
        self.create_subfolders = True
        self.file_naming_pattern = "{track:02d} - {title}"
    
    def to_dict(self) -> Dict:
        return {
            "sample_rate": self.sample_rate,
            "noise_reduction_enabled": self.noise_reduction_enabled,
            "click_removal_enabled": self.click_removal_enabled,
            "speed_correction_enabled": self.speed_correction_enabled,
            "target_speed": self.target_speed,
            "segmentation_enabled": self.segmentation_enabled,
            "min_segment_duration": self.min_segment_duration,
            "max_silence_duration": self.max_silence_duration,
            "equalization_enabled": self.equalization_enabled,
            "equalization_preset": self.equalization_preset,
            "stereo_enhancement": self.stereo_enhancement,
            "harmonic_enhancement": self.harmonic_enhancement,
            "warmth_enhancement": self.warmth_enhancement,
            "compression_enabled": self.compression_enabled,
            "turntable_profile": self.turntable_profile,
            "auto_metadata": self.auto_metadata,
            "write_id3_tags": self.write_id3_tags,
            "output_format": self.output_format,
            "output_bit_depth": self.output_bit_depth,
            "output_sample_rate": self.output_sample_rate,
            "create_subfolders": self.create_subfolders,
            "file_naming_pattern": self.file_naming_pattern
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ProcessingConfig':
        config = cls()
        for key, value in data.items():
            if hasattr(config, key):
                setattr(config, key, value)
        return config
    
    def save(self, file_path: str):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
    
    @classmethod
    def load(cls, file_path: str) -> 'ProcessingConfig':
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls.from_dict(data)


class ProcessingResult:
    def __init__(self):
        self.success = False
        self.input_file = ""
        self.output_files = []
        self.duration = 0.0
        self.processing_time = 0.0
        self.metadata = {}
        self.errors = []
        self.warnings = []
        self.tracks = []
    
    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "input_file": self.input_file,
            "output_files": self.output_files,
            "duration": self.duration,
            "processing_time": self.processing_time,
            "metadata": self.metadata,
            "errors": self.errors,
            "warnings": self.warnings,
            "tracks": self.tracks
        }


class BatchProcessor:
    def __init__(self, config: ProcessingConfig = None):
        self.config = config or ProcessingConfig()
        
        self.noise_reducer = NoiseReducer(self.config.sample_rate)
        self.speed_corrector = SpeedCorrector(self.config.sample_rate)
        self.segmenter = AudioSegmenter(self.config.sample_rate)
        self.exporter = FileExporter(self.config.sample_rate)
        self.turntable_config = TurntableConfigurator(self.config.sample_rate)
        self.tone_enhancer = ToneEnhancer(self.config.sample_rate)
        self.album_matcher = AlbumMatcher(self.config.sample_rate)
        
        self._progress_callback = None
        self._current_file_index = 0
        self._total_files = 0
    
    def set_progress_callback(self, callback: Callable[[str, float, str], None]):
        self._progress_callback = callback
    
    def _report_progress(self, stage: str, progress: float, message: str = ""):
        if self._progress_callback:
            self._progress_callback(stage, progress, message)
    
    def load_audio(self, file_path: str) -> Tuple[Optional[np.ndarray], int]:
        if not LIBROSA_AVAILABLE:
            print("librosa 未安装，无法加载音频")
            return None, 0
        
        try:
            audio, sr = librosa.load(file_path, sr=self.config.sample_rate, mono=False)
            
            if audio.ndim == 1:
                audio = np.vstack([audio, audio])
            
            if audio.shape[0] == 2:
                audio = audio.T
            
            duration = len(audio) / sr
            print(f"已加载音频: {os.path.basename(file_path)}, 时长: {duration:.1f}s, 采样率: {sr}Hz")
            
            return audio, sr
        except Exception as e:
            print(f"加载音频失败: {e}")
            return None, 0
    
    def process_single_file(self, input_file: str, output_dir: str,
                           metadata: Dict = None) -> ProcessingResult:
        result = ProcessingResult()
        result.input_file = input_file
        start_time = time.time()
        
        try:
            print(f"\n开始处理: {os.path.basename(input_file)}")
            self._report_progress("loading", 0.05, "加载音频...")
            
            audio, sr = self.load_audio(input_file)
            if audio is None:
                result.errors.append("无法加载音频文件")
                return result
            
            result.duration = len(audio) / sr
            
            if self.config.turntable_profile:
                self._report_progress("turntable", 0.1, "应用唱机配置...")
                if self.turntable_config.load_preset(self.config.turntable_profile):
                    audio = self.turntable_config.apply_frequency_compensation(audio)
            
            if self.config.noise_reduction_enabled:
                self._report_progress("noise", 0.2, "降噪处理...")
                print("  - 应用降噪处理...")
                audio = self.noise_reducer.auto_clean(
                    audio,
                    noise_profile=self.config.noise_profile,
                    remove_clicks=self.config.click_removal_enabled
                )
            
            if self.config.speed_correction_enabled:
                self._report_progress("speed", 0.4, "转速校正...")
                print("  - 应用转速校正...")
                audio = self.speed_corrector.correct_wow_flutter(audio)
                
                if self.config.target_speed != 1.0:
                    audio = self.speed_corrector.resample_audio(audio, self.config.target_speed)
            
            if self.config.equalization_enabled or self.config.stereo_enhancement != 1.0 or \
               self.config.harmonic_enhancement > 0 or self.config.warmth_enhancement > 0:
                self._report_progress("enhance", 0.6, "音色增强...")
                print("  - 应用音色增强...")
                audio = self.tone_enhancer.enhance_audio(
                    audio,
                    eq_preset=self.config.equalization_preset if self.config.equalization_enabled else None,
                    stereo_width=self.config.stereo_enhancement,
                    harmonic_amount=self.config.harmonic_enhancement,
                    warmth_amount=self.config.warmth_enhancement,
                    apply_compression=self.config.compression_enabled
                )
            
            album_metadata = None
            if self.config.auto_metadata:
                self._report_progress("metadata", 0.7, "匹配元数据...")
                print("  - 匹配专辑信息...")
                
                filename = os.path.basename(input_file)
                matches = self.album_matcher.smart_match(
                    audio=audio,
                    filename=filename,
                    artist=metadata.get("artist") if metadata else "",
                    title=metadata.get("album") if metadata else "",
                    year=metadata.get("year") if metadata else ""
                )
                
                if matches:
                    album_metadata = matches[0]
                    result.metadata = album_metadata.to_dict()
                    print(f"  - 匹配到专辑: {album_metadata.artist} - {album_metadata.title}")
            
            segments = []
            if self.config.segmentation_enabled:
                self._report_progress("segment", 0.8, "音频分段...")
                print("  - 检测音频分段...")
                segments = self.segmenter.detect_segments(
                    audio,
                    min_duration=self.config.min_segment_duration,
                    max_silence=self.config.max_silence_duration
                )
                print(f"  - 检测到 {len(segments)} 个分段")
            else:
                segments = [{"start_sample": 0, "end_sample": len(audio)}]
            
            self._report_progress("export", 0.9, "导出音频...")
            print("  - 导出音频文件...")
            
            album_dir = output_dir
            if self.config.create_subfolders and album_metadata:
                folder_name = f"{album_metadata.artist} - {album_metadata.title}"
                folder_name = "".join(c for c in folder_name if c not in '<>:"/\\|?*')
                album_dir = os.path.join(output_dir, folder_name)
                os.makedirs(album_dir, exist_ok=True)
            
            for i, segment in enumerate(segments):
                segment_audio = audio[segment["start_sample"]:segment["end_sample"]]
                
                track_title = f"Track {i+1}"
                if album_metadata and album_metadata.tracks and i < len(album_metadata.tracks):
                    track_title = album_metadata.tracks[i].get("title", track_title)
                
                file_name = self.config.file_naming_pattern.format(
                    track=i+1,
                    title=track_title,
                    artist=album_metadata.artist if album_metadata else "Unknown",
                    album=album_metadata.title if album_metadata else "Unknown"
                )
                file_name = "".join(c for c in file_name if c not in '<>:"/\\|?*')
                file_name = f"{file_name}.{self.config.output_format.lower()}"
                
                output_path = os.path.join(album_dir, file_name)
                
                self.exporter.export_blockwise(
                    segment_audio,
                    output_path,
                    format=self.config.output_format
                )
                
                result.output_files.append(output_path)
                result.tracks.append({
                    "track_number": i+1,
                    "title": track_title,
                    "file": output_path,
                    "start_sample": segment["start_sample"],
                    "end_sample": segment["end_sample"]
                })
                
                if self.config.write_id3_tags and album_metadata:
                    self.album_matcher.write_id3_tags(output_path, album_metadata, i+1)
            
            result.success = True
            result.processing_time = time.time() - start_time
            
            self._report_progress("complete", 1.0, "处理完成")
            print(f"处理完成! 耗时: {result.processing_time:.1f}s, 输出文件: {len(result.output_files)}个")
            
            return result
            
        except Exception as e:
            result.errors.append(f"处理失败: {str(e)}")
            print(f"处理失败: {e}")
            import traceback
            traceback.print_exc()
            return result
    
    def process_batch(self, input_files: List[str], output_dir: str,
                     metadata_list: List[Dict] = None) -> List[ProcessingResult]:
        results = []
        self._total_files = len(input_files)
        
        print(f"\n{'='*60}")
        print(f"开始批量处理，共 {self._total_files} 个文件")
        print(f"输出目录: {output_dir}")
        print(f"{'='*60}\n")
        
        os.makedirs(output_dir, exist_ok=True)
        
        for i, input_file in enumerate(input_files):
            self._current_file_index = i
            
            metadata = None
            if metadata_list and i < len(metadata_list):
                metadata = metadata_list[i]
            
            result = self.process_single_file(input_file, output_dir, metadata)
            results.append(result)
            
            if i < len(input_files) - 1:
                print(f"\n进度: {i+1}/{self._total_files} ({(i+1)/self._total_files*100:.0f}%)")
        
        self._print_batch_summary(results)
        
        return results
    
    def process_directory(self, input_dir: str, output_dir: str,
                         recursive: bool = False,
                         extensions: List[str] = None) -> List[ProcessingResult]:
        if extensions is None:
            extensions = ['.wav', '.flac', '.mp3', '.aiff', '.aif']
        
        extensions = [ext.lower() for ext in extensions]
        
        input_files = []
        
        if recursive:
            for root, dirs, files in os.walk(input_dir):
                for file in files:
                    if os.path.splitext(file)[1].lower() in extensions:
                        input_files.append(os.path.join(root, file))
        else:
            for file in os.listdir(input_dir):
                if os.path.splitext(file)[1].lower() in extensions:
                    input_files.append(os.path.join(input_dir, file))
        
        input_files.sort()
        print(f"找到 {len(input_files)} 个音频文件")
        
        return self.process_batch(input_files, output_dir)
    
    def _print_batch_summary(self, results: List[ProcessingResult]):
        success_count = sum(1 for r in results if r.success)
        total_files = len(results)
        total_duration = sum(r.duration for r in results)
        total_processing_time = sum(r.processing_time for r in results)
        
        print(f"\n{'='*60}")
        print(f"批量处理完成!")
        print(f"{'='*60}")
        print(f"成功: {success_count}/{total_files}")
        print(f"总音频时长: {total_duration/60:.1f} 分钟")
        print(f"总处理时间: {total_processing_time/60:.1f} 分钟")
        print(f"实时率: {total_processing_time/total_duration:.2f}x" if total_duration > 0 else "")
        print(f"输出文件总数: {sum(len(r.output_files) for r in results)}")
        
        error_count = sum(len(r.errors) for r in results)
        if error_count > 0:
            print(f"错误数: {error_count}")
            for r in results:
                if r.errors:
                    print(f"  - {os.path.basename(r.input_file)}: {r.errors[0]}")
        
        print(f"{'='*60}\n")
    
    def save_processing_report(self, results: List[ProcessingResult], 
                              output_file: str):
        report = {
            "generated_at": datetime.now().isoformat(),
            "config": self.config.to_dict(),
            "total_files": len(results),
            "successful_files": sum(1 for r in results if r.success),
            "total_duration": sum(r.duration for r in results),
            "total_processing_time": sum(r.processing_time for r in results),
            "results": [r.to_dict() for r in results]
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"处理报告已保存: {output_file}")
    
    def get_presets(self) -> Dict[str, Dict]:
        return {
            "audiophile": {
                "name": "发烧友模式",
                "description": "最高质量，最小处理，保留原始音质",
                "config": {
                    "noise_reduction_enabled": True,
                    "click_removal_enabled": True,
                    "speed_correction_enabled": True,
                    "equalization_enabled": False,
                    "stereo_enhancement": 1.0,
                    "harmonic_enhancement": 0.0,
                    "warmth_enhancement": 0.0,
                    "compression_enabled": False,
                    "output_format": "FLAC",
                    "output_bit_depth": 24
                }
            },
            "vintage": {
                "name": "复古黑胶模式",
                "description": "经典黑胶音色，温暖饱满",
                "config": {
                    "noise_reduction_enabled": True,
                    "click_removal_enabled": True,
                    "speed_correction_enabled": True,
                    "equalization_enabled": True,
                    "equalization_preset": "vintage",
                    "stereo_enhancement": 1.1,
                    "harmonic_enhancement": 0.2,
                    "warmth_enhancement": 0.4,
                    "compression_enabled": False,
                    "turntable_profile": "thorens_td124",
                    "output_format": "FLAC"
                }
            },
            "modern": {
                "name": "现代流行模式",
                "description": "明亮清晰，适合流行音乐",
                "config": {
                    "noise_reduction_enabled": True,
                    "click_removal_enabled": True,
                    "speed_correction_enabled": True,
                    "equalization_enabled": True,
                    "equalization_preset": "pop",
                    "stereo_enhancement": 1.2,
                    "harmonic_enhancement": 0.1,
                    "warmth_enhancement": 0.1,
                    "compression_enabled": True,
                    "turntable_profile": "technics_sl1200",
                    "output_format": "MP3"
                }
            },
            "quick": {
                "name": "快速模式",
                "description": "最快处理速度，适合批量转录",
                "config": {
                    "noise_reduction_enabled": True,
                    "click_removal_enabled": False,
                    "speed_correction_enabled": False,
                    "equalization_enabled": False,
                    "segmentation_enabled": False,
                    "stereo_enhancement": 1.0,
                    "harmonic_enhancement": 0.0,
                    "warmth_enhancement": 0.0,
                    "compression_enabled": False,
                    "output_format": "MP3"
                }
            },
            "archival": {
                "name": "归档模式",
                "description": "最高质量，用于永久保存",
                "config": {
                    "noise_reduction_enabled": True,
                    "click_removal_enabled": True,
                    "speed_correction_enabled": True,
                    "equalization_enabled": False,
                    "segmentation_enabled": True,
                    "stereo_enhancement": 1.0,
                    "harmonic_enhancement": 0.0,
                    "warmth_enhancement": 0.0,
                    "compression_enabled": False,
                    "output_format": "FLAC",
                    "output_bit_depth": 24,
                    "output_sample_rate": 96000,
                    "write_id3_tags": True
                }
            }
        }
    
    def apply_preset(self, preset_name: str) -> bool:
        presets = self.get_presets()
        if preset_name not in presets:
            print(f"预设 '{preset_name}' 不存在")
            return False
        
        preset = presets[preset_name]
        config_data = preset["config"]
        
        for key, value in config_data.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
        
        print(f"已应用预设: {preset['name']}")
        return True
