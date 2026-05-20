from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, ForeignKey, Text, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import uuid
import os

DATABASE_URL = "sqlite:///./backend/data/carbon_management.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def generate_uuid():
    return str(uuid.uuid4())


class Company(Base):
    __tablename__ = "companies"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    industry = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    users = relationship("User", back_populates="company")
    emission_records = relationship("EmissionRecord", back_populates="company")
    reports = relationship("Report", back_populates="company")


class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id"))
    email = Column(String(255), unique=True, nullable=False)
    role = Column(String(50), default="user")
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    company = relationship("Company", back_populates="users")


class EmissionFactor(Base):
    __tablename__ = "emission_factors"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    version = Column(String(20), nullable=False, default="v1.0")
    source_type = Column(String(100), nullable=False)
    activity = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=False)
    factor_value = Column(Float, nullable=False)
    standard = Column(String(50), nullable=False)
    year = Column(Integer, nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)


class EmissionRecord(Base):
    __tablename__ = "emission_records"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id"))
    period = Column(String(20), nullable=False)
    factor_version = Column(String(20), nullable=False, default="v1.0")
    scope1_total = Column(Float, default=0)
    scope2_total = Column(Float, default=0)
    scope3_total = Column(Float, default=0)
    grand_total = Column(Float, default=0)
    data_quality_score = Column(Float, default=0)
    data_confidence_level = Column(String(20), default="medium")
    calculated_at = Column(DateTime, default=datetime.utcnow)
    
    company = relationship("Company", back_populates="emission_records")
    emission_sources = relationship("EmissionSource", back_populates="record", cascade="all, delete-orphan")


class EmissionSource(Base):
    __tablename__ = "emission_sources"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    record_id = Column(String, ForeignKey("emission_records.id"))
    category = Column(String(100), nullable=False)
    subcategory = Column(String(255))
    scope = Column(Integer, nullable=False)
    activity_data = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    emission_factor = Column(Float, nullable=False)
    emission_amount = Column(Float, nullable=False)
    
    record = relationship("EmissionRecord", back_populates="emission_sources")


class IndustryBenchmark(Base):
    __tablename__ = "industry_benchmarks"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    industry_code = Column(String(50), nullable=False)
    metric = Column(String(100), nullable=False)
    average_value = Column(Float, nullable=False)
    top25_value = Column(Float, nullable=False)
    year = Column(Integer, nullable=False)


class ReductionSuggestion(Base):
    __tablename__ = "reduction_suggestions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    category = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    estimated_reduction_pct = Column(Float, nullable=False)
    cost_level = Column(String(50), nullable=False)
    payback_period = Column(String(50))


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id"))
    title = Column(String(255), nullable=False)
    period_start = Column(String(20), nullable=False)
    period_end = Column(String(20), nullable=False)
    status = Column(String(50), default="generating")
    file_path = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    company = relationship("Company", back_populates="reports")


class ReductionTarget(Base):
    __tablename__ = "reduction_targets"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id"))
    target_name = Column(String(255), nullable=False)
    target_type = Column(String(50), nullable=False)
    scope = Column(String(20), nullable=False)
    base_year = Column(String(10), nullable=False)
    base_emission = Column(Float, nullable=False)
    target_year = Column(String(10), nullable=False)
    target_reduction_pct = Column(Float, nullable=False)
    current_emission = Column(Float, default=0)
    achieved_reduction_pct = Column(Float, default=0)
    status = Column(String(20), default="on_track")
    sbti_aligned = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DataQualityLog(Base):
    __tablename__ = "data_quality_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    record_id = Column(String, ForeignKey("emission_records.id"))
    category = Column(String(100))
    completeness_score = Column(Float, default=0)
    accuracy_score = Column(Float, default=0)
    consistency_score = Column(Float, default=0)
    overall_score = Column(Float, default=0)
    confidence_interval_low = Column(Float, default=0)
    confidence_interval_high = Column(Float, default=0)
    issues = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    os.makedirs("./backend/data", exist_ok=True)
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
