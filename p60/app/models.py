from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    role = Column(String, default="user", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    structures = relationship("MortiseTenonStructure", back_populates="owner", lazy="selectin")

    __table_args__ = (
        Index('idx_user_active_role', 'is_active', 'role'),
    )


class WoodType(Base):
    __tablename__ = "wood_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    density = Column(Float, index=True)
    elastic_modulus = Column(Float)
    shear_modulus = Column(Float)
    tensile_strength = Column(Float)
    compressive_strength = Column(Float)
    bending_strength = Column(Float)
    hardness = Column(Float)
    moisture_content = Column(Float, default=12.0)
    description = Column(Text)
    source = Column(String)
    third_party_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), index=True)

    __table_args__ = (
        Index('idx_wood_name_density', 'name', 'density'),
    )


class MortiseTenonStructure(Base):
    __tablename__ = "mortise_tenon_structures"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    structure_type = Column(String, index=True)
    description = Column(Text)

    mortise_width = Column(Float)
    mortise_height = Column(Float)
    mortise_depth = Column(Float)
    tenon_width = Column(Float)
    tenon_height = Column(Float)
    tenon_length = Column(Float)

    fit_clearance = Column(Float, default=0.1)
    shoulder_length = Column(Float, default=0.0)

    wood_type_id = Column(Integer, ForeignKey("wood_types.id"), index=True)
    wood_type = relationship("WoodType", lazy="selectin")

    owner_id = Column(Integer, ForeignKey("users.id"), index=True)
    owner = relationship("User", back_populates="structures")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), index=True)

    stress_analyses = relationship("StressAnalysis", back_populates="structure", lazy="selectin", cascade="all, delete-orphan")
    assembly_simulations = relationship("AssemblySimulation", back_populates="structure", lazy="selectin", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_structure_owner_type', 'owner_id', 'structure_type'),
        Index('idx_structure_created', 'owner_id', 'created_at'),
    )


class StressAnalysis(Base):
    __tablename__ = "stress_analyses"

    id = Column(Integer, primary_key=True, index=True)
    structure_id = Column(Integer, ForeignKey("mortise_tenon_structures.id"), index=True)
    structure = relationship("MortiseTenonStructure", back_populates="stress_analyses")

    force_direction = Column(String, index=True)
    applied_force = Column(Float)

    max_stress = Column(Float, index=True)
    min_stress = Column(Float)
    avg_stress = Column(Float)
    stress_distribution = Column(JSON)

    safety_factor = Column(Float, index=True)
    failure_probability = Column(Float)
    critical_points = Column(JSON)

    used_third_party_data = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index('idx_analysis_structure_created', 'structure_id', 'created_at'),
    )


class AssemblySimulation(Base):
    __tablename__ = "assembly_simulations"

    id = Column(Integer, primary_key=True, index=True)
    structure_id = Column(Integer, ForeignKey("mortise_tenon_structures.id"), index=True)
    structure = relationship("MortiseTenonStructure", back_populates="assembly_simulations")

    assembly_force = Column(Float)
    insertion_depth = Column(Float)
    friction_coefficient = Column(Float, default=0.4)

    contact_pressure_distribution = Column(JSON)
    stress_during_assembly = Column(JSON)
    assembly_stages = Column(JSON)

    estimated_assembly_time = Column(Float, index=True)
    difficulty_score = Column(Float, index=True)
    recommendations = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index('idx_simulation_structure_created', 'structure_id', 'created_at'),
        Index('idx_simulation_difficulty', 'structure_id', 'difficulty_score'),
    )


class ThirdPartyTestData(Base):
    __tablename__ = "third_party_test_data"

    id = Column(Integer, primary_key=True, index=True)
    wood_type_id = Column(Integer, ForeignKey("wood_types.id"), index=True)
    wood_type = relationship("WoodType", lazy="selectin")

    external_id = Column(String, unique=True, index=True, nullable=False)
    test_date = Column(DateTime, index=True)
    test_laboratory = Column(String)

    density = Column(Float)
    elastic_modulus = Column(Float)
    shear_modulus = Column(Float)
    tensile_strength = Column(Float)
    compressive_strength = Column(Float)
    bending_strength = Column(Float)
    hardness = Column(Float)
    moisture_content = Column(Float)

    raw_data = Column(JSON)
    is_synced = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    synced_at = Column(DateTime(timezone=True), nullable=True, index=True)

    __table_args__ = (
        Index('idx_third_party_wood_synced', 'wood_type_id', 'is_synced'),
    )
