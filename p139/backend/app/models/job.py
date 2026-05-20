from sqlalchemy import Column, Integer, String, JSON, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from uuid import uuid4
from app.core.database import Base


class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid4()))
    circuit_id = Column(String, ForeignKey("circuits.id"), nullable=True)
    status = Column(String, default="pending")
    shots = Column(Integer, default=1024)
    
    state_vector = Column(JSON, nullable=True)
    probabilities = Column(JSON, nullable=True)
    measurements = Column(JSON, nullable=True)
    bloch_spheres = Column(JSON, nullable=True)
    
    execution_time = Column(Float, nullable=True)
    error_message = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    circuit = relationship("Circuit")
