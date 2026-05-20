import os
import json
import csv
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import text, func
import numpy as np

logger = logging.getLogger(__name__)

class DialectDataSourceType:
    OFFICIAL = "official"
    ACADEMIC = "academic"
    USER_CONTRIBUTED = "user_contributed"
    FIELD_RECORDING = "field_recording"
    HERITAGE = "heritage"

class DialectCorpusQuality:
    PREMIUM = "premium"
    STANDARD = "standard"
    BASIC = "basic"
    NOISY = "noisy"

class DialectDatabaseConnector:
    def __init__(self, db_session: Session, storage_path: str = "./dialect_database"):
        self.db = db_session
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.audio_path = self.storage_path / "audio"
        self.metadata_path = self.storage_path / "metadata"
        self.audio_path.mkdir(exist_ok=True)
        self.metadata_path.mkdir(exist_ok=True)
        
        self._init_database_schema()
    
    def _init_database_schema(self):
        try:
            self.db.execute(text("""
                CREATE TABLE IF NOT EXISTS dialect_database (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dialect_id INTEGER NOT NULL,
                    dialect_name VARCHAR(100),
                    source_type VARCHAR(50),
                    text_content TEXT NOT NULL,
                    phonetic_transcription TEXT,
                    audio_file_path VARCHAR(500),
                    audio_hash VARCHAR(64) UNIQUE,
                    speaker_id VARCHAR(100),
                    speaker_gender VARCHAR(10),
                    speaker_age_range VARCHAR(20),
                    region VARCHAR(200),
                    quality_rating VARCHAR(20),
                    quality_score FLOAT DEFAULT 0.0,
                    duration FLOAT,
                    sample_rate INTEGER,
                    is_verified BOOLEAN DEFAULT FALSE,
                    verified_by VARCHAR(100),
                    verified_at TIMESTAMP,
                    contributor_id VARCHAR(100),
                    contribution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    license_type VARCHAR(100),
                    tags TEXT,
                    notes TEXT,
                    usage_count INTEGER DEFAULT 0,
                    last_used_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            self.db.execute(text("""
                CREATE TABLE IF NOT EXISTS dialect_sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_name VARCHAR(200) NOT NULL,
                    source_type VARCHAR(50),
                    description TEXT,
                    provider VARCHAR(200),
                    total_records INTEGER DEFAULT 0,
                    sync_frequency_hours INTEGER DEFAULT 24,
                    last_sync_at TIMESTAMP,
                    next_sync_at TIMESTAMP,
                    is_enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            
            self.db.execute(text("""
                CREATE TABLE IF NOT EXISTS sync_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER,
                    records_added INTEGER DEFAULT 0,
                    records_updated INTEGER DEFAULT 0,
                    records_skipped INTEGER DEFAULT 0,
                    sync_status VARCHAR(20),
                    error_message TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP
                )
            """))
            
            self.db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_dialect_id ON dialect_database(dialect_id);
            """))
            self.db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_source_type ON dialect_database(source_type);
            """))
            self.db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_quality ON dialect_database(quality_rating);
            """))
            
            self.db.commit()
            logger.info("方言保护数据库模式初始化完成")
        except Exception as e:
            logger.error(f"数据库初始化失败: {e}")
            self.db.rollback()
    
    def register_source(
        self,
        source_name: str,
        source_type: str,
        description: str = "",
        provider: str = "",
        sync_frequency_hours: int = 24
    ) -> int:
        try:
            result = self.db.execute(text("""
                INSERT INTO dialect_sources 
                (source_name, source_type, description, provider, sync_frequency_hours, next_sync_at)
                VALUES (:name, :type, :desc, :provider, :freq, :next_sync)
                RETURNING id
            """), {
                "name": source_name,
                "type": source_type,
                "desc": description,
                "provider": provider,
                "freq": sync_frequency_hours,
                "next_sync": datetime.now() + timedelta(seconds=30)
            })
            source_id = result.fetchone()[0]
            self.db.commit()
            logger.info(f"注册数据源成功: {source_name} (ID: {source_id})")
            return source_id
        except Exception as e:
            logger.error(f"注册数据源失败: {e}")
            self.db.rollback()
            return 0
    
    def _calculate_audio_hash(self, file_path: str) -> str:
        hasher = hashlib.sha256()
        if os.path.exists(file_path):
            with open(file_path, 'rb') as f:
                hasher.update(f.read())
        return hasher.hexdigest()
    
    def add_corpus_record(
        self,
        dialect_id: int,
        dialect_name: str,
        text_content: str,
        audio_file_path: str = "",
        source_type: str = "user_contributed",
        phonetic_transcription: str = "",
        speaker_id: str = "",
        speaker_gender: str = "",
        speaker_age_range: str = "",
        region: str = "",
        quality_score: float = 0.0,
        quality_rating: str = "standard",
        contributor_id: str = "",
        license_type: str = "CC BY-NC-SA",
        tags: List[str] = None,
        notes: str = ""
    ) -> Dict:
        try:
            audio_hash = self._calculate_audio_hash(audio_file_path) if audio_file_path else hashlib.sha256(text_content.encode()).hexdigest()
            
            existing = self.db.execute(text("""
                SELECT id FROM dialect_database WHERE audio_hash = :hash
            """), {"hash": audio_hash}).fetchone()
            
            if existing:
                return {"success": False, "message": "语料已存在", "record_id": existing[0]}
            
            import soundfile as sf
            duration = 0.0
            sample_rate = 22050
            if audio_file_path and os.path.exists(audio_file_path):
                try:
                    audio_data, sr = sf.read(audio_file_path)
                    duration = len(audio_data) / sr
                    sample_rate = sr
                except:
                    pass
            
            result = self.db.execute(text("""
                INSERT INTO dialect_database (
                    dialect_id, dialect_name, source_type, text_content, 
                    phonetic_transcription, audio_file_path, audio_hash,
                    speaker_id, speaker_gender, speaker_age_range, region,
                    quality_score, quality_rating, duration, sample_rate,
                    contributor_id, license_type, tags, notes
                ) VALUES (
                    :dialect_id, :dialect_name, :source_type, :text_content,
                    :phonetic, :audio_path, :audio_hash,
                    :speaker_id, :speaker_gender, :speaker_age, :region,
                    :quality_score, :quality_rating, :duration, :sample_rate,
                    :contributor_id, :license_type, :tags, :notes
                ) RETURNING id
            """), {
                "dialect_id": dialect_id,
                "dialect_name": dialect_name,
                "source_type": source_type,
                "text_content": text_content,
                "phonetic": phonetic_transcription,
                "audio_path": audio_file_path,
                "audio_hash": audio_hash,
                "speaker_id": speaker_id,
                "speaker_gender": speaker_gender,
                "speaker_age": speaker_age_range,
                "region": region,
                "quality_score": quality_score,
                "quality_rating": quality_rating,
                "duration": duration,
                "sample_rate": sample_rate,
                "contributor_id": contributor_id,
                "license_type": license_type,
                "tags": json.dumps(tags or [], ensure_ascii=False),
                "notes": notes
            })
            
            record_id = result.fetchone()[0]
            self.db.commit()
            logger.info(f"添加语料记录成功: {dialect_name} - {text_content[:30]}...")
            return {"success": True, "record_id": record_id, "message": "语料添加成功"}
        except Exception as e:
            logger.error(f"添加语料失败: {e}")
            self.db.rollback()
            return {"success": False, "message": str(e)}
    
    def get_corpus_statistics(self) -> Dict:
        try:
            total = self.db.execute(text("SELECT COUNT(*) FROM dialect_database")).fetchone()[0]
            by_dialect = self.db.execute(text("""
                SELECT dialect_id, dialect_name, COUNT(*) as count
                FROM dialect_database
                GROUP BY dialect_id, dialect_name
                ORDER BY count DESC
            """)).fetchall()
            by_source = self.db.execute(text("""
                SELECT source_type, COUNT(*) as count
                FROM dialect_database
                GROUP BY source_type
            """)).fetchall()
            by_quality = self.db.execute(text("""
                SELECT quality_rating, COUNT(*) as count
                FROM dialect_database
                GROUP BY quality_rating
            """)).fetchall()
            verified = self.db.execute(text("""
                SELECT COUNT(*) FROM dialect_database WHERE is_verified = TRUE
            """)).fetchone()[0]
            total_duration = self.db.execute(text("""
                SELECT COALESCE(SUM(duration), 0) FROM dialect_database
            """)).fetchone()[0]
            
            return {
                "total_records": total,
                "verified_records": verified,
                "total_duration_minutes": round(total_duration / 60, 2),
                "by_dialect": [{"dialect_id": d[0], "dialect_name": d[1], "count": d[2]} for d in by_dialect],
                "by_source_type": [{"source_type": s[0], "count": s[1]} for s in by_source],
                "by_quality": [{"quality_rating": q[0], "count": q[1]} for q in by_quality]
            }
        except Exception as e:
            logger.error(f"获取统计失败: {e}")
            return {}
    
    def search_corpus(
        self,
        dialect_id: Optional[int] = None,
        keyword: str = "",
        source_type: Optional[str] = None,
        quality_rating: Optional[str] = None,
        only_verified: bool = False,
        min_duration: float = 0,
        max_results: int = 100,
        offset: int = 0
    ) -> List[Dict]:
        try:
            query_parts = ["SELECT * FROM dialect_database WHERE 1=1"]
            params = {}
            
            if dialect_id:
                query_parts.append("AND dialect_id = :dialect_id")
                params["dialect_id"] = dialect_id
            
            if keyword:
                query_parts.append("AND (text_content LIKE :keyword OR phonetic_transcription LIKE :keyword)")
                params["keyword"] = f"%{keyword}%"
            
            if source_type:
                query_parts.append("AND source_type = :source_type")
                params["source_type"] = source_type
            
            if quality_rating:
                query_parts.append("AND quality_rating = :quality")
                params["quality"] = quality_rating
            
            if only_verified:
                query_parts.append("AND is_verified = TRUE")
            
            query_parts.append(f"AND duration >= {min_duration}")
            query_parts.append(f"ORDER BY created_at DESC LIMIT {max_results} OFFSET {offset}")
            
            query = " ".join(query_parts)
            results = self.db.execute(text(query), params).fetchall()
            
            columns = ["id", "dialect_id", "dialect_name", "source_type", "text_content",
                      "phonetic_transcription", "audio_file_path", "audio_hash",
                      "speaker_id", "speaker_gender", "speaker_age_range", "region",
                      "quality_rating", "quality_score", "duration", "sample_rate",
                      "is_verified", "verified_by", "verified_at", "contributor_id",
                      "contribution_date", "license_type", "tags", "notes",
                      "usage_count", "last_used_at", "created_at", "updated_at"]
            
            corpus_list = []
            for row in results:
                corpus = dict(zip(columns, row))
                corpus["tags"] = json.loads(corpus["tags"]) if corpus["tags"] else []
                corpus_list.append(corpus)
            
            return corpus_list
        except Exception as e:
            logger.error(f"搜索语料失败: {e}")
            return []
    
    def auto_supplement_corpus(self, dialect_id: int, target_count: int = 100) -> Dict:
        logger.info(f"开始自动补充方言 {dialect_id} 语料，目标数量: {target_count}")
        
        current_count = self.db.execute(text("""
            SELECT COUNT(*) FROM dialect_database WHERE dialect_id = :dialect_id
        """), {"dialect_id": dialect_id}).fetchone()[0]
        
        if current_count >= target_count:
            return {"success": True, "message": "语料数量已达标", "current_count": current_count}
        
        needed = target_count - current_count
        added_count = 0
        
        supplement_patterns = self._get_supplement_patterns(dialect_id)
        
        for i in range(needed):
            pattern = supplement_patterns[i % len(supplement_patterns)]
            result = self.add_corpus_record(
                dialect_id=dialect_id,
                dialect_name=pattern["dialect_name"],
                text_content=pattern["text_template"].format(index=i + 1),
                source_type="auto_generated",
                quality_score=0.6,
                quality_rating="basic",
                notes="系统自动补充的基础语料"
            )
            if result["success"]:
                added_count += 1
        
        return {
            "success": True,
            "dialect_id": dialect_id,
            "previous_count": current_count,
            "added_count": added_count,
            "current_count": current_count + added_count,
            "message": f"成功补充 {added_count} 条语料"
        }
    
    def _get_supplement_patterns(self, dialect_id: int) -> List[Dict]:
        dialect_names = {
            1: "福州话", 2: "厦门话", 3: "长沙话", 
            4: "双峰话", 5: "莆田话"
        }
        dialect_name = dialect_names.get(dialect_id, f"方言{dialect_id}")
        
        templates = [
            "欢迎来到我的家乡",
            "今天天气真{index}",
            "我今天去市场买东西",
            "这个东西很好吃",
            "明天我们一起去玩",
            "你吃饭了吗",
            "这个多少钱",
            "我很喜欢这里",
            "今天真开心",
            "时间过得真快"
        ]
        
        patterns = []
        for t in templates:
            patterns.append({
                "dialect_name": dialect_name,
                "text_template": t
            })
        return patterns
    
    def verify_corpus(self, record_id: int, verified_by: str, quality_score: Optional[float] = None) -> Dict:
        try:
            updates = ["is_verified = TRUE", "verified_by = :verified_by", "verified_at = :verified_at"]
            params = {"verified_by": verified_by, "verified_at": datetime.now(), "id": record_id}
            
            if quality_score is not None:
                updates.append("quality_score = :quality_score")
                params["quality_score"] = quality_score
                
                if quality_score >= 0.8:
                    updates.append("quality_rating = 'premium'")
                elif quality_score >= 0.6:
                    updates.append("quality_rating = 'standard'")
                else:
                    updates.append("quality_rating = 'basic'")
            
            query = f"UPDATE dialect_database SET {', '.join(updates)} WHERE id = :id"
            self.db.execute(text(query), params)
            self.db.commit()
            
            return {"success": True, "message": "语料审核验证成功"}
        except Exception as e:
            logger.error(f"语料验证失败: {e}")
            self.db.rollback()
            return {"success": False, "message": str(e)}

class DialectDatabaseInitializer:
    @staticmethod
    def initialize_official_sources(db_connector: DialectDatabaseConnector) -> Dict:
        sources = [
            {
                "name": "中国语言资源保护工程",
                "type": "official",
                "description": "教育部、国家语委组织实施的国家级工程",
                "provider": "教育部语言文字信息管理司",
                "sync_frequency": 168
            },
            {
                "name": "地方方言研究院",
                "type": "academic",
                "description": "高校方言研究机构提供的专业语料",
                "provider": "各大高校语言研究所",
                "sync_frequency": 72
            },
            {
                "name": "民间方言保护组织",
                "type": "heritage",
                "description": "民间方言保护志愿者提供的语料资源",
                "provider": "民间方言保护组织",
                "sync_frequency": 168
            }
        ]
        
        source_ids = []
        for source in sources:
            sid = db_connector.register_source(
                source["name"],
                source["type"],
                source["description"],
                source["provider"],
                source["sync_frequency"]
            )
            source_ids.append(sid)
        
        return {
            "success": True,
            "sources_registered": len(source_ids),
            "source_ids": source_ids
        }
    
    @staticmethod
    def seed_initial_corpus(db_connector: DialectDatabaseConnector) -> Dict:
        initial_corpus = [
            {
                "dialect_id": 1, "dialect_name": "福州话",
                "text": "今天天气很好，我们去公园玩吧",
                "phonetic": "kɪŋ˥˥ tʰiɛn˥˥ tʰiɛn˥˥ kʰi˥˥ hɔ˥˥",
                "speaker_id": "spe001", "quality_score": 0.85, "quality_rating": "premium",
                "region": "福州鼓楼区"
            },
            {
                "dialect_id": 2, "dialect_name": "厦门话",
                "text": "这碗沙茶面真好吃",
                "phonetic": "tse˥˩ uan˥˥ sa˥˥ te˥˥ mi˥˥",
                "speaker_id": "spe002", "quality_score": 0.82, "quality_rating": "premium",
                "region": "厦门思明区"
            },
            {
                "dialect_id": 3, "dialect_name": "长沙话",
                "text": "晚上一起去吃口味虾不",
                "phonetic": "uan˥˥ san˨˦ i˦˨ tɕʰi˨˦",
                "speaker_id": "spe003", "quality_score": 0.78, "quality_rating": "standard",
                "region": "长沙芙蓉区"
            },
            {
                "dialect_id": 4, "dialect_name": "双峰话",
                "text": "今天赶集买了好多菜",
                "phonetic": "tɕin˥˥ tʰiɛn˥˥ kan˥˥ tɕi˨˦",
                "speaker_id": "spe004", "quality_score": 0.80, "quality_rating": "standard",
                "region": "娄底双峰县"
            },
            {
                "dialect_id": 5, "dialect_name": "莆田话",
                "text": "兴化米粉是家乡的味道",
                "phonetic": "hiŋ˥˥ hua˨˦ mi˦˨ hun˨˦",
                "speaker_id": "spe005", "quality_score": 0.75, "quality_rating": "standard",
                "region": "莆田城厢区"
            }
        ]
        
        added_count = 0
        for corpus in initial_corpus:
            result = db_connector.add_corpus_record(
                dialect_id=corpus["dialect_id"],
                dialect_name=corpus["dialect_name"],
                text_content=corpus["text"],
                phonetic_transcription=corpus["phonetic"],
                speaker_id=corpus["speaker_id"],
                region=corpus["region"],
                quality_score=corpus["quality_score"],
                quality_rating=corpus["quality_rating"],
                source_type="official",
                license_type="CC BY-NC-SA"
            )
            if result["success"]:
                added_count += 1
        
        return {
            "success": True,
            "added_count": added_count,
            "message": f"成功初始化 {added_count} 条种子语料"
        }
