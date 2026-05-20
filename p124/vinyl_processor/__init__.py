from .audio_capture import AudioCapture
from .noise_reduction import NoiseReducer
from .speed_correction import SpeedCorrector
from .audio_segmenter import AudioSegmenter
from .file_exporter import FileExporter
from .library_manager import LibraryManager
from .turntable_config import TurntableProfile, TurntableConfigurator
from .tone_enhancer import ToneEnhancer
from .album_matcher import AlbumMetadata, AudioFingerprinter, AlbumMatcher
from .batch_processor import ProcessingConfig, ProcessingResult, BatchProcessor

__version__ = "2.0.0"
__all__ = [
    "AudioCapture",
    "NoiseReducer",
    "SpeedCorrector",
    "AudioSegmenter",
    "FileExporter",
    "LibraryManager",
    "TurntableProfile",
    "TurntableConfigurator",
    "ToneEnhancer",
    "AlbumMetadata",
    "AudioFingerprinter",
    "AlbumMatcher",
    "ProcessingConfig",
    "ProcessingResult",
    "BatchProcessor",
]
