import numpy as np
import librosa
import soundfile as sf
from typing import Dict
from scipy import signal
from config.settings import settings

class AudioRepairService:
    def __init__(self):
        self.sample_rate = settings.SAMPLE_RATE
        
    def _remove_noise(self, y: np.ndarray) -> np.ndarray:
        n_fft = 2048
        hop_length = 512
        
        stft = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
        magnitude, phase = librosa.magphase(stft)
        
        noise_mag = np.median(magnitude, axis=1, keepdims=True)
        threshold = 1.5 * noise_mag
        magnitude_clean = np.maximum(magnitude - threshold, 0)
        
        stft_clean = magnitude_clean * phase
        y_clean = librosa.istft(stft_clean, hop_length=hop_length)
        
        return y_clean
    
    def _smooth_transitions(self, y: np.ndarray) -> np.ndarray:
        window_size = int(self.sample_rate * 0.01)
        if window_size % 2 == 0:
            window_size += 1
        
        smoothed = signal.savgol_filter(y, window_length=window_size, polyorder=2)
        return smoothed
    
    def _enhance_clarity(self, y: np.ndarray) -> np.ndarray:
        pre_emphasis = 0.97
        y_enhanced = np.append(y[0], y[1:] - pre_emphasis * y[:-1])
        return y_enhanced
    
    def _normalize_volume(self, y: np.ndarray) -> np.ndarray:
        target_rms = 0.1
        current_rms = np.sqrt(np.mean(y**2))
        
        if current_rms > 0:
            gain = target_rms / current_rms
            y_normalized = y * gain
            y_normalized = np.clip(y_normalized, -1, 1)
            return y_normalized
        return y
    
    def _fill_silence(self, y: np.ndarray, threshold: float = 0.01) -> np.ndarray:
        y_abs = np.abs(y)
        silence_mask = y_abs < threshold
        
        kernel_size = int(self.sample_rate * 0.05)
        from scipy.ndimage import binary_closing
        silence_mask = binary_closing(silence_mask, structure=np.ones(kernel_size))
        
        y_filled = y.copy()
        for i in range(len(y_filled)):
            if silence_mask[i]:
                start = max(0, i - kernel_size)
                end = min(len(y_filled), i + kernel_size)
                non_silence = y_filled[start:end][~silence_mask[start:end]]
                if len(non_silence) > 0:
                    y_filled[i] = np.mean(non_silence)
        
        return y_filled
    
    def assess_quality(self, audio_path: str) -> Dict:
        y, sr = librosa.load(audio_path, sr=self.sample_rate)
        
        rms = np.sqrt(np.mean(y**2))
        zcr = np.mean(librosa.feature.zero_crossing_rate(y))
        
        stft = librosa.stft(y)
        spectral_flatness = np.mean(librosa.feature.spectral_flatness(y=y))
        
        clarity = min(1.0, max(0, 1 - zcr * 2))
        naturalness = min(1.0, max(0, 1 - spectral_flatness))
        noise_level = min(1.0, zcr * 3)
        
        overall_score = (clarity + naturalness + (1 - noise_level)) / 3
        
        return {
            "overall": float(overall_score),
            "clarity": float(clarity),
            "naturalness": float(naturalness),
            "noise_level": float(noise_level),
            "rms": float(rms)
        }
    
    def repair_audio_file(self, input_path: str, repair_type: str = "full") -> Dict:
        try:
            y, sr = librosa.load(input_path, sr=self.sample_rate)
            
            score_before = self.assess_quality(input_path)
            
            if repair_type in ["noise", "full"]:
                y = self._remove_noise(y)
            
            if repair_type in ["smooth", "full"]:
                y = self._smooth_transitions(y)
            
            if repair_type in ["clarity", "full"]:
                y = self._enhance_clarity(y)
            
            if repair_type in ["volume", "full"]:
                y = self._normalize_volume(y)
            
            if repair_type == "full":
                y = self._fill_silence(y)
            
            output_path = input_path.replace(".wav", "_repaired.wav").replace(".mp3", "_repaired.wav")
            sf.write(output_path, y, self.sample_rate)
            
            score_after = self.assess_quality(output_path)
            
            improvement = score_after["overall"] - score_before["overall"]
            
            return {
                "success": True,
                "original_path": input_path,
                "repaired_path": output_path,
                "score_before": score_before["overall"],
                "score_after": score_after["overall"],
                "improvement": improvement
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def repair_audio(self, synthesis_task_id: str, repair_type: str = "full") -> Dict:
        from models.database import SessionLocal, SynthesisTask
        
        db = SessionLocal()
        task = db.query(SynthesisTask).filter(SynthesisTask.task_id == synthesis_task_id).first()
        
        if not task or not task.output_audio_path:
            return {"success": False, "error": "合成任务或音频不存在"}
        
        result = self.repair_audio_file(task.output_audio_path, repair_type)
        db.close()
        
        return result
    
    def batch_repair(self, audio_files: list) -> list:
        results = []
        for audio_path in audio_files:
            result = self.repair_audio_file(audio_path)
            results.append(result)
        return results
