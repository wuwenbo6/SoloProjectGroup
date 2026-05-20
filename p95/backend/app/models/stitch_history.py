from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base


class StitchHistory(Base):
    __tablename__ = "stitch_history"

    id = Column(Integer, primary_key=True, index=True)
    stitch_id = Column(Integer, ForeignKey("stitches.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50))
    difficulty = Column(String(20))
    image_url = Column(String(500))
    video_url = Column(String(500))
    steps_text = Column(Text)
    materials = Column(Text)
    tips = Column(Text)
    steps_data = Column(JSON)
    change_note = Column(String(500))
    changed_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stitch = relationship("Stitch", back_populates="history")
    changed_by = relationship("User")
