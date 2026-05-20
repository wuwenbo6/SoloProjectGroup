from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    avatar = Column(String(500))
    bio = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    stitches = relationship("Stitch", back_populates="owner")
    works = relationship("Work", back_populates="owner")
    comments = relationship("Comment", back_populates="user")


class Stitch(Base):
    __tablename__ = "stitches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text, default="")
    category = Column(String(50), index=True, default="其他")
    difficulty = Column(String(20), default="入门")
    image_url = Column(String(500), default="")
    video_url = Column(String(500), default="")
    steps_text = Column(Text, default="")
    materials = Column(Text, default="")
    tips = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_public = Column(Boolean, default=True)
    view_count = Column(Integer, default=0)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="stitches")
    works = relationship("Work", back_populates="stitch")
    steps = relationship("StitchStep", back_populates="stitch", order_by="StitchStep.order", cascade="all, delete-orphan")
    history = relationship("StitchHistory", back_populates="stitch", order_by="StitchHistory.version.desc()", cascade="all, delete-orphan")


class Work(Base):
    __tablename__ = "works"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    image_url = Column(String(500))
    stitch_id = Column(Integer, ForeignKey("stitches.id"))
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    likes_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)

    owner = relationship("User", back_populates="works")
    stitch = relationship("Stitch", back_populates="works")
    comments = relationship("Comment", back_populates="work")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    work_id = Column(Integer, ForeignKey("works.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    parent_id = Column(Integer, ForeignKey("comments.id"))

    user = relationship("User", back_populates="comments")
    work = relationship("Work", back_populates="comments")
    replies = relationship("Comment", remote_side=[id])
