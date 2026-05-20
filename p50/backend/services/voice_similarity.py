import os
import logging
import numpy as np
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import hashlib
import json
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    import librosa
    import librosa.display
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning("librosa未安装，语音相似度功能将受限")

try:
    from scipy.spatial.distance import cosine, euclidean
    from scipy import signal
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    logger.warning("scipy未安装，语音相似度功能将受限")

class VoiceFeatureType:
    MFCC = "mfcc"
    MEL_SPECTROGRAM = "mel_spectrogram"
    CHROMA = "chroma"
    SPECTRAL_CONTRAST = "spectral_contrast"
    TONNETZ = "tonnetz"
    COMBINED = "combined"

class SimilarityAlgorithm:
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    DTW = "dtw"
    CROSS_CORRELATION = "cross_correlation"

class VoiceFeatureExtractor:
    def __init__(self, sample_rate: int = 22050, n_mfcc: int = 40):
        self.sample_rate = sample_rate
        self.n_mfcc = n_mfcc
        self.n_fft = 2048
        self.hop_length = 512
        self.cache_dir = Path("./voice_features_cache")
        self.cache_dir.mkdir(exist_ok=True)
    
    def _load_audio(self, audio_path: str) -> Tuple[np.ndarray, int]:
        if not LIBROSA_AVAILABLE:
            raise ImportError("librosa is required for audio processing")
        
        try:
            y, sr = librosa.load(audio_path, sr=self.sample_rate)
            if len(y.shape) > 1:
                y = librosa.to_mono(y)
            return y, sr
        except Exception as e:
            logger.error(f"加载音频失败 {audio_path}: {e}")
            raise
    
    def extract_mfcc(self, y: np.ndarray, sr: int) -> np.ndarray:
        mfcc = librosa.feature.mfcc(
            y=y, sr=sr, n_mfcc=self.n_mfcc,
            n_fft=self.n_fft, hop_length=self.hop_length
        )
        mfcc_delta = librosa.feature.delta(mfcc)
        mfcc_delta2 = librosa.feature.delta(mfcc, order=2)
        features = np.vstack([mfcc, mfcc_delta, mfcc_delta2])
        return features
    
    def extract_mel_spectrogram(self, y: np.ndarray, sr: int) -> np.ndarray:
        mel_spect = librosa.feature.melspectrogram(
            y=y, sr=sr, n_fft=self.n_fft, hop_length=self.hop_length,
            n_mels=128
        )
        mel_spect_db = librosa.power_to_db(mel_spect, ref=np.max)
        return mel_spect_db
    
    def extract_chroma(self, y: np.ndarray, sr: int) -> np.ndarray:
        chroma = librosa.feature.chroma_stft(
            y=y, sr=sr, n_fft=self.n_fft, hop_length=self.hop_length
        )
        return chroma
    
    def extract_spectral_contrast(self, y: np.ndarray, sr: int) -> np.ndarray:
        contrast = librosa.feature.spectral_contrast(
            y=y, sr=sr, n_fft=self.n_fft, hop_length=self.hop_length
        )
        return contrast
    
    def extract_tonnetz(self, y: np.ndarray, sr: int) -> np.ndarray:
        tonnetz = librosa.feature.tonnetz(y=y, sr=sr)
        return tonnetz
    
    def extract_combined_features(self, y: np.ndarray, sr: int) -> np.ndarray:
        mfcc = self.extract_mfcc(y, sr)
        chroma = self.extract_chroma(y, sr)
        contrast = self.extract_spectral_contrast(y, sr)
        
        mfcc_mean = np.mean(mfcc, axis=1)
        chroma_mean = np.mean(chroma, axis=1)
        contrast_mean = np.mean(contrast, axis=1)
        
        combined = np.concatenate([mfcc_mean, chroma_mean, contrast_mean])
        return combined
    
    def extract_features(
        self,
        audio_path: str,
        feature_type: str = VoiceFeatureType.COMBINED,
        use_cache: bool = True
    ) -> Dict:
        cache_key = hashlib.md5(f"{audio_path}_{feature_type}".encode()).hexdigest()
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        if use_cache and cache_file.exists():
            try:
                with open(cache_file, 'r') as f:
                    cached = json.load(f)
                cached["features"] = np.array(cached["features"])
                return cached
            except:
                pass
        
        y, sr = self._load_audio(audio_path)
        duration = len(y) / sr
        
        if feature_type == VoiceFeatureType.MFCC:
            features = self.extract_mfcc(y, sr)
        elif feature_type == VoiceFeatureType.MEL_SPECTROGRAM:
            features = self.extract_mel_spectrogram(y, sr)
        elif feature_type == VoiceFeatureType.CHROMA:
            features = self.extract_chroma(y, sr)
        elif feature_type == VoiceFeatureType.SPECTRAL_CONTRAST:
            features = self.extract_spectral_contrast(y, sr)
        elif feature_type == VoiceFeatureType.COMBINED:
            features = self.extract_combined_features(y, sr)
        else:
            features = self.extract_combined_features(y, sr)
        
        feature_stats = {
            "mean": np.mean(features, axis=1).tolist() if len(features.shape) > 1 else features.tolist(),
            "std": np.std(features, axis=1).tolist() if len(features.shape) > 1 else [0.0],
            "min": np.min(features, axis=1).tolist() if len(features.shape) > 1 else [0.0],
            "max": np.max(features, axis=1).tolist() if len(features.shape) > 1 else [0.0]
        }
        
        result = {
            "audio_path": audio_path,
            "feature_type": feature_type,
            "sample_rate": sr,
            "duration": duration,
            "feature_shape": list(features.shape),
            "features": features.tolist() if len(features.shape) == 1 else features.mean(axis=1).tolist(),
            "feature_stats": feature_stats,
            "extracted_at": datetime.now().isoformat()
        }
        
        if use_cache:
            with open(cache_file, 'w') as f:
                json.dump(result, f)
        
        return result

