"""
検査（Inspection）リポジトリ
データベースアクセス層を提供します
"""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from geoalchemy2.functions import ST_AsGeoJSON, ST_GeomFromText

from app.models import Inspection, Video, Image, DetectedObject, AnalysisResult, Job


class InspectionRepository:
    """検査データへのデータベースアクセスを提供するリポジトリクラス"""

    def __init__(self, db: AsyncSession):
        """
        Args:
            db: 非同期データベースセッション
        """
        self.db = db

    async def create_inspection(
        self,
        road_id: Optional[int] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        status: str = "pending"
    ) -> Inspection:
        """
        新しい検査レコードを作成します

        Args:
            road_id: 関連する道路ID
            latitude: 緯度
            longitude: 経度
            status: ステータス

        Returns:
            作成された Inspection オブジェクト
        """
        inspection = Inspection(
            road_id=road_id,
            status=status,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # 位置情報がある場合はPostGIS形式で設定
        if latitude is not None and longitude is not None:
            # ST_GeomFromText を使用してPOINT ジオメトリを作成
            point_wkt = f"POINT({longitude} {latitude})"
            inspection.location = point_wkt

        self.db.add(inspection)
        await self.db.commit()
        await self.db.refresh(inspection)
        return inspection

    async def get_inspection_by_id(self, inspection_id: int) -> Optional[Inspection]:
        """
        IDで検査を取得します

        Args:
            inspection_id: 検査ID

        Returns:
            Inspection オブジェクト、見つからない場合は None
        """
        result = await self.db.execute(
            select(Inspection).where(Inspection.id == inspection_id)
        )
        return result.scalar_one_or_none()

    async def update_inspection_status(
        self,
        inspection_id: int,
        status: str,
        aggregate_score: Optional[float] = None
    ) -> Optional[Inspection]:
        """
        検査のステータスを更新します

        Args:
            inspection_id: 検査ID
            status: 新しいステータス
            aggregate_score: 集約スコア（オプション）

        Returns:
            更新された Inspection オブジェクト
        """
        inspection = await self.get_inspection_by_id(inspection_id)
        if inspection:
            inspection.status = status
            inspection.updated_at = datetime.utcnow()
            if aggregate_score is not None:
                inspection.aggregate_score = aggregate_score
            await self.db.commit()
            await self.db.refresh(inspection)
        return inspection

    async def create_video(
        self,
        inspection_id: int,
        file_path: str,
        duration_ms: Optional[int] = None,
        frame_rate: Optional[float] = None
    ) -> Video:
        """
        動画レコードを作成します

        Args:
            inspection_id: 関連する検査ID
            file_path: ファイルパス
            duration_ms: 動画長（ミリ秒）
            frame_rate: フレームレート

        Returns:
            作成された Video オブジェクト
        """
        video = Video(
            inspection_id=inspection_id,
            file_path=file_path,
            duration_ms=duration_ms,
            frame_rate=frame_rate,
            uploaded_at=datetime.utcnow()
        )
        self.db.add(video)
        await self.db.commit()
        await self.db.refresh(video)
        return video

    async def create_image(
        self,
        inspection_id: int,
        file_path: str,
        video_id: Optional[int] = None,
        frame_index: Optional[int] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        source: str = "video_frame",
        gps_latitude: Optional[float] = None,
        gps_longitude: Optional[float] = None
    ) -> Image:
        """
        画像（フレーム）レコードを作成します

        Args:
            inspection_id: 関連する検査ID
            file_path: ファイルパス
            video_id: 元動画ID
            frame_index: フレーム番号
            width: 画像幅
            height: 画像高
            source: ソース種別
            gps_latitude: GPS緯度
            gps_longitude: GPS経度

        Returns:
            作成された Image オブジェクト
        """
        image = Image(
            inspection_id=inspection_id,
            file_path=file_path,
            video_id=video_id,
            frame_index=frame_index,
            width=width,
            height=height,
            source=source,
            gps_latitude=gps_latitude,
            gps_longitude=gps_longitude,
            uploaded_at=datetime.utcnow()
        )
        self.db.add(image)
        await self.db.commit()
        await self.db.refresh(image)
        return image

    async def create_detected_object(
        self,
        image_id: int,
        class_name: str,
        confidence: float,
        bounding_box: dict
    ) -> DetectedObject:
        """
        検出オブジェクトレコードを作成します

        Args:
            image_id: 関連する画像ID
            class_name: クラス名
            confidence: 信頼度
            bounding_box: バウンディングボックス座標

        Returns:
            作成された DetectedObject オブジェクト
        """
        detected_object = DetectedObject(
            image_id=image_id,
            class_name=class_name,
            confidence=confidence,
            bounding_box=bounding_box,
            created_at=datetime.utcnow()
        )
        self.db.add(detected_object)
        await self.db.commit()
        await self.db.refresh(detected_object)
        return detected_object

    async def create_job(
        self,
        inspection_id: int,
        job_type: str,
        payload: Optional[dict] = None
    ) -> Job:
        """
        ジョブレコードを作成します

        Args:
            inspection_id: 関連する検査ID
            job_type: ジョブタイプ
            payload: ペイロード

        Returns:
            作成された Job オブジェクト
        """
        job = Job(
            inspection_id=inspection_id,
            type=job_type,
            status="queued",
            payload=payload,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def get_inspections(
        self,
        road_id: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Inspection]:
        """
        検査のリストを取得します

        Args:
            road_id: 道路IDでフィルタ
            status: ステータスでフィルタ
            limit: 取得件数
            offset: オフセット

        Returns:
            Inspection オブジェクトのリスト
        """
        query = select(Inspection)

        if road_id is not None:
            query = query.where(Inspection.road_id == road_id)

        if status is not None:
            query = query.where(Inspection.status == status)

        query = query.limit(limit).offset(offset).order_by(Inspection.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())
