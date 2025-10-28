"""
Pydantic schemas for API request/response models
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================
# Video Schemas
# ============================================
class VideoCreate(BaseModel):
    """Schema for video upload"""
    frame_interval: int = Field(default=10, description="Frame extraction interval in seconds")


class VideoResponse(BaseModel):
    """Schema for video response"""
    id: UUID
    filename: str
    storage_path: str
    frame_interval: int
    status: str
    job_id: Optional[UUID] = None
    duration_seconds: Optional[float] = None
    frame_rate: Optional[float] = None
    total_frames: Optional[int] = None
    extracted_frames: int
    created_at: datetime

    class Config:
        from_attributes = True


class VideoDetailResponse(VideoResponse):
    """Schema for detailed video response with images"""
    images: List["ImageSummary"] = []


# ============================================
# Image Schemas
# ============================================
class ImageSummary(BaseModel):
    """Summary schema for image in lists"""
    id: UUID
    filename: str
    frame_index: Optional[int] = None
    extracted_at: Optional[datetime] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    damage_score: Optional[int] = None
    primary_damage_class: Optional[str] = None
    confidence: Optional[float] = None

    class Config:
        from_attributes = True


class ImageResponse(BaseModel):
    """Schema for image response"""
    id: UUID
    filename: str
    storage_path: str
    processed_image_path: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    status: str
    video_id: Optional[UUID] = None
    frame_index: Optional[int] = None
    capture_timestamp: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Detected Object Schemas
# ============================================
class DetectedObjectResponse(BaseModel):
    """Schema for detected object"""
    id: UUID
    image_id: UUID
    class_name: str = Field(alias="class")
    confidence: float
    bbox_x: float
    bbox_y: float
    bbox_width: float
    bbox_height: float
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class BoundingBox(BaseModel):
    """Bounding box schema"""
    x: float
    y: float
    width: float
    height: float


# ============================================
# Analysis Result Schemas
# ============================================
class AnalysisResultResponse(BaseModel):
    """Schema for analysis result"""
    id: UUID
    image_id: UUID
    damage_score: int
    primary_damage_class: Optional[str] = None
    primary_confidence: Optional[float] = None
    object_count: int
    analyzed_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Danger Spot Schemas
# ============================================
class DangerSpotResponse(BaseModel):
    """Schema for danger spot"""
    id: UUID
    image_id: UUID
    latitude: float
    longitude: float
    danger_score: float
    damage_class: Optional[str] = None
    confidence: Optional[float] = None
    detected_at: datetime

    class Config:
        from_attributes = True


class DangerSpotWithImage(DangerSpotResponse):
    """Danger spot with image details"""
    image: Optional[ImageSummary] = None


class DangerSpotListResponse(BaseModel):
    """Response for danger spot list"""
    spots: List[DangerSpotWithImage]
    total: int
    limit: int
    offset: int


# ============================================
# Job Schemas
# ============================================
class JobResponse(BaseModel):
    """Schema for job response"""
    id: UUID
    job_type: str
    entity_id: UUID
    status: str
    progress: float
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Image Detail Response (with related data)
# ============================================
class ImageDetailResponse(ImageResponse):
    """Detailed image response with analysis results"""
    analysis_result: Optional[AnalysisResultResponse] = None
    detected_objects: List[DetectedObjectResponse] = []
    danger_spots: List[DangerSpotResponse] = []


# ============================================
# Statistics Schemas
# ============================================
class StatisticsResponse(BaseModel):
    """Schema for statistics"""
    total_images: int
    total_videos: int
    total_danger_spots: int
    damage_distribution: dict
    damage_class_distribution: dict
    average_confidence: float
    last_updated: datetime


# ============================================
# Roboflow Response Schemas (Internal)
# ============================================
class RoboflowPrediction(BaseModel):
    """Roboflow API prediction response"""
    x: float
    y: float
    width: float
    height: float
    confidence: float
    class_name: str = Field(alias="class")
    class_id: int

    class Config:
        populate_by_name = True


class RoboflowResponse(BaseModel):
    """Roboflow API response"""
    predictions: List[RoboflowPrediction]
    image: dict


# Update forward references
VideoDetailResponse.model_rebuild()
