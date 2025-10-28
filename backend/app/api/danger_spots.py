"""
Danger Spots API endpoints
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from uuid import UUID

from app.core.database import get_db
from app.models.database import DangerSpot, Image
from app.models.schemas import DangerSpotListResponse, DangerSpotWithImage, ImageSummary

router = APIRouter(prefix="/danger-spots", tags=["danger-spots"])


@router.get("", response_model=DangerSpotListResponse)
def get_danger_spots(
    min_lat: Optional[float] = Query(None, description="最小緯度"),
    max_lat: Optional[float] = Query(None, description="最大緯度"),
    min_lng: Optional[float] = Query(None, description="最小経度"),
    max_lng: Optional[float] = Query(None, description="最大経度"),
    min_score: Optional[float] = Query(None, ge=0, le=5, description="最小危険度スコア (0-5)"),
    damage_class: Optional[str] = Query(None, description="損傷クラスでフィルタ (例: D44)"),
    limit: int = Query(100, ge=1, le=1000, description="最大件数"),
    offset: int = Query(0, ge=0, description="ページネーションオフセット"),
    db: Session = Depends(get_db)
):
    """
    危険箇所を取得します
    
    - **min_lat, max_lat, min_lng, max_lng**: バウンディングボックスでフィルタ
    - **min_score**: 最小危険度スコア (0-5)
    - **damage_class**: 損傷クラスでフィルタ (例: "D44")
    - **limit**: 最大件数（デフォルト100）
    - **offset**: ページネーションオフセット（デフォルト0）
    """
    # Build query
    query = db.query(DangerSpot).join(Image, DangerSpot.image_id == Image.id)
    
    # Apply filters
    filters = []
    
    if min_lat is not None:
        filters.append(DangerSpot.latitude >= min_lat)
    if max_lat is not None:
        filters.append(DangerSpot.latitude <= max_lat)
    if min_lng is not None:
        filters.append(DangerSpot.longitude >= min_lng)
    if max_lng is not None:
        filters.append(DangerSpot.longitude <= max_lng)
    if min_score is not None:
        filters.append(DangerSpot.danger_score >= min_score)
    if damage_class is not None:
        filters.append(DangerSpot.damage_class == damage_class)
    
    if filters:
        query = query.filter(and_(*filters))
    
    # Get total count
    total = query.count()
    
    # Apply pagination and order
    danger_spots = query.order_by(DangerSpot.detected_at.desc()).limit(limit).offset(offset).all()
    
    # Build response with image details
    spots_with_images = []
    for spot in danger_spots:
        image = db.query(Image).filter(Image.id == spot.image_id).first()
        
        image_summary = None
        if image:
            image_summary = ImageSummary(
                id=image.id,
                filename=image.filename,
                frame_index=image.frame_index,
                extracted_at=image.extracted_at,
                gps_latitude=image.gps_latitude,
                gps_longitude=image.gps_longitude,
                damage_score=None,  # Will be filled by analysis result if needed
                primary_damage_class=spot.damage_class,
                confidence=spot.confidence
            )
        
        spot_with_image = DangerSpotWithImage(
            id=spot.id,
            image_id=spot.image_id,
            latitude=spot.latitude,
            longitude=spot.longitude,
            danger_score=spot.danger_score,
            damage_class=spot.damage_class,
            confidence=spot.confidence,
            detected_at=spot.detected_at,
            image=image_summary
        )
        spots_with_images.append(spot_with_image)
    
    return DangerSpotListResponse(
        spots=spots_with_images,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/heatmap")
def get_danger_spots_heatmap(
    min_lat: float = Query(..., description="最小緯度"),
    max_lat: float = Query(..., description="最大緯度"),
    min_lng: float = Query(..., description="最小経度"),
    max_lng: float = Query(..., description="最大経度"),
    grid_size: float = Query(0.001, description="グリッドサイズ（度単位）"),
    db: Session = Depends(get_db)
):
    """
    危険箇所のヒートマップデータを取得します
    
    - **min_lat, max_lat, min_lng, max_lng**: バウンディングボックス（必須）
    - **grid_size**: グリッドサイズ（度単位、デフォルト0.001）
    """
    # Query danger spots within bounding box
    danger_spots = db.query(
        DangerSpot.latitude,
        DangerSpot.longitude,
        DangerSpot.danger_score
    ).filter(
        and_(
            DangerSpot.latitude >= min_lat,
            DangerSpot.latitude <= max_lat,
            DangerSpot.longitude >= min_lng,
            DangerSpot.longitude <= max_lng
        )
    ).all()
    
    # Group by grid cells
    grid_data = {}
    for lat, lng, score in danger_spots:
        # Calculate grid cell
        grid_lat = round(lat / grid_size) * grid_size
        grid_lng = round(lng / grid_size) * grid_size
        grid_key = (grid_lat, grid_lng)
        
        if grid_key not in grid_data:
            grid_data[grid_key] = {"sum": 0, "count": 0}
        
        grid_data[grid_key]["sum"] += score
        grid_data[grid_key]["count"] += 1
    
    # Build heatmap points
    points = []
    for (grid_lat, grid_lng), data in grid_data.items():
        points.append({
            "latitude": grid_lat,
            "longitude": grid_lng,
            "intensity": data["sum"] / data["count"],  # Average score
            "count": data["count"]
        })
    
    return {
        "points": points,
        "grid_size": grid_size
    }