class VoiceSimilarityCalculator:
    def __init__(self):
        self.feature_extractor = VoiceFeatureExtractor()
    
    def cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        if not SCIPY_AVAILABLE:
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return dot_product / (norm1 * norm2)
        return 1 - cosine(vec1, vec2)
    
    def euclidean_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        if not SCIPY_AVAILABLE:
            distance = np.linalg.norm(vec1 - vec2)
        else:
            distance = euclidean(vec1, vec2)
        return 1 / (1 + distance)
    
    def dtw_distance(self, seq1: np.ndarray, seq2: np.ndarray) -> float:
        n, m = len(seq1), len(seq2)
        dtw_matrix = np.full((n + 1, m + 1), np.inf)
        dtw_matrix[0, 0] = 0
        
        for i in range(1, n + 1):
            for j in range(1, m + 1):
                cost = np.linalg.norm(seq1[i - 1] - seq2[j - 1])
                dtw_matrix[i, j] = cost + min(
                    dtw_matrix[i - 1, j],
                    dtw_matrix[i, j - 1],
                    dtw_matrix[i - 1, j - 1]
                )
        
        return dtw_matrix[n, m]
    
    def cross_correlation_similarity(self, y1: np.ndarray, y2: np.ndarray) -> float:
        if not SCIPY_AVAILABLE:
            return 0.5
        
        min_len = min(len(y1), len(y2))
        y1_norm = (y1[:min_len] - np.mean(y1[:min_len])) / (np.std(y1[:min_len]) + 1e-8)
        y2_norm = (y2[:min_len] - np.mean(y2[:min_len])) / (np.std(y2[:min_len]) + 1e-8)
        
        correlation = signal.correlate(y1_norm, y2_norm, mode='valid')
        max_corr = np.max(np.abs(correlation)) / min_len
        return min(max_corr, 1.0)
    
    def calculate_similarity(
        self,
        audio_path1: str,
        audio_path2: str,
        algorithm: str = SimilarityAlgorithm.COSINE,
        feature_type: str = VoiceFeatureType.COMBINED
    ) -> Dict:
        try:
            feat1 = self.feature_extractor.extract_features(audio_path1, feature_type)
            feat2 = self.feature_extractor.extract_features(audio_path2, feature_type)
            
            vec1 = np.array(feat1["features"])
            vec2 = np.array(feat2["features"])
            
            if algorithm == SimilarityAlgorithm.COSINE:
                similarity = self.cosine_similarity(vec1, vec2)
            elif algorithm == SimilarityAlgorithm.EUCLIDEAN:
                similarity = self.euclidean_similarity(vec1, vec2)
            else:
                similarity = self.cosine_similarity(vec1, vec2)
            
            cosine_sim = self.cosine_similarity(vec1, vec2)
            euclidean_sim = self.euclidean_similarity(vec1, vec2)
            
            combined_score = 0.6 * cosine_sim + 0.4 * euclidean_sim
            
            confidence_level = self._get_confidence_level(combined_score)
            
            return {
                "success": True,
                "similarity_score": round(float(combined_score), 4),
                "cosine_similarity": round(float(cosine_sim), 4),
                "euclidean_similarity": round(float(euclidean_sim), 4),
                "algorithm_used": algorithm,
                "feature_type": feature_type,
                "confidence_level": confidence_level,
                "audio1_duration": feat1["duration"],
                "audio2_duration": feat2["duration"],
                "comparison_details": {
                    "duration_match": min(feat1["duration"], feat2["duration"]) / max(feat1["duration"], feat2["duration"]),
                    "sample_rate_match": feat1["sample_rate"] == feat2["sample_rate"]
                }
            }
        except Exception as e:
            logger.error(f"计算相似度失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "similarity_score": 0.0
            }
    
    def _get_confidence_level(self, score: float) -> str:
        if score >= 0.85:
            return "very_high"
        elif score >= 0.70:
            return "high"
        elif score >= 0.50:
            return "medium"
        elif score >= 0.30:
            return "low"
        else:
            return "very_low"
    
    def compare_with_dialect_reference(
        self,
        input_audio: str,
        dialect_id: int,
        reference_audios: List[str]
    ) -> Dict:
        if not reference_audios:
            return {
                "success": False,
                "message": "没有参考音频"
            }
        
        similarities = []
        for ref_audio in reference_audios:
            if os.path.exists(ref_audio):
                result = self.calculate_similarity(input_audio, ref_audio)
                if result["success"]:
                    similarities.append(result["similarity_score"])
        
        if not similarities:
            return {
                "success": False,
                "message": "参考音频处理失败"
            }
        
        avg_similarity = np.mean(similarities)
        max_similarity = np.max(similarities)
        min_similarity = np.min(similarities)
        
        return {
            "success": True,
            "dialect_id": dialect_id,
            "average_similarity": round(float(avg_similarity), 4),
            "max_similarity": round(float(max_similarity), 4),
            "min_similarity": round(float(min_similarity), 4),
            "reference_count": len(similarities),
            "confidence_level": self._get_confidence_level(avg_similarity)
        }
    
    def identify_dialect(
        self,
        input_audio: str,
        dialect_references: Dict[int, List[str]]
    ) -> Dict:
        results = []
        for dialect_id, references in dialect_references.items():
            result = self.compare_with_dialect_reference(input_audio, dialect_id, references)
            if result["success"]:
                results.append(result)
        
        if not results:
            return {
                "success": False,
                "message": "方言识别失败"
            }
        
        results.sort(key=lambda x: x["average_similarity"], reverse=True)
        
        top_result = results[0]
        total_score = sum(r["average_similarity"] for r in results)
        confidence = top_result["average_similarity"] / total_score if total_score > 0 else 0
        
        return {
            "success": True,
            "identified_dialect_id": top_result["dialect_id"],
            "confidence": round(float(confidence), 4),
            "top_matches": [
                {
                    "dialect_id": r["dialect_id"],
                    "similarity": r["average_similarity"],
                    "confidence_level": r["confidence_level"]
                }
                for r in results[:3]
            ],
            "all_results": results
        }

