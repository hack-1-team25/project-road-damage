from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Column, JSON
from sqlalchemy import TIMESTAMP, Integer, String, Float, Text
from geoalchemy2 import Geometry


class Road(SQLModel, table=True):
    __tablename__ = 'roads'
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None, sa_column=Column(String(255)))
    # PostGIS の LineString
    geom: Optional[str] = Field(default=None, sa_column=Column(Geometry(geometry_type='LINESTRING', srid=4326)))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))


class Inspection(SQLModel, table=True):
    __tablename__ = 'inspections'
    id: Optional[int] = Field(default=None, primary_key=True)
    road_id: Optional[int] = Field(default=None, sa_column=Column(Integer))
    # 代表地点（代表的な位置情報）
    location: Optional[str] = Field(default=None, sa_column=Column(Geometry(geometry_type='POINT', srid=4326)))
    status: Optional[str] = Field(default='pending', sa_column=Column(String(50)))
    aggregate_score: Optional[float] = Field(default=None, sa_column=Column(Float))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))


class Image(SQLModel, table=True):
    __tablename__ = 'images'
    id: Optional[int] = Field(default=None, primary_key=True)
    inspection_id: Optional[int] = Field(default=None, sa_column=Column(Integer))
    file_path: Optional[str] = Field(default=None, sa_column=Column(String(255)))
    uploaded_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))
    video_id: Optional[int] = Field(default=None, sa_column=Column(Integer))
    frame_index: Optional[int] = Field(default=None, sa_column=Column(Integer))
    width: Optional[int] = Field(default=None, sa_column=Column(Integer))
    height: Optional[int] = Field(default=None, sa_column=Column(Integer))
    source: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    damage_score: Optional[float] = Field(default=None, sa_column=Column(Float))
    original_timestamp: Optional[datetime] = Field(default=None, sa_column=Column(TIMESTAMP(timezone=True)))
    gps_latitude: Optional[float] = Field(default=None, sa_column=Column(Float))
    gps_longitude: Optional[float] = Field(default=None, sa_column=Column(Float))


class Video(SQLModel, table=True):
    __tablename__ = 'videos'
    id: Optional[int] = Field(default=None, primary_key=True)
    inspection_id: Optional[int] = Field(default=None, sa_column=Column(Integer))
    file_path: Optional[str] = Field(default=None, sa_column=Column(String(255)))
    duration_ms: Optional[int] = Field(default=None, sa_column=Column(Integer))
    frame_rate: Optional[float] = Field(default=None, sa_column=Column(Float))
    uploaded_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))


class DetectedObject(SQLModel, table=True):
    __tablename__ = 'detected_objects'
    id: Optional[int] = Field(default=None, primary_key=True)
    image_id: Optional[int] = Field(default=None, sa_column=Column(Integer))
    class_name: Optional[str] = Field(default=None, sa_column=Column(String(100)))
    confidence: Optional[float] = Field(default=None, sa_column=Column(Float))
    bounding_box: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    score: Optional[float] = Field(default=None, sa_column=Column(Float))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))


class AnalysisResult(SQLModel, table=True):
    __tablename__ = 'analysis_results'
    id: Optional[int] = Field(default=None, primary_key=True)
    inspection_id: Optional[int] = Field(default=None, sa_column=Column(Integer))
    score: Optional[float] = Field(default=None, sa_column=Column(Float))
    details: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))


class Job(SQLModel, table=True):
    __tablename__ = 'jobs'
    id: Optional[int] = Field(default=None, primary_key=True)
    inspection_id: Optional[int] = Field(default=None, sa_column=Column(Integer))
    type: Optional[str] = Field(default=None, sa_column=Column(String(50)))
    status: Optional[str] = Field(default='queued', sa_column=Column(String(50)))
    progress: Optional[int] = Field(default=None, sa_column=Column(Integer))
    payload: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))


class User(SQLModel, table=True):
    __tablename__ = 'users'
    id: Optional[int] = Field(default=None, primary_key=True)
    username: Optional[str] = Field(default=None, sa_column=Column(String(255), unique=True))
    email: Optional[str] = Field(default=None, sa_column=Column(String(255), unique=True))
    password_hash: Optional[str] = Field(default=None, sa_column=Column(String(255)))
    role: Optional[str] = Field(default='user', sa_column=Column(String(50)))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(TIMESTAMP(timezone=True), nullable=False))
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base
import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    id = sa.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = sa.Column(sa.String(320), unique=True, nullable=False)
    hashed_password = sa.Column(sa.String, nullable=False)
    full_name = sa.Column(sa.String)
    role = sa.Column(sa.String, nullable=False, default='user')
    is_active = sa.Column(sa.Boolean, nullable=False, default=True)
    created_at = sa.Column(sa.DateTime(timezone=True), default=datetime.datetime.utcnow)
    updated_at = sa.Column(sa.DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
