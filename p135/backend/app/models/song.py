from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from ..core.database import Base


class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    artist = Column(String(255), nullable=True, index=True)
    album = Column(String(255), nullable=True)
    file_path = Column(String(512), nullable=False)
    duration = Column(Integer, nullable=True)
    cover_image = Column(Text, nullable=True)
    cover_url = Column(String(512), nullable=True)
    lyrics = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    fingerprints = relationship("Fingerprint", back_populates="song", cascade="all, delete-orphan")


class Fingerprint(Base):
    __tablename__ = "fingerprints"

    id = Column(Integer, primary_key=True, index=True)
    song_id = Column(Integer, ForeignKey("songs.id", ondelete="CASCADE"), nullable=False)
    hash = Column(String(40), nullable=False, index=True)
    offset = Column(Integer, nullable=False)
    vector = Column(Vector(256), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    song = relationship("Song", back_populates="fingerprints")
