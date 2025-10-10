"""
道路 API エンドポイント
道路関連操作の RESTful API を提供します
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.database import get_db
from app.repositories.road_repository import RoadRepository
from app.services.road_service import RoadService
from app.schemas.geojson import RoadFeatureCollection


# OpenAPI ドキュメント用のプレフィックスとタグを持つルーターを作成
router = APIRouter(
    prefix="/api/v1/roads",
    tags=["roads"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"}
    }
)


# データベースセッション用の依存性注入
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]


def get_road_service(db: DatabaseSession) -> RoadService:
    """
    RoadService の依存性注入用ファクトリ

    この関数はサービス層を必要な依存関係と共に生成します。
    FastAPI が自動的に呼び出して注入します。

    Args:
        db: FastAPI によって注入されるデータベースセッション

    Returns:
        初期化済みの RoadService インスタンス
    """
    repository = RoadRepository(db)
    return RoadService(repository)


# RoadService 用の依存定義
RoadServiceDep = Annotated[RoadService, Depends(get_road_service)]


@router.get(
    "",
    response_model=RoadFeatureCollection,
    summary="Get all roads",
    description="""
    地理情報（GeoJSON 形式）付きで全道路を取得します。

    このエンドポイントはデータベースに保存されたすべての道路を含む
    GeoJSON の FeatureCollection を返します。各道路は以下を持ちます:
    - 緯度・経度の座標ペア [longitude, latitude] を含む LineString ジオメトリ
    - 道路 ID や名前などのプロパティ

    レスポンスは GeoJSON 仕様 (RFC 7946) に準拠しています。
    """,
    response_description="GeoJSON FeatureCollection of all roads"
)
async def get_all_roads(
    service: RoadServiceDep
) -> RoadFeatureCollection:
    """
    GeoJSON の FeatureCollection として全道路を取得します

    Args:
        service: FastAPI によって注入される RoadService インスタンス

    Returns:
        RoadFeatureCollection: 全道路を含む GeoJSON FeatureCollection

    Raises:
        HTTPException: データベースエラー発生時は 500 を返します

    Example response:
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [139.7452763, 35.7296523],
                            [139.745291, 35.7296358],
                            [139.7453141, 35.72961]
                        ]
                    },
                    "properties": {
                        "id": 1,
                        "name": "国道20号線"
                    }
                }
            ]
        }
    """
    try:
        return await service.get_all_roads_geojson()
    except Exception as e:
    # エラーをログ出力（本番環境では適切なロギングを利用してください）
        print(f"Error fetching roads: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve roads from database"
        )


@router.get(
    "/count",
    response_model=dict,
    summary="Get road count",
    description="Get the total number of roads in the database"
)
async def get_roads_count(
    service: RoadServiceDep
) -> dict:
    """
    道路の総数を取得します

    Args:
        service: FastAPI によって注入される RoadService インスタンス

    Returns:
        count フィールドを含む辞書

    Example response:
        {"count": 1234}
    """
    try:
        count = await service.get_roads_count()
        return {"count": count}
    except Exception as e:
        print(f"Error counting roads: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to count roads"
        )
