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


class InspectionCreateResponse(BaseModel):
    """検査作成レスポンス（202 Accepted）"""
    inspection_id: int = Field(..., description="作成された検査ID")
    video_id: int = Field(..., description="作成された動画ID")
    job_id: str = Field(..., description="処理ジョブのID")
    status: str = Field(..., description="処理ステータス")
    message: str = Field(..., description="メッセージ")

    class Config:
        json_schema_extra = {
            "example": {
                "inspection_id": 123,
                "video_id": 456,
                "job_id": "uuid-of-processing-job",
                "status": "processing",
                "message": "Video uploaded and processing started. Check job status with /api/v1/jobs/{job_id}."
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