class DialectVoiceVerifier:
    def __init__(self):
        self.similarity_calculator = VoiceSimilarityCalculator()
        self.thresholds = {
            "very_high": 0.85,
            "high": 0.70,
            "medium": 0.50,
            "low": 0.30
        }
    
    def verify_pronunciation_accuracy(
        self,
        user_audio: str,
        standard_audio: str,
        text_content: str = ""
    ) -> Dict:
        similarity_result = self.similarity_calculator.calculate_similarity(
            user_audio, standard_audio
        )
        
        if not similarity_result["success"]:
            return similarity_result
        
        similarity_score = similarity_result["similarity_score"]
        
        accuracy_level = self._get_accuracy_level(similarity_score)
        
        suggestions = self._generate_suggestions(similarity_score, accuracy_level)
        
        return {
            "success": True,
            "accuracy_score": similarity_score,
            "accuracy_level": accuracy_level,
            "cosine_score": similarity_result["cosine_similarity"],
            "euclidean_score": similarity_result["euclidean_similarity"],
            "text_content": text_content,
            "suggestions": suggestions,
            "details": similarity_result
        }
    
    def _get_accuracy_level(self, score: float) -> str:
        if score >= 0.90:
            return "excellent"
        elif score >= 0.75:
            return "good"
        elif score >= 0.60:
            return "fair"
        elif score >= 0.45:
            return "needs_improvement"
        else:
            return "poor"
    
    def _generate_suggestions(self, score: float, level: str) -> List[str]:
        suggestions = []
        
        if level == "excellent":
            suggestions.append("发音非常标准，继续保持！")
            suggestions.append("语调掌握得很好，接近母语者水平")
        elif level == "good":
            suggestions.append("发音不错，还有提升空间")
            suggestions.append("注意部分音节的发音细节")
        elif level == "fair":
            suggestions.append("基本能听懂，但需要多练习")
            suggestions.append("重点练习该方言的声调变化")
            suggestions.append("多听标准发音进行模仿")
        elif level == "needs_improvement":
            suggestions.append("建议从基础发音开始练习")
            suggestions.append("先掌握该方言的声母和韵母")
            suggestions.append("多听多练，循序渐进")
        else:
            suggestions.append("建议先学习该方言的基础语音知识")
            suggestions.append("从最简单的词汇开始练习")
            suggestions.append("对照标准发音逐字练习")
        
        return suggestions
    
    def batch_verify_pronunciation(
        self,
        user_audios: List[Dict],
        standard_audios: List[Dict]
    ) -> Dict:
        results = []
        total_score = 0.0
        passed_count = 0
        
        for user_audio, standard_audio in zip(user_audios, standard_audios):
            result = self.verify_pronunciation_accuracy(
                user_audio["path"],
                standard_audio["path"],
                user_audio.get("text", "")
            )
            if result["success"]:
                results.append(result)
                total_score += result["accuracy_score"]
                if result["accuracy_score"] >= 0.6:
                    passed_count += 1
        
        avg_score = total_score / len(results) if results else 0
        
        return {
            "success": True,
            "total_tests": len(results),
            "passed_count": passed_count,
            "pass_rate": round(passed_count / len(results), 4) if results else 0,
            "average_score": round(avg_score, 4),
            "overall_level": self._get_accuracy_level(avg_score),
            "individual_results": results
        }
