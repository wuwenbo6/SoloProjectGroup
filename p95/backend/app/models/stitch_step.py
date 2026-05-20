from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base


class StitchStep(Base):
    __tablename__ = "stitch_steps"

    id = Column(Integer, primary_key=True, index=True)
    stitch_id = Column(Integer, ForeignKey("stitches.id"), nullable=False)
    order = Column(Integer, nullable=False, default=1)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    image_url = Column(String(500))
    video_url = Column(String(500))
    tips = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    stitch = relationship("Stitch", back_populates="steps")
