"""
動画処理サービス
動画からのフレーム抽出とYOLO推論を行います
"""
import os
import cv2
import tempfile
import aiofiles
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import httpx


class VideoProcessingService:
    """動画処理とYOLO推論を提供するサービスクラス"""

    def __init__(self, storage_path: str = "/tmp/videos", roboflow_api_key: Optional[str] = None):
        """
        Args:
            storage_path: 動画・画像の保存先ディレクトリ
            roboflow_api_key: Roboflow APIキー
        """
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # Roboflow API設定（環境変数から取得、必須）
        self.roboflow_api_key = roboflow_api_key or os.getenv("ROBOFLOW_API_KEY")
        if not self.roboflow_api_key:
            raise ValueError("Roboflow API key must be provided via argument or ROBOFLOW_API_KEY environment variable.")
        self.roboflow_api_url = "https://detect.roboflow.com"
        self.roboflow_model_id = "road-damages-detection/1"

    async def save_video(self, file_content: bytes, filename: str) -> str:
        """
        動画ファイルを保存します

        Args:
            file_content: 動画ファイルのバイトデータ
            filename: ファイル名

        Returns:
            保存されたファイルのパス
        """
        file_path = self.storage_path / filename
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)
        return str(file_path)

    def extract_frames(
        self,
        video_path: str,
        frame_interval_ms: int = 1000
    ) -> Tuple[List[str], int, float]:
        """
        動画からフレームを抽出します（同期処理）

        Args:
            video_path: 動画ファイルのパス
            frame_interval_ms: フレーム抽出間隔（ミリ秒）

        Returns:
            (フレーム画像パスのリスト, 動画長(ms), フレームレート)
        """
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_ms = int((total_frames / fps) * 1000) if fps > 0 else 0
        
        frame_paths = []
        frame_index = 0
        current_time_ms = 0
        
        # フレームを指定間隔で抽出
        while True:
            # 指定時刻にシーク
            cap.set(cv2.CAP_PROP_POS_MSEC, current_time_ms)
            ret, frame = cap.read()
            
            if not ret:
                break
            
            # フレームを保存
            frame_filename = f"frame_{frame_index:06d}.jpg"
            frame_path = self.storage_path / frame_filename
            cv2.imwrite(str(frame_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            frame_paths.append(str(frame_path))
            
            frame_index += 1
            current_time_ms += frame_interval_ms
            
            if current_time_ms > duration_ms:
                break
        
        cap.release()
        return frame_paths, duration_ms, fps

    async def infer_yolo(self, image_path: str) -> Dict:
        """
        YOLOモデルで画像を推論します

        Args:
            image_path: 画像ファイルのパス

        Returns:
            推論結果（predictions, image_width, image_heightを含む辞書）
        """
        # 画像のサイズを取得
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Cannot read image: {image_path}")
        
        height, width = img.shape[:2]
        
        # Roboflow APIにリクエスト
        url = f"{self.roboflow_api_url}/{self.roboflow_model_id}"
        params = {
            "api_key": self.roboflow_api_key,
            "format": "json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            with open(image_path, 'rb') as f:
                files = {'file': f}
                response = await client.post(url, params=params, files=files)
        
        if response.status_code != 200:
            print(f"Roboflow API error: {response.status_code} - {response.text}")
            return {
                "predictions": [],
                "image_width": width,
                "image_height": height
            }
        
        data = response.json()
        
        return {
            "predictions": data.get("predictions", []),
            "image_width": width,
            "image_height": height
        }

    def calculate_damage_score(self, predictions: List[Dict]) -> float:
        """
        予測結果から損傷スコアを計算します

        Args:
            predictions: YOLO予測結果のリスト

        Returns:
            損傷スコア（0.0-5.0）
        """
        if not predictions:
            return 0.0
        
        # 最も信頼度の高い予測を取得
        highest_prediction = max(predictions, key=lambda p: p.get("confidence", 0))
        confidence = highest_prediction.get("confidence", 0)
        
        # 信頼度を0-5のスケールに変換
        damage_score = min(5.0, max(0.0, confidence * 5))
        return round(damage_score, 2)

    async def process_video_frames(
        self,
        video_path: str,
        frame_interval_ms: int = 1000
    ) -> Tuple[List[Dict], int, float]:
        """
        動画を処理してフレームを抽出し、各フレームをYOLOで推論します

        Args:
            video_path: 動画ファイルのパス
            frame_interval_ms: フレーム抽出間隔（ミリ秒）

        Returns:
            (フレーム処理結果のリスト, 動画長(ms), フレームレート)
            各フレーム処理結果は以下を含む:
            - frame_path: フレーム画像のパス
            - frame_index: フレーム番号
            - predictions: YOLO予測結果
            - damage_score: 損傷スコア
            - width: 画像幅
            - height: 画像高
        """
        # フレーム抽出
        frame_paths, duration_ms, fps = self.extract_frames(video_path, frame_interval_ms)
        
        # 各フレームを推論
        results = []
        for idx, frame_path in enumerate(frame_paths):
            try:
                inference_result = await self.infer_yolo(frame_path)
                predictions = inference_result.get("predictions", [])
                damage_score = self.calculate_damage_score(predictions)
                
                results.append({
                    "frame_path": frame_path,
                    "frame_index": idx,
                    "predictions": predictions,
                    "damage_score": damage_score,
                    "width": inference_result.get("image_width"),
                    "height": inference_result.get("image_height")
                })
            except Exception as e:
                print(f"Error processing frame {idx}: {str(e)}")
                # エラーが発生してもスキップして続行
                results.append({
                    "frame_path": frame_path,
                    "frame_index": idx,
                    "predictions": [],
                    "damage_score": 0.0,
                    "width": None,
                    "height": None,
                    "error": str(e)
                })
        
        return results, duration_ms, fps
