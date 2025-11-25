"""
Video API endpoints
"""
import os
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.config import settings
from app.models.database import Video, Image, DetectedObject, AnalysisResult, DangerSpot, Job
from app.models.schemas import VideoResponse, VideoDetailResponse, ImageSummary
from app.services.video_service import video_processing_service
from app.services.roboflow_service import roboflow_service

router = APIRouter(prefix="/videos", tags=["videos"])


async def process_video_task(
    video_id: UUID,
    video_path: str,
    gps_csv_path: str,
    frame_interval: int,
    db: Session
):
    """
    Background task to process video:
    1. Parse GPS CSV
    2. Extract frames at intervals
    3. Map GPS coordinates to frames
    4. Analyze each frame with YOLO
    5. Save results to database
    """
    job = db.query(Job).filter(Job.entity_id == video_id).first()
    
    try:
        # Update job status
        job.status = "processing"
        job.started_at = datetime.utcnow()
        db.commit()
        
        # 1. Parse GPS file (CSV or GPX)
        gps_points = video_processing_service.parse_gps_file(gps_csv_path)
        
        if not gps_points:
            raise ValueError("No valid GPS points found in CSV")
        
        # 2. Get video metadata
        metadata = video_processing_service.get_video_metadata(video_path)
        video = db.query(Video).filter(Video.id == video_id).first()
        video.duration_seconds = metadata['duration_seconds']
        video.frame_rate = metadata['frame_rate']
        video.total_frames = int(metadata['duration_seconds'] / frame_interval)
        db.commit()
        
        # 3. Extract frames
        output_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "frames", str(video_id))
        frames = video_processing_service.extract_frames_at_interval(
            video_path,
            frame_interval,
            output_dir
        )
        
        total_frames = len(frames)
        
        # 4. Process each frame
        for idx, (frame_index, frame_path, timestamp_ms) in enumerate(frames):
            # Find GPS coordinates
            gps_point = video_processing_service.find_closest_gps_point(
                int(timestamp_ms),
                gps_points
            )
            
            # Read frame image
            with open(frame_path, 'rb') as f:
                image_bytes = f.read()
            
            # Create image record
            image = Image(
                video_id=video_id,
                filename=os.path.basename(frame_path),
                storage_type="local",
                storage_path=frame_path,
                frame_index=frame_index,
                extracted_at=datetime.utcnow(),
                capture_timestamp=gps_point.timestamp if gps_point else None,
                gps_latitude=gps_point.latitude if gps_point else None,
                gps_longitude=gps_point.longitude if gps_point else None,
                status="processing"
            )
            db.add(image)
            db.flush()
            
            # 5. Analyze with YOLO
            yolo_result = await roboflow_service.analyze_image(image_bytes)
            
            # Calculate damage score
            damage_score = roboflow_service.calculate_damage_score(yolo_result.predictions)
            primary_class, primary_conf = roboflow_service.get_primary_damage(yolo_result.predictions)
            
            # Create annotated image
            if yolo_result.predictions:
                annotated_bytes = await roboflow_service.create_annotated_image(
                    image_bytes,
                    yolo_result.predictions
                )
                
                # Save annotated image
                processed_path = os.path.join(
                    settings.LOCAL_STORAGE_PATH,
                    "processed",
                    str(video_id),
                    f"processed_{frame_index:04d}.jpg"
                )
                os.makedirs(os.path.dirname(processed_path), exist_ok=True)
                
                with open(processed_path, 'wb') as f:
                    f.write(annotated_bytes)
                
                image.processed_image_path = processed_path
            
            # Update image status
            image.status = "analyzed"
            
            # Save detected objects
            for pred in yolo_result.predictions:
                detected_obj = DetectedObject(
                    image_id=image.id,
                    class_=pred.class_name,
                    confidence=pred.confidence,
                    bbox_x=pred.x,
                    bbox_y=pred.y,
                    bbox_width=pred.width,
                    bbox_height=pred.height
                )
                db.add(detected_obj)
            
            # Save analysis result
            analysis = AnalysisResult(
                image_id=image.id,
                damage_score=damage_score,
                primary_damage_class=primary_class,
                primary_confidence=primary_conf,
                object_count=len(yolo_result.predictions),
                analyzed_at=datetime.utcnow()
            )
            db.add(analysis)
            
            # Create danger spot if damage detected
            if damage_score > 0 and gps_point:
                danger_spot = DangerSpot(
                    image_id=image.id,
                    latitude=gps_point.latitude,
                    longitude=gps_point.longitude,
                    danger_score=float(damage_score),
                    damage_class=primary_class,
                    confidence=primary_conf,
                    detected_at=datetime.utcnow()
                )
                db.add(danger_spot)
            
            # Update progress
            progress = ((idx + 1) / total_frames) * 100
            job.progress = progress
            video.extracted_frames = idx + 1
            
            db.commit()
        
        # Mark as completed
        video.status = "completed"
        job.status = "completed"
        job.progress = 100.0
        job.completed_at = datetime.utcnow()
        db.commit()
        
    except Exception as e:
        # Mark as failed
        video.status = "failed"
        job.status = "failed"
        job.error_message = str(e)
        db.commit()
        raise


