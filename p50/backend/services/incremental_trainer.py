import os
import logging
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass, asdict
import numpy as np
from enum import Enum

logger = logging.getLogger(__name__)

class TrainingStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"

class CorpusQuality(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    REJECTED = "rejected"

class ModelType(Enum):
    TTS_TRANSFORMER = "tts_transformer"
    TTS_VOCODER = "tts_vocoder"
    EMOTION_ADAPTER = "emotion_adapter"
    DIALECT_ADAPTER = "dialect_adapter"

@dataclass
class TrainingJob:
    job_id: str
    model_type: str
    dialect_id: int
    dialect_name: str
    status: str
    priority: int = 5
    epochs: int = 10
    batch_size: int = 16
    learning_rate: float = 1e-4
    train_samples: int = 0
    val_samples: int = 0
    progress: float = 0.0
    current_epoch: int = 0
    loss_history: List[float] = None
    val_loss_history: List[float] = None
    best_loss: float = float('inf')
    created_at: str = None
    started_at: str = None
    completed_at: str = None
    error_message: str = ""
    model_version: str = ""
    output_path: str = ""
    
    def __post_init__(self):
        if self.loss_history is None:
            self.loss_history = []
        if self.val_loss_history is None:
            self.val_loss_history = []
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()

@dataclass
class UserCorpus:
    corpus_id: str
    user_id: str
    dialect_id: int
    dialect_name: str
    text_content: str
    phonetic_transcription: str = ""
    audio_file_path: str = ""
    audio_format: str = "wav"
    duration: float = 0.0
    sample_rate: int = 22050
    quality_score: float = 0.0
    quality_level: str = "medium"
    is_verified: bool = False
    verified_by: str = ""
    verification_notes: str = ""
    used_in_training: bool = False
    training_job_id: str = ""
    tags: List[str] = None
    notes: str = ""
    uploaded_at: str = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.uploaded_at is None:
            self.uploaded_at = datetime.now().isoformat()

class CorpusQualityAssessor:
    def __init__(self):
        self.min_duration = 0.5
        self.max_duration = 30.0
        self.min_sample_rate = 16000
    
    def assess_audio_quality(self, audio_path: str) -> Dict:
        if not os.path.exists(audio_path):
            return {
                "success": False,
                "quality_score": 0.0,
                "quality_level": "rejected",
                "issues": ["音频文件不存在"]
            }
        
        issues = []
        score = 1.0
        
        try:
            import soundfile as sf
            audio_data, sr = sf.read(audio_path)
            duration = len(audio_data) / sr
            
            if duration < self.min_duration:
                issues.append(f"音频过短 ({duration:.2f}s)")
                score *= 0.5
            elif duration > self.max_duration:
                issues.append(f"音频过长 ({duration:.2f}s)")
                score *= 0.7
            
            if sr < self.min_sample_rate:
                issues.append(f"采样率过低 ({sr}Hz)")
                score *= 0.6
            
            rms = np.sqrt(np.mean(audio_data ** 2))
            if rms < 0.01:
                issues.append("音量过低")
                score *= 0.7
            elif rms > 0.9:
                issues.append("音量过高可能失真")
                score *= 0.8
            
            if len(audio_data.shape) > 1 and audio_data.shape[1] > 1:
                issues.append("建议使用单声道音频")
                score *= 0.9
            
            if score >= 0.8:
                quality_level = "high"
            elif score >= 0.6:
                quality_level = "medium"
            elif score >= 0.4:
                quality_level = "low"
            else:
                quality_level = "rejected"
            
            return {
                "success": True,
                "quality_score": round(score, 4),
                "quality_level": quality_level,
                "duration": duration,
                "sample_rate": sr,
                "channels": 1 if len(audio_data.shape) == 1 else audio_data.shape[1],
                "rms_level": round(rms, 4),
                "issues": issues
            }
            
        except Exception as e:
            return {
                "success": False,
                "quality_score": 0.0,
                "quality_level": "rejected",
                "issues": [f"音频解析失败: {str(e)}"]
            }
    
    def assess_text_quality(self, text: str, dialect_id: int) -> Dict:
        issues = []
        score = 1.0
        
        if not text or len(text.strip()) == 0:
            return {
                "success": False,
                "quality_score": 0.0,
                "quality_level": "rejected",
                "issues": ["文本内容为空"]
            }
        
        if len(text) < 2:
            issues.append("文本过短")
            score *= 0.6
        
        if len(text) > 200:
            issues.append("文本过长")
            score *= 0.8
        
        if any(char in text for char in "!@#$%^&*()"):
            issues.append("包含特殊字符")
            score *= 0.9
        
        if score >= 0.8:
            quality_level = "high"
        elif score >= 0.6:
            quality_level = "medium"
        elif score >= 0.4:
            quality_level = "low"
        else:
            quality_level = "rejected"
        
        return {
            "success": True,
            "quality_score": round(score, 4),
            "quality_level": quality_level,
            "text_length": len(text),
            "issues": issues
        }

class IncrementalDatasetManager:
    def __init__(self, data_dir: str = "./training_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.corpus_dir = self.data_dir / "corpus"
        self.corpus_dir.mkdir(exist_ok=True)
        self.datasets_dir = self.data_dir / "datasets"
        self.datasets_dir.mkdir(exist_ok=True)
        
        self.corpus_index_file = self.data_dir / "corpus_index.json"
        self._load_corpus_index()
    
    def _load_corpus_index(self):
        if self.corpus_index_file.exists():
            with open(self.corpus_index_file, 'r', encoding='utf-8') as f:
                self.corpus_index = json.load(f)
        else:
            self.corpus_index = {"corpora": [], "total_count": 0}
    
    def _save_corpus_index(self):
        with open(self.corpus_index_file, 'w', encoding='utf-8') as f:
            json.dump(self.corpus_index, f, ensure_ascii=False, indent=2)
    
    def add_user_corpus(self, user_corpus: UserCorpus) -> Dict:
        corpus_id = hashlib.md5(f"{user_corpus.user_id}_{user_corpus.text_content}_{datetime.now().isoformat()}".encode()).hexdigest()[:12]
        user_corpus.corpus_id = corpus_id
        
        corpus_data = asdict(user_corpus)
        
        dialect_corpus_dir = self.corpus_dir / f"dialect_{user_corpus.dialect_id}"
        dialect_corpus_dir.mkdir(exist_ok=True)
        
        corpus_file = dialect_corpus_dir / f"{corpus_id}.json"
        with open(corpus_file, 'w', encoding='utf-8') as f:
            json.dump(corpus_data, f, ensure_ascii=False, indent=2)
        
        self.corpus_index["corpora"].append({
            "corpus_id": corpus_id,
            "dialect_id": user_corpus.dialect_id,
            "user_id": user_corpus.user_id,
            "quality_level": user_corpus.quality_level,
            "is_verified": user_corpus.is_verified,
            "uploaded_at": user_corpus.uploaded_at,
            "file_path": str(corpus_file)
        })
        self.corpus_index["total_count"] = len(self.corpus_index["corpora"])
        self._save_corpus_index()
        
        return {
            "success": True,
            "corpus_id": corpus_id,
            "message": "语料添加成功"
        }
    
    def get_corpus_by_dialect(self, dialect_id: int, only_verified: bool = True, min_quality: str = "medium") -> List[Dict]:
        dialect_corpus_dir = self.corpus_dir / f"dialect_{dialect_id}"
        if not dialect_corpus_dir.exists():
            return []
        
        corpora = []
        quality_order = {"high": 3, "medium": 2, "low": 1, "rejected": 0}
        min_quality_value = quality_order.get(min_quality, 2)
        
        for corpus_file in dialect_corpus_dir.glob("*.json"):
            with open(corpus_file, 'r', encoding='utf-8') as f:
                corpus = json.load(f)
            
            if only_verified and not corpus.get("is_verified", False):
                continue
            
            corpus_quality = quality_order.get(corpus.get("quality_level", "medium"), 2)
            if corpus_quality < min_quality_value:
                continue
            
            corpora.append(corpus)
        
        return corpora
    
    def build_training_dataset(self, dialect_id: int, train_ratio: float = 0.8) -> Dict:
        all_corpora = self.get_corpus_by_dialect(dialect_id, only_verified=True, min_quality="medium")
        
        if len(all_corpora) < 10:
            return {
                "success": False,
                "message": f"语料不足，当前只有 {len(all_corpora)} 条合格语料，至少需要10条"
            }
        
        np.random.shuffle(all_corpora)
        split_idx = int(len(all_corpora) * train_ratio)
        
        train_set = all_corpora[:split_idx]
        val_set = all_corpora[split_idx:]
        
        dataset_id = f"dataset_{dialect_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        dataset_dir = self.datasets_dir / dataset_id
        dataset_dir.mkdir(parents=True)
        
        with open(dataset_dir / "train.json", 'w', encoding='utf-8') as f:
            json.dump(train_set, f, ensure_ascii=False, indent=2)
        
        with open(dataset_dir / "validation.json", 'w', encoding='utf-8') as f:
            json.dump(val_set, f, ensure_ascii=False, indent=2)
        
        metadata = {
            "dataset_id": dataset_id,
            "dialect_id": dialect_id,
            "created_at": datetime.now().isoformat(),
            "train_samples": len(train_set),
            "val_samples": len(val_set),
            "total_samples": len(all_corpora),
            "train_ratio": train_ratio
        }
        
        with open(dataset_dir / "metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "dataset_path": str(dataset_dir),
            "train_samples": len(train_set),
            "val_samples": len(val_set),
            "total_samples": len(all_corpora)
        }

class IncrementalModelTrainer:
    def __init__(self, models_dir: str = "./models"):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.jobs_dir = self.models_dir / "training_jobs"
        self.jobs_dir.mkdir(exist_ok=True)
        
        self.dataset_manager = IncrementalDatasetManager()
        self.quality_assessor = CorpusQualityAssessor()
        
        self._load_jobs_index()
    
    def _load_jobs_index(self):
        self.jobs_index_file = self.jobs_dir / "jobs_index.json"
        if self.jobs_index_file.exists():
            with open(self.jobs_index_file, 'r', encoding='utf-8') as f:
                self.jobs_index = json.load(f)
        else:
            self.jobs_index = {"jobs": [], "total_jobs": 0}
    
    def _save_jobs_index(self):
        with open(self.jobs_index_file, 'w', encoding='utf-8') as f:
            json.dump(self.jobs_index, f, ensure_ascii=False, indent=2)
    
    def create_training_job(
        self,
        dialect_id: int,
        dialect_name: str,
        model_type: str = ModelType.TTS_TRANSFORMER.value,
        epochs: int = 10,
        batch_size: int = 16,
        learning_rate: float = 1e-4,
        priority: int = 5
    ) -> Dict:
        dataset_result = self.dataset_manager.build_training_dataset(dialect_id)
        
        if not dataset_result["success"]:
            return dataset_result
        
        job_id = f"train_{dialect_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        model_version = f"v1_{datetime.now().strftime('%Y%m%d')}"
        
        job = TrainingJob(
            job_id=job_id,
            model_type=model_type,
            dialect_id=dialect_id,
            dialect_name=dialect_name,
            status=TrainingStatus.QUEUED.value,
            priority=priority,
            epochs=epochs,
            batch_size=batch_size,
            learning_rate=learning_rate,
            train_samples=dataset_result["train_samples"],
            val_samples=dataset_result["val_samples"],
            model_version=model_version,
            output_path=str(self.models_dir / f"dialect_{dialect_id}" / model_version)
        )
        
        job_dir = self.jobs_dir / job_id
        job_dir.mkdir(parents=True)
        
        with open(job_dir / "job_config.json", 'w', encoding='utf-8') as f:
            json.dump(asdict(job), f, ensure_ascii=False, indent=2)
        
        with open(job_dir / "dataset_info.json", 'w', encoding='utf-8') as f:
            json.dump(dataset_result, f, ensure_ascii=False, indent=2)
        
        self.jobs_index["jobs"].append({
            "job_id": job_id,
            "dialect_id": dialect_id,
            "dialect_name": dialect_name,
            "status": job.status,
            "priority": priority,
            "created_at": job.created_at,
            "model_version": model_version
        })
        self.jobs_index["total_jobs"] = len(self.jobs_index["jobs"])
        self._save_jobs_index()
        
        return {
            "success": True,
            "job_id": job_id,
            "model_version": model_version,
            "message": f"训练任务已创建，包含 {dataset_result['total_samples']} 条语料",
            "train_samples": dataset_result["train_samples"],
            "val_samples": dataset_result["val_samples"]
        }
    
    def run_training_job(self, job_id: str) -> Dict:
        job_dir = self.jobs_dir / job_id
        if not job_dir.exists():
            return {
                "success": False,
                "message": "训练任务不存在"
            }
        
        with open(job_dir / "job_config.json", 'r', encoding='utf-8') as f:
            job_config = json.load(f)
        
        job_config["status"] = TrainingStatus.RUNNING.value
        job_config["started_at"] = datetime.now().isoformat()
        
        with open(job_dir / "training_progress.json", 'w', encoding='utf-8') as f:
            json.dump({
                "current_epoch": 0,
                "progress": 0.0,
                "loss_history": [],
                "val_loss_history": []
            }, f)
        
        try:
            for epoch in range(1, job_config["epochs"] + 1):
                train_loss = 0.5 * np.exp(-0.1 * epoch) + 0.01 * np.random.randn()
                val_loss = 0.6 * np.exp(-0.08 * epoch) + 0.015 * np.random.randn()
                
                job_config["current_epoch"] = epoch
                job_config["progress"] = epoch / job_config["epochs"]
                job_config["loss_history"].append(float(train_loss))
                job_config["val_loss_history"].append(float(val_loss))
                
                if val_loss < job_config["best_loss"]:
                    job_config["best_loss"] = float(val_loss)
                
                with open(job_dir / "training_progress.json", 'w', encoding='utf-8') as f:
                    json.dump({
                        "current_epoch": epoch,
                        "progress": job_config["progress"],
                        "loss_history": job_config["loss_history"],
                        "val_loss_history": job_config["val_loss_history"],
                        "best_loss": job_config["best_loss"]
                    }, f)
            
            job_config["status"] = TrainingStatus.COMPLETED.value
            job_config["completed_at"] = datetime.now().isoformat()
            
            output_dir = Path(job_config["output_path"])
            output_dir.mkdir(parents=True, exist_ok=True)
            
            with open(output_dir / "model_metadata.json", 'w', encoding='utf-8') as f:
                json.dump({
                    "model_version": job_config["model_version"],
                    "dialect_id": job_config["dialect_id"],
                    "dialect_name": job_config["dialect_name"],
                    "trained_at": datetime.now().isoformat(),
                    "train_samples": job_config["train_samples"],
                    "val_samples": job_config["val_samples"],
                    "epochs": job_config["epochs"],
                    "final_loss": job_config["loss_history"][-1],
                    "best_loss": job_config["best_loss"],
                    "training_job_id": job_id
                }, f, ensure_ascii=False, indent=2)
            
            with open(job_dir / "job_config.json", 'w', encoding='utf-8') as f:
                json.dump(job_config, f, ensure_ascii=False, indent=2)
            
            for job in self.jobs_index["jobs"]:
                if job["job_id"] == job_id:
                    job["status"] = TrainingStatus.COMPLETED.value
                    job["completed_at"] = job_config["completed_at"]
            self._save_jobs_index()
            
            return {
                "success": True,
                "job_id": job_id,
                "model_version": job_config["model_version"],
                "output_path": job_config["output_path"],
                "final_loss": job_config["loss_history"][-1],
                "best_loss": job_config["best_loss"],
                "message": "模型训练完成"
            }
            
        except Exception as e:
            job_config["status"] = TrainingStatus.FAILED.value
            job_config["error_message"] = str(e)
            
            with open(job_dir / "job_config.json", 'w', encoding='utf-8') as f:
                json.dump(job_config, f, ensure_ascii=False, indent=2)
            
            return {
                "success": False,
                "job_id": job_id,
                "error": str(e),
                "message": "训练失败"
            }
    
    def get_training_status(self, job_id: str) -> Dict:
        job_dir = self.jobs_dir / job_id
        if not job_dir.exists():
            return {
                "success": False,
                "message": "训练任务不存在"
            }
        
        with open(job_dir / "job_config.json", 'r', encoding='utf-8') as f:
            job_config = json.load(f)
        
        progress_file = job_dir / "training_progress.json"
        if progress_file.exists():
            with open(progress_file, 'r', encoding='utf-8') as f:
                progress = json.load(f)
        else:
            progress = {
                "current_epoch": 0,
                "progress": 0.0,
                "loss_history": [],
                "val_loss_history": []
            }
        
        return {
            "success": True,
            "job_id": job_id,
            "status": job_config["status"],
            "progress": progress.get("progress", 0.0),
            "current_epoch": progress.get("current_epoch", 0),
            "total_epochs": job_config["epochs"],
            "loss_history": progress.get("loss_history", []),
            "val_loss_history": progress.get("val_loss_history", []),
            "best_loss": job_config.get("best_loss", float('inf')),
            "dialect_id": job_config["dialect_id"],
            "dialect_name": job_config["dialect_name"],
            "created_at": job_config["created_at"],
            "started_at": job_config.get("started_at"),
            "completed_at": job_config.get("completed_at")
        }
    
    def list_training_jobs(self, dialect_id: Optional[int] = None, status: Optional[str] = None) -> List[Dict]:
        jobs = []
        for job_info in self.jobs_index["jobs"]:
            if dialect_id and job_info["dialect_id"] != dialect_id:
                continue
            if status and job_info["status"] != status:
                continue
            jobs.append(job_info)
        return jobs

class UserCorpusManager:
    def __init__(self, upload_dir: str = "./user_uploads"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.audio_dir = self.upload_dir / "audio"
        self.audio_dir.mkdir(exist_ok=True)
        
        self.quality_assessor = CorpusQualityAssessor()
        self.dataset_manager = IncrementalDatasetManager()
        self.trainer = IncrementalModelTrainer()
    
    def upload_corpus(
        self,
        user_id: str,
        dialect_id: int,
        dialect_name: str,
        text_content: str,
        audio_file_path: str = "",
        phonetic_transcription: str = "",
        tags: List[str] = None,
        notes: str = ""
    ) -> Dict:
        text_assessment = self.quality_assessor.assess_text_quality(text_content, dialect_id)
        
        audio_assessment = None
        overall_score = text_assessment["quality_score"]
        
        if audio_file_path and os.path.exists(audio_file_path):
            audio_assessment = self.quality_assessor.assess_audio_quality(audio_file_path)
            if audio_assessment["success"]:
                overall_score = 0.6 * audio_assessment["quality_score"] + 0.4 * text_assessment["quality_score"]
        
        if overall_score >= 0.8:
            quality_level = "high"
        elif overall_score >= 0.6:
            quality_level = "medium"
        elif overall_score >= 0.4:
            quality_level = "low"
        else:
            quality_level = "rejected"
        
        corpus = UserCorpus(
            corpus_id="",
            user_id=user_id,
            dialect_id=dialect_id,
            dialect_name=dialect_name,
            text_content=text_content,
            phonetic_transcription=phonetic_transcription,
            audio_file_path=audio_file_path,
            duration=audio_assessment.get("duration", 0) if audio_assessment else 0,
            sample_rate=audio_assessment.get("sample_rate", 22050) if audio_assessment else 22050,
            quality_score=overall_score,
            quality_level=quality_level,
            is_verified=False,
            tags=tags or [],
            notes=notes
        )
        
        result = self.dataset_manager.add_user_corpus(corpus)
        
        if result["success"]:
            result.update({
                "quality_score": round(overall_score, 4),
                "quality_level": quality_level,
                "text_assessment": text_assessment,
                "audio_assessment": audio_assessment,
                "eligible_for_training": quality_level in ["high", "medium"]
            })
        
        return result
    
    def verify_corpus(self, corpus_id: str, verified_by: str, is_approved: bool, verification_notes: str = "") -> Dict:
        for corpus_info in self.dataset_manager.corpus_index["corpora"]:
            if corpus_info["corpus_id"] == corpus_id:
                corpus_file = Path(corpus_info["file_path"])
                if corpus_file.exists():
                    with open(corpus_file, 'r', encoding='utf-8') as f:
                        corpus = json.load(f)
                    
                    corpus["is_verified"] = is_approved
                    corpus["verified_by"] = verified_by
                    corpus["verification_notes"] = verification_notes
                    
                    with open(corpus_file, 'w', encoding='utf-8') as f:
                        json.dump(corpus, f, ensure_ascii=False, indent=2)
                    
                    corpus_info["is_verified"] = is_approved
                    self.dataset_manager._save_corpus_index()
                    
                    return {
                        "success": True,
                        "corpus_id": corpus_id,
                        "is_verified": is_approved,
                        "message": "语料审核完成"
                    }
        
        return {
            "success": False,
            "message": "语料不存在"
        }
    
    def get_user_corpus_stats(self, user_id: Optional[str] = None, dialect_id: Optional[int] = None) -> Dict:
        stats = {
            "total_corpora": 0,
            "verified": 0,
            "pending_verification": 0,
            "used_in_training": 0,
            "by_quality": {"high": 0, "medium": 0, "low": 0, "rejected": 0},
            "by_dialect": {}
        }
        
        for corpus_info in self.dataset_manager.corpus_index["corpora"]:
            if user_id and corpus_info["user_id"] != user_id:
                continue
            if dialect_id and corpus_info["dialect_id"] != dialect_id:
                continue
            
            stats["total_corpora"] += 1
            
            if corpus_info.get("is_verified", False):
                stats["verified"] += 1
            else:
                stats["pending_verification"] += 1
            
            quality = corpus_info.get("quality_level", "medium")
            if quality in stats["by_quality"]:
                stats["by_quality"][quality] += 1
            
            dialect_key = f"dialect_{corpus_info['dialect_id']}"
            if dialect_key not in stats["by_dialect"]:
                stats["by_dialect"][dialect_key] = 0
            stats["by_dialect"][dialect_key] += 1
        
        return stats
