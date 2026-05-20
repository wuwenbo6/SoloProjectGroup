from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./seismic.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class SegyFile(Base):
    __tablename__ = "segy_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String, unique=True)
    file_size = Column(Integer)
    sample_count = Column(Integer)
    trace_count = Column(Integer)
    inline_count = Column(Integer)
    crossline_count = Column(Integer)
    sample_interval = Column(Float)
    min_amplitude = Column(Float)
    max_amplitude = Column(Float)
    mean_amplitude = Column(Float)
    std_amplitude = Column(Float)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text, nullable=True)

    annotations = relationship("Annotation", back_populates="segy_file")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    segy_file_id = Column(Integer, ForeignKey("segy_files.id"))
    annotation_type = Column(String)
    inline_start = Column(Integer, nullable=True)
    inline_end = Column(Integer, nullable=True)
    crossline_start = Column(Integer, nullable=True)
    crossline_end = Column(Integer, nullable=True)
    time_start = Column(Float, nullable=True)
    time_end = Column(Float, nullable=True)
    label = Column(String)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    segy_file = relationship("SegyFile", back_populates="annotations")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
