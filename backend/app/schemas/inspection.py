"""
検査（Inspection）関連のスキーマ定義
リクエスト・レスポンスの型を定義します
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class InspectionCreateRequest(BaseModel):
    """検査作成リクエスト（フォームデータのパラメータ）"""
    latitude: Optional[float] = Field(None, description="検査の代表位置（緯度）")
    longitude: Optional[float] = Field(None, description="検査の代表位置（経度）")
    road_id: Optional[int] = Field(None, description="関連する道路ID")
    frame_interval: Optional[int] = Field(1000, description="フレーム抽出間隔（ミリ秒）", ge=100)
    frame_rate: Optional[float] = Field(None, description="抽出時に使うフレームレート上書き")


class RoadInspectionInfo(BaseModel):
    """道路別検査情報"""
    inspection_id: int = Field(..., description="検査ID")
    road_id: Optional[int] = Field(None, description="道路ID（未割当の場合はNull）")
    frame_count: int = Field(..., description="フレーム数")
    aggregate_score: float = Field(..., description="集約スコア")


class InspectionCreateResponse(BaseModel):
    """検査作成レスポンス（202 Accepted）"""
    parent_inspection_id: int = Field(..., description="親検査ID（動画管理用）")
    video_id: int = Field(..., description="作成された動画ID")
    job_id: str = Field(..., description="処理ジョブのID")
    inspections: List[RoadInspectionInfo] = Field(..., description="道路別の検査情報リスト")
    status: str = Field(..., description="処理ステータス")
    message: str = Field(..., description="メッセージ")

    class Config:
        json_schema_extra = {
            "example": {
                "parent_inspection_id": 123,
                "video_id": 456,
                "job_id": "uuid-of-processing-job",
                "inspections": [
                    {"inspection_id": 124, "road_id": 1, "frame_count": 10, "aggregate_score": 2.5},
                    {"inspection_id": 125, "road_id": 2, "frame_count": 5, "aggregate_score": 1.8}
                ],
                "status": "processing",
                "message": "Video uploaded and processing started. Created 2 road-specific inspections."
            }
        }


class DetectedObjectResponse(BaseModel):
    """検出オブジェクトのレスポンス"""
    id: int
    class_name: str
    confidence: float
    bounding_box: dict

    class Config:
        from_attributes = True


class ImageResponse(BaseModel):
    """画像のレスポンス"""
    id: int
    file_path: str

    class Config:
        from_attributes = True


class AnalysisResultResponse(BaseModel):
    """分析結果のレスポンス"""
    id: int
    score: float
    details: Optional[dict] = None

    class Config:
        from_attributes = True


class InspectionDetailResponse(BaseModel):
    """検査詳細レスポンス"""
    id: int
    road_id: Optional[int]
    location: Optional[dict]  # GeoJSON Point形式
    status: str
    created_at: datetime
    image: Optional[ImageResponse]
    detected_objects: List[DetectedObjectResponse] = []
    analysis_result: Optional[AnalysisResultResponse]

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 123,
                "road_id": 1,
                "location": {"type": "Point", "coordinates": [139.75, 35.70]},
                "status": "completed",
                "created_at": "2025-10-03T10:00:00Z",
                "image": {
                    "id": 456,
                    "file_path": "/media/images/image_name.jpg"
                },
                "detected_objects": [
                    {
                        "id": 789,
                        "class_name": "crack",
                        "confidence": 0.95,
                        "bounding_box": {"x": 10, "y": 20, "width": 50, "height": 30}
                    }
                ],
                "analysis_result": {
                    "id": 101,
                    "score": 85.5,
                    "details": {}
                }
            }
        }


class InspectionListItem(BaseModel):
    """検査リストアイテム"""
    id: int
    road_id: Optional[int]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
