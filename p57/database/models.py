from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    uploads = relationship('MaterialUpload', back_populates='user')
    
class MuseumCollection(Base):
    __tablename__ = 'museum_collections'
    
    id = Column(Integer, primary_key=True)
    artifact_id = Column(String(50), unique=True, nullable=False)
    artifact_name = Column(String(200), nullable=False)
    origin_location = Column(String(200))
    historical_period = Column(String(100))
    estimated_year = Column(Integer)
    material_type = Column(String(100))
    material_origin = Column(String(200))
    current_condition = Column(String(50))
    storage_location = Column(String(200))
    acquisition_method = Column(String(100))
    acquisition_date = Column(DateTime)
    last_restoration_date = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    material_data = relationship('MaterialData', back_populates='museum_collection')
    protection_plans = relationship('ProtectionPlan', back_populates='artifact')
    analysis_reports = relationship('AnalysisReport', back_populates='artifact')

class MaterialData(Base):
    __tablename__ = 'material_data'
    
    id = Column(Integer, primary_key=True)
    museum_collection_id = Column(Integer, ForeignKey('museum_collections.id'))
    material_type = Column(String(50), nullable=False)
    material_type_standardized = Column(String(50))
    source = Column(String(100))
    thickness = Column(Float)
    tensile_strength = Column(Float)
    water_content = Column(Float)
    collagen_ratio = Column(Float)
    age_years = Column(Float)
    storage_condition = Column(String(100))
    collection_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    museum_collection = relationship('MuseumCollection', back_populates='material_data')
    features = relationship('MaterialFeature', back_populates='material')
    pigment_data = relationship('PigmentData', back_populates='material')
    protection_plans = relationship('ProtectionPlan', back_populates='material')
    
class PigmentData(Base):
    __tablename__ = 'pigment_data'
    
    id = Column(Integer, primary_key=True)
    material_id = Column(Integer, ForeignKey('material_data.id'))
    pigment_name = Column(String(100), nullable=False)
    chemical_composition = Column(String(255))
    color_l = Column(Float)
    color_a = Column(Float)
    color_b = Column(Float)
    fade_rate = Column(Float)
    light_exposure_hours = Column(Float)
    
    material = relationship('MaterialData', back_populates='pigment_data')

class MaterialFeature(Base):
    __tablename__ = 'material_features'
    
    id = Column(Integer, primary_key=True)
    material_id = Column(Integer, ForeignKey('material_data.id'))
    feature_name = Column(String(100), nullable=False)
    feature_value = Column(Float)
    extracted_at = Column(DateTime, default=datetime.utcnow)
    
    material = relationship('MaterialData', back_populates='features')

class ProtectionPlan(Base):
    __tablename__ = 'protection_plans'
    
    id = Column(Integer, primary_key=True)
    artifact_id = Column(Integer, ForeignKey('museum_collections.id'))
    material_id = Column(Integer, ForeignKey('material_data.id'))
    plan_name = Column(String(200), nullable=False)
    plan_type = Column(String(50))
    risk_level = Column(String(20))
    priority = Column(String(20))
    recommended_actions = Column(Text)
    environmental_requirements = Column(JSON)
    monitoring_schedule = Column(JSON)
    estimated_cost = Column(Float)
    estimated_duration_days = Column(Integer)
    responsible_person = Column(String(100))
    status = Column(String(20), default='pending')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    artifact = relationship('MuseumCollection', back_populates='protection_plans')
    material = relationship('MaterialData', back_populates='protection_plans')

class AnalysisReport(Base):
    __tablename__ = 'analysis_reports'
    
    id = Column(Integer, primary_key=True)
    artifact_id = Column(Integer, ForeignKey('museum_collections.id'))
    report_title = Column(String(200), nullable=False)
    report_type = Column(String(50))
    report_format = Column(String(20))
    report_path = Column(String(500))
    summary = Column(Text)
    key_findings = Column(JSON)
    recommendations = Column(Text)
    generated_by = Column(String(100))
    generated_at = Column(DateTime, default=datetime.utcnow)
    version = Column(String(20), default='1.0')
    
    artifact = relationship('MuseumCollection', back_populates='analysis_reports')

class AnalysisResult(Base):
    __tablename__ = 'analysis_results'
    
    id = Column(Integer, primary_key=True)
    analysis_type = Column(String(50), nullable=False)
    result_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    material_ids = Column(String(255))

class MaterialUpload(Base):
    __tablename__ = 'material_uploads'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    filename = Column(String(255), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default='pending')
    
    user = relationship('User', back_populates='uploads')

class MaterialKnowledgeRule(Base):
    __tablename__ = 'material_knowledge_rules'
    
    id = Column(Integer, primary_key=True)
    material_type = Column(String(100), nullable=False)
    condition_type = Column(String(50))
    condition_threshold = Column(Float)
    recommendation = Column(Text)
    risk_level = Column(String(20))
    priority = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

engine = create_engine(Config.DATABASE_URI)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db_session():
    return SessionLocal()
