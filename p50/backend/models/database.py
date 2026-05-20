from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config.settings import settings

engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class Dialect(Base):
    __tablename__ = "dialects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    branch = Column(String(100))
    region = Column(String(200))
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    corpora = relationship("Corpus", back_populates="dialect")
    intonation_patterns = relationship("IntonationPattern", back_populates="dialect")

class Corpus(Base):
    __tablename__ = "corpora"
    
    id = Column(Integer, primary_key=True, index=True)
    dialect_id = Column(Integer, ForeignKey("dialects.id"))
    text = Column(Text, nullable=False)
    audio_path = Column(String(500))
    phonetic_transcription = Column(Text)
    speaker_id = Column(String(100))
    duration = Column(Float)
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dialect = relationship("Dialect", back_populates="corpora")
    features = relationship("AudioFeature", back_populates="corpus")

class AudioFeature(Base):
    __tablename__ = "audio_features"
    
    id = Column(Integer, primary_key=True, index=True)
    corpus_id = Column(Integer, ForeignKey("corpora.id"))
    mfcc_features = Column(Text)
    pitch_contour = Column(Text)
    energy = Column(Text)
    tempo = Column(Float)
    speech_rate = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    corpus = relationship("Corpus", back_populates="features")

class IntonationPattern(Base):
    __tablename__ = "intonation_patterns"
    
    id = Column(Integer, primary_key=True, index=True)
    dialect_id = Column(Integer, ForeignKey("dialects.id"))
    pattern_type = Column(String(50))
    pattern_data = Column(Text)
    description = Column(Text)
    confidence = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    dialect = relationship("Dialect", back_populates="intonation_patterns")

class SynthesisTask(Base):
    __tablename__ = "synthesis_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True)
    dialect_id = Column(Integer)
    text = Column(Text, nullable=False)
    emotion = Column(String(50), default="neutral")
    speed = Column(Float, default=1.0)
    pitch = Column(Float, default=1.0)
    status = Column(String(50), default="pending")
    output_audio_path = Column(String(500))
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

class RepairRecord(Base):
    __tablename__ = "repair_records"
    
    id = Column(Integer, primary_key=True, index=True)
    synthesis_task_id = Column(String(100))
    original_audio_path = Column(String(500))
    repaired_audio_path = Column(String(500))
    repair_type = Column(String(100))
    quality_score_before = Column(Float)
    quality_score_after = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class AnnotationLabel(Base):
    __tablename__ = "annotation_labels"
    
    id = Column(Integer, primary_key=True, index=True)
    label_type = Column(String(50), nullable=False)
    label_name = Column(String(100), nullable=False)
    label_value = Column(String(100))
    description = Column(Text)
    dialect_id = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CorpusAnnotation(Base):
    __tablename__ = "corpus_annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    corpus_id = Column(Integer, nullable=False, index=True)
    annotation_type = Column(String(50), nullable=False)
    label = Column(String(100), nullable=False)
    value = Column(Text)
    confidence = Column(Float, default=1.0)
    annotator = Column(String(100))
    comment = Column(Text)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String(100))
    verified_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AnnotationProject(Base):
    __tablename__ = "annotation_projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    dialect_id = Column(Integer)
    annotation_types = Column(Text)
    status = Column(String(50), default="active")
    total_corpora = Column(Integer, default=0)
    annotated_count = Column(Integer, default=0)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)
