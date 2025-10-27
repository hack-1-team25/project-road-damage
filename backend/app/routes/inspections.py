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
    4. 各フレームのGPSから最寄り道路を検索し、道路ごとに `inspection` を作成
    5. 各 `image` に対して推論を実行し、`detected_objects` を保存
    6. 道路ごとに `aggregate_score` を計算して `inspections` に保存

    **リクエストパラメータ:**
    - `file`: 動画ファイル（mp4, mov など）
    - `gps_file`: GPS位置情報CSVファイル（timestamp,,,latitude,longitude形式）
    - `frame_interval` (optional): フレーム抽出間隔（ミリ秒、デフォルト: 1000）
    - `frame_rate` (optional): フレームレート上書き
    
    **注意:** road_id は自動的にGPS座標から算出されます
    """,
    response_description="検査が作成され、処理が開始されました（202 Accepted）"
)
async def create_inspection(
    service: InspectionServiceDep,
    file: UploadFile = File(..., description="動画ファイル（mp4, mov など）"),
    gps_file: UploadFile = File(..., description="GPS位置情報CSVファイル（timestamp,,,latitude,longitude形式）"),
    frame_interval: int = Form(1000, description="フレーム抽出間隔（ミリ秒）", ge=100),
    frame_rate: Optional[float] = Form(None, description="抽出時に使うフレームレート上書き")
) -> InspectionCreateResponse:
    """
    動画から新しい検査を作成します
    各フレームのGPS座標から最寄り道路を自動検索し、道路ごとに inspection を作成します

    Args:
        service: FastAPI によって注入される InspectionService インスタンス
        file: アップロードされた動画ファイル
        gps_file: GPS位置情報CSVファイル（timestamp,,,latitude,longitude形式）
        frame_interval: フレーム抽出間隔（ミリ秒）
        frame_rate: フレームレート上書き

    Returns:
        InspectionCreateResponse: 検査作成レスポンス

    Raises:
        HTTPException: エラー発生時は適切なステータスコードを返します

    Example response:
        {
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
    """
    try:
        # GPS CSVファイルの検証とパース
        if not gps_file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No GPS CSV file uploaded"
            )
        
        if not gps_file.filename.endswith('.csv'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GPS file must be a CSV file"
            )
        
        # CSVファイルを読み込んでパース
        gps_content = await gps_file.read()
        gps_text = gps_content.decode('utf-8')
        gps_data = []
        
        lines = gps_text.strip().split('\n')
        for i, line in enumerate(lines):
            # ヘッダー行をスキップ
            if i == 0:
                continue
            
            line = line.strip()
            if not line:
                continue
            
            parts = line.split(',')
            if len(parts) >= 5:
                try:
                    gps_data.append({
                        'timestamp': parts[0],
                        'latitude': float(parts[3]),
                        'longitude': float(parts[4])
                    })
                except (ValueError, IndexError) as e:
                    print(f"Warning: Failed to parse GPS line {i}: {line} - {str(e)}")
                    continue
        
        if not gps_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid GPS data found in CSV file"
            )

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
            gps_data=gps_data,
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
