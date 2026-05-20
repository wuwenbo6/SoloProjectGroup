from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean
from sqlalchemy.sql import func
from app.core.database import BaseQuality


class QualityTest(BaseQuality):
    __tablename__ = "quality_tests"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), index=True, nullable=False)
    test_code = Column(String(50), unique=True, index=True, nullable=False)
    tester = Column(String(100))
    test_date = Column(DateTime)
    test_location = Column(String(200))
    overall_score = Column(Float)
    grade = Column(String(20))
    status = Column(String(20), default="pending")
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class QualityParameter(BaseQuality):
    __tablename__ = "quality_parameters"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, nullable=False)
    parameter_name = Column(String(100), nullable=False)
    parameter_code = Column(String(50))
    value = Column(Float)
    unit = Column(String(30))
    standard_min = Column(Float)
    standard_max = Column(Float)
    score = Column(Float)
    weight = Column(Float)
    is_passed = Column(Boolean, default=True)
    notes = Column(Text)


class ColorTest(BaseQuality):
    __tablename__ = "color_tests"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, nullable=False)
    batch_id = Column(String(50), index=True)
    color_space = Column(String(20), default="RGB")
    r_value = Column(Integer)
    g_value = Column(Integer)
    b_value = Column(Integer)
    l_value = Column(Float)
    a_value = Column(Float)
    b_lab_value = Column(Float)
    color_name = Column(String(100))
    uniformity = Column(Float)
    glossiness = Column(Float)
    score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ToughnessTest(BaseQuality):
    __tablename__ = "toughness_tests"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, nullable=False)
    batch_id = Column(String(50), index=True)
    tensile_strength = Column(Float)
    elongation = Column(Float)
    tear_resistance = Column(Float)
    bending_resistance = Column(Float)
    impact_resistance = Column(Float)
    wear_resistance = Column(Float)
    hardness = Column(Float)
    score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CompositionTest(BaseQuality):
    __tablename__ = "composition_tests"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, nullable=False)
    batch_id = Column(String(50), index=True)
    cellulose_content = Column(Float)
    lignin_content = Column(Float)
    hemicellulose_content = Column(Float)
    moisture_content = Column(Float)
    ash_content = Column(Float)
    impurity_content = Column(Float)
    ph_value = Column(Float)
    organic_matter = Column(Float)
    score = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ThirdPartyReport(BaseQuality):
    __tablename__ = "third_party_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(String(50), index=True, nullable=False)
    test_id = Column(Integer)
    agency_name = Column(String(200), nullable=False)
    agency_code = Column(String(50))
    report_date = Column(DateTime)
    report_url = Column(String(500))
    report_pdf = Column(Text)
    overall_result = Column(String(50))
    certified = Column(Boolean, default=False)
    synced_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
