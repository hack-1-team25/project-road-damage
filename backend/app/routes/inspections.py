"""
検査 API エンドポイント
検査関連操作の RESTful API を提供します
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated, Optional

from app.database import get_db
from app.repositories.inspection_repository import InspectionRepository
from app.services.inspection_service import InspectionService
from app.services.video_processing_service import VideoProcessingService
from app.schemas.inspection import InspectionCreateResponse


# OpenAPI ドキュメント用のプレフィックスとタグを持つルーターを作成
router = APIRouter(
    prefix="/api/v1/inspections",
    tags=["inspections"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)


# データベースセッション用の依存性注入
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


def get_inspection_service(db: DatabaseSession) -> InspectionService:
    """
    InspectionService の依存性注入用ファクトリ

    この関数はサービス層を必要な依存関係と共に生成します。
    FastAPI が自動的に呼び出して注入します。

    Args:
        db: FastAPI によって注入されるデータベースセッション

    Returns:
        初期化済みの InspectionService インスタンス
    """
    repository = InspectionRepository(db)
    video_service = VideoProcessingService()
    return InspectionService(repository, video_service)


# InspectionService 用の依存定義
InspectionServiceDep = Annotated[InspectionService, Depends(get_inspection_service)]


@router.post(
    "",
    response_model=InspectionCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a new inspection from video",
    description="""
    新しい検査を開始します。

    クライアントは動画ファイル（例：車載カメラの録画）をアップロードします。
    サーバ側で動画を受け取り、フレーム抽出ジョブを作成して各フレームに対して
    AI推論（YOLO等）を非同期で実行します。

    **処理フロー:**
    1. サーバは `videos` レコードを作成し動画をストレージに保存する
    2. 非同期ジョブ (`jobs` テーブル) を登録
    3. ワーカーが動画からフレームを抽出して `images`（フレーム単位）を作成
    4. 各 `image` に対して推論を実行し、`detected_objects` を保存
    5. 全フレーム推論完了後に `analysis_results` を計算して `inspections` に紐づける

    **リクエストパラメータ:**
    - `file`: 動画ファイル（mp4, mov など）
    - `latitude` / `longitude` (optional): 検査の代表位置
    - `road_id` (optional): 関連する道路ID
    - `frame_interval` (optional): フレーム抽出間隔（ミリ秒、デフォルト: 1000）
    - `frame_rate` (optional): フレームレート上書き
    """,
    response_description="検査が作成され、処理が開始されました（202 Accepted）"
)
async def create_inspection(
    service: InspectionServiceDep,
    file: UploadFile = File(..., description="動画ファイル（mp4, mov など）"),
    latitude: Optional[float] = Form(None, description="検査の代表位置（緯度）"),
    longitude: Optional[float] = Form(None, description="検査の代表位置（経度）"),
    road_id: Optional[int] = Form(None, description="関連する道路ID"),
    frame_interval: int = Form(1000, description="フレーム抽出間隔（ミリ秒）", ge=100),
    frame_rate: Optional[float] = Form(None, description="抽出時に使うフレームレート上書き")
) -> InspectionCreateResponse:
    """
    動画から新しい検査を作成します

    Args:
        service: FastAPI によって注入される InspectionService インスタンス
        file: アップロードされた動画ファイル
        latitude: 検査の代表位置（緯度）
        longitude: 検査の代表位置（経度）
        road_id: 関連する道路ID
        frame_interval: フレーム抽出間隔（ミリ秒）
        frame_rate: フレームレート上書き

    Returns:
        InspectionCreateResponse: 検査作成レスポンス

    Raises:
        HTTPException: エラー発生時は適切なステータスコードを返します

    Example response:
        {
            "inspection_id": 123,
            "video_id": 456,
            "job_id": "uuid-of-processing-job",
            "status": "processing",
            "message": "Video uploaded and processing started. Check job status with /api/v1/jobs/{job_id}."
        }
    """
    try:
        # ファイルの検証
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file uploaded"
            )

        # 許可される動画拡張子
        allowed_extensions = {'.mp4', '.mov', '.avi', '.mkv'}
        file_ext = '.' + file.filename.split('.')[-1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
            )

        # ファイル内容を読み込む
        file_content = await file.read()
        
        if len(file_content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty"
            )

        # 検査を作成
        result = await service.create_inspection_from_video(
            file_content=file_content,
            filename=file.filename,
            latitude=latitude,
            longitude=longitude,
            road_id=road_id,
            frame_interval=frame_interval,
            frame_rate=frame_rate
        )

        return InspectionCreateResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        # エラーをログ出力（本番環境では適切なロギングを利用してください）
        print(f"Error creating inspection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create inspection: {str(e)}"
        )
