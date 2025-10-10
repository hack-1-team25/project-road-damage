"""
検査サービス
検査のビジネスロジックを提供します
"""
import uuid
from typing import Optional, List, Dict
from datetime import datetime

from app.repositories.inspection_repository import InspectionRepository
from app.services.video_processing_service import VideoProcessingService


class InspectionService:
    """検査のビジネスロジックを提供するサービスクラス"""

    def __init__(
        self,
        repository: InspectionRepository,
        video_service: VideoProcessingService
    ):
        """
        Args:
            repository: InspectionRepository インスタンス
            video_service: VideoProcessingService インスタンス
        """
        self.repository = repository
        self.video_service = video_service

    async def create_inspection_from_video(
        self,
        file_content: bytes,
        filename: str,
        gps_data: List[Dict],
        road_id: Optional[int] = None,
        frame_interval: int = 1000,
        frame_rate: Optional[float] = None
    ) -> dict:
        """
        動画から検査を作成します

        Args:
            file_content: 動画ファイルのバイトデータ
            filename: ファイル名
            gps_data: GPS位置情報のリスト（timestamp, latitude, longitudeを含む）
            road_id: 道路ID
            frame_interval: フレーム抽出間隔（ミリ秒）
            frame_rate: フレームレート上書き

        Returns:
            作成された検査情報を含む辞書
        """
        # GPS データから代表位置を計算（最初のGPSポイントを使用）
        latitude = gps_data[0]['latitude'] if gps_data else None
        longitude = gps_data[0]['longitude'] if gps_data else None
        
        # 1. 検査レコードを作成
        inspection = await self.repository.create_inspection(
            road_id=road_id,
            latitude=latitude,
            longitude=longitude,
            status="processing"
        )

        # 2. 動画を保存
        video_path = await self.video_service.save_video(file_content, filename)

        # 3. 動画レコードを作成（一時的にduration_msとframe_rateはNone）
        video = await self.repository.create_video(
            inspection_id=inspection.id,
            file_path=video_path,
            duration_ms=None,
            frame_rate=frame_rate
        )

        # 4. ジョブを作成
        job_id = str(uuid.uuid4())
        job = await self.repository.create_job(
            inspection_id=inspection.id,
            job_type="video_processing",
            payload={
                "video_id": video.id,
                "video_path": video_path,
                "frame_interval": frame_interval,
                "job_id": job_id,
                "gps_data": gps_data
            }
        )

        # 5. 非同期処理を開始（実際にはバックグラウンドタスクやワーカーで実行）
        # ここでは簡易的に同期的に処理を実行
        # 本番環境ではCeleryやrq等のタスクキューを使用することを推奨
        try:
            await self._process_video_job(
                inspection_id=inspection.id,
                video_id=video.id,
                video_path=video_path,
                frame_interval=frame_interval,
                gps_data=gps_data
            )
        except Exception as e:
            # エラーが発生した場合はステータスを更新
            await self.repository.update_inspection_status(
                inspection.id,
                "failed"
            )
            raise

        return {
            "inspection_id": inspection.id,
            "video_id": video.id,
            "job_id": job_id,
            "status": "processing",
            "message": f"Video uploaded and processing started. Check job status with /api/v1/jobs/{job_id}."
        }

    async def _process_video_job(
        self,
        inspection_id: int,
        video_id: int,
        video_path: str,
        frame_interval: int,
        gps_data: List[Dict]
    ):
        """
        動画処理ジョブを実行します（内部メソッド）

        Args:
            inspection_id: 検査ID
            video_id: 動画ID
            video_path: 動画パス
            frame_interval: フレーム抽出間隔
            gps_data: GPS位置情報のリスト
        """
        # フレーム抽出と推論を実行（GPS位置付き）
        frame_results, duration_ms, fps = await self.video_service.process_video_frames_with_gps(
            video_path=video_path,
            gps_data=gps_data,
            frame_interval_ms=frame_interval
        )

        # 動画情報を更新（duration_msとfpsを設定）
        # 注: 既存のVideoレコードを更新するメソッドが必要ですが、簡易的にスキップ

        # 各フレームをデータベースに保存
        total_damage_score = 0.0
        frame_count = 0

        for frame_result in frame_results:
            # 画像レコードを作成（GPS情報を含む）
            image = await self.repository.create_image(
                inspection_id=inspection_id,
                file_path=frame_result["frame_path"],
                video_id=video_id,
                frame_index=frame_result["frame_index"],
                gps_latitude=frame_result.get("latitude"),
                gps_longitude=frame_result.get("longitude"),
                width=frame_result.get("width"),
                height=frame_result.get("height"),
                source="video_frame"
            )

            # 検出オブジェクトを保存
            predictions = frame_result.get("predictions", [])
            for pred in predictions:
                await self.repository.create_detected_object(
                    image_id=image.id,
                    class_name=pred.get("class", "unknown"),
                    confidence=pred.get("confidence", 0.0),
                    bounding_box={
                        "x": pred.get("x", 0),
                        "y": pred.get("y", 0),
                        "width": pred.get("width", 0),
                        "height": pred.get("height", 0)
                    }
                )

            # 損傷スコアを集計
            damage_score = frame_result.get("damage_score", 0.0)
            total_damage_score += damage_score
            frame_count += 1

        # 平均スコアを計算
        avg_score = total_damage_score / frame_count if frame_count > 0 else 0.0

        # 検査ステータスを完了に更新
        await self.repository.update_inspection_status(
            inspection_id=inspection_id,
            status="completed",
            aggregate_score=avg_score
        )

        # 分析結果を保存（オプション）
        # analysis_result = await self.repository.create_analysis_result(...)
