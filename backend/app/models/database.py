"""
SQLAlchemy database models
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship, declarative_base
from geoalchemy2 import Geometry
import uuid

Base = declarative_base()


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    videos = relationship("Video", back_populates="uploader")


class Video(Base):
    """Video model"""
    __tablename__ = "videos"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    storage_type = Column(String(20), nullable=False)
    storage_path = Column(Text, nullable=False)
    duration_seconds = Column(Float)
    frame_rate = Column(Float)
    frame_interval = Column(Integer, default=60)
    total_frames = Column(Integer)
    extracted_frames = Column(Integer, default=0)
    status = Column(String(50), nullable=False, default='uploaded')
    gps_log_path = Column(Text)
    uploaded_by = Column(PG_UUID(as_uuid=True), ForeignKey('users.id'))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    uploader = relationship("User", back_populates="videos")
    images = relationship("Image", back_populates="video", cascade="all, delete-orphan")


class Image(Base):
    """Image model"""
    __tablename__ = "images"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    video_id = Column(PG_UUID(as_uuid=True), ForeignKey('videos.id', ondelete='CASCADE'))
    filename = Column(String(255), nullable=False)
    storage_type = Column(String(20), nullable=False)
    storage_path = Column(Text, nullable=False)
    processed_image_path = Column(Text)
    gps_latitude = Column(Float)
    gps_longitude = Column(Float)
    gps_location = Column(Geometry('POINT', srid=4326))
    extracted_at = Column(DateTime(timezone=True))
    capture_timestamp = Column(DateTime(timezone=True))
    frame_index = Column(Integer)
    status = Column(String(50), nullable=False, default='uploaded')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    video = relationship("Video", back_populates="images")
    detected_objects = relationship("DetectedObject", back_populates="image", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="image", cascade="all, delete-orphan")
    danger_spots = relationship("DangerSpot", back_populates="image", cascade="all, delete-orphan")


class DetectedObject(Base):
    """Detected object model"""
    __tablename__ = "detected_objects"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(PG_UUID(as_uuid=True), ForeignKey('images.id', ondelete='CASCADE'), nullable=False)
    class_ = Column('class', String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    bbox_x = Column(Float, nullable=False)
    bbox_y = Column(Float, nullable=False)
    bbox_width = Column(Float, nullable=False)
    bbox_height = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    image = relationship("Image", back_populates="detected_objects")


class AnalysisResult(Base):
    """Analysis result model"""
    __tablename__ = "analysis_results"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(PG_UUID(as_uuid=True), ForeignKey('images.id', ondelete='CASCADE'), nullable=False)
    damage_score = Column(Integer, nullable=False)
    primary_damage_class = Column(String(50))
    primary_confidence = Column(Float)
    object_count = Column(Integer, default=0)
    analyzed_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    image = relationship("Image", back_populates="analysis_results")


class DangerSpot(Base):
    """Danger spot model"""
    __tablename__ = "danger_spots"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_id = Column(PG_UUID(as_uuid=True), ForeignKey('images.id', ondelete='CASCADE'), nullable=False)
    location = Column(Geometry('POINT', srid=4326), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    danger_score = Column(Float, nullable=False)
    damage_class = Column(String(50))
    confidence = Column(Float)
    detected_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    image = relationship("Image", back_populates="danger_spots")


class Job(Base):
    """Job model for background processing"""
    __tablename__ = "jobs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_type = Column(String(50), nullable=False)
    entity_id = Column(PG_UUID(as_uuid=True), nullable=False)
    status = Column(String(50), nullable=False, default='pending')
    progress = Column(Float, default=0.0)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
