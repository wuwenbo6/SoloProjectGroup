from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.sql import func
from uuid import uuid4
from app.core.database import Base


class Circuit(Base):
    __tablename__ = "circuits"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid4()))
    name = Column(String, index=True)
    num_qubits = Column(Integer)
    gates = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