@router.post("", response_model=VideoResponse, status_code=202)
async def upload_video(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    gps_log_file: UploadFile = File(...),
    frame_interval: int = Form(default=10),
    db: Session = Depends(get_db)
):
    """
    Upload video and GPS file (CSV or GPX), start background processing
    
    - **video_file**: Video file (MP4/MOV/AVI)
    - **gps_log_file**: GPS file (CSV or GPX format)
    - **frame_interval**: Frame extraction interval in seconds (default: 10)
    """
    # Validate file types
    allowed_video_types = settings.ALLOWED_VIDEO_TYPES.split(",")
    
    if video_file.content_type not in allowed_video_types:
        raise HTTPException(400, "Invalid video file type")
    
    # Validate GPS file by extension (more reliable than content-type)
    gps_filename = gps_log_file.filename or ""
    gps_extension = gps_filename.lower().split('.')[-1] if '.' in gps_filename else ""
    
    if gps_extension not in ['csv', 'gpx']:
        raise HTTPException(400, f"Invalid GPS file type. Accepted types: CSV or GPX (got .{gps_extension})")
    
    # Generate unique ID
    video_id = uuid.uuid4()
    
    # Save video file
    video_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "videos")
    os.makedirs(video_dir, exist_ok=True)
    
    video_filename = f"{video_id}_{video_file.filename}"
    video_path = os.path.join(video_dir, video_filename)
    
    with open(video_path, 'wb') as f:
        content = await video_file.read()
        f.write(content)
    
    # Save GPS CSV
    gps_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "gps")
    os.makedirs(gps_dir, exist_ok=True)
    
    gps_filename = f"{video_id}_{gps_log_file.filename}"
    gps_path = os.path.join(gps_dir, gps_filename)
    
    with open(gps_path, 'wb') as f:
        content = await gps_log_file.read()
        f.write(content)
    
    # Create video record
    video = Video(
        id=video_id,
        filename=video_file.filename,
        storage_type="local",
        storage_path=video_path,
        frame_interval=frame_interval,
        gps_log_path=gps_path,
        status="uploaded"
    )
    db.add(video)
    db.flush()
    
    # Create job record
    job = Job(
        job_type="video_processing",
        entity_id=video_id,
        status="pending",
        progress=0.0
    )
    db.add(job)
    db.commit()
    
    # Start background processing
    # Note: In production, use Celery for this
    background_tasks.add_task(
        process_video_task,
        video_id,
        video_path,
        gps_path,
        frame_interval,
        db
    )
    
    return VideoResponse(
        id=video.id,
        filename=video.filename,
        storage_path=video.storage_path,
        frame_interval=video.frame_interval,
        status=video.status,
        job_id=job.id,
        extracted_frames=video.extracted_frames,
        created_at=video.created_at
    )


@router.get("/{video_id}", response_model=VideoDetailResponse)
def get_video(video_id: UUID, db: Session = Depends(get_db)):
    """
    Get video details and processing status
    """
    video = db.query(Video).filter(Video.id == video_id).first()
    
    if not video:
        raise HTTPException(404, "Video not found")
    
    # Get images
    images = db.query(Image).filter(Image.video_id == video_id).all()
    
    # Build image summaries with analysis results
    image_summaries = []
    for img in images:
        analysis = db.query(AnalysisResult).filter(AnalysisResult.image_id == img.id).first()
        
        image_summaries.append(ImageSummary(
            id=img.id,
            filename=img.filename,
            frame_index=img.frame_index,
            extracted_at=img.extracted_at,
            gps_latitude=img.gps_latitude,
            gps_longitude=img.gps_longitude,
            damage_score=analysis.damage_score if analysis else None,
            primary_damage_class=analysis.primary_damage_class if analysis else None,
            confidence=analysis.primary_confidence if analysis else None
        ))
    
    return VideoDetailResponse(
        id=video.id,
        filename=video.filename,
        storage_path=video.storage_path,
        frame_interval=video.frame_interval,
        status=video.status,
        duration_seconds=video.duration_seconds,
        frame_rate=video.frame_rate,
        total_frames=video.total_frames,
        extracted_frames=video.extracted_frames,
        created_at=video.created_at,
        images=image_summaries
    )
