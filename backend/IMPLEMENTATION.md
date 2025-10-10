# POST /api/v1/inspections エンドポイント実装

このドキュメントは、`POST /api/v1/inspections` エンドポイントの実装について説明します。

## 実装概要

動画ファイルをアップロードし、フレーム抽出とYOLO推論を行い、検査結果をデータベースに保存するエンドポイントです。

## アーキテクチャ

実装は以下の層で構成されています:

```
routes/inspections.py (API層)
    ↓
services/inspection_service.py (ビジネスロジック層)
    ↓
repositories/inspection_repository.py (データアクセス層)
    ↓
models.py (データモデル層)
```

### 動画処理フロー

```
services/video_processing_service.py
    ↓
1. 動画をストレージに保存
    ↓
2. OpenCVでフレーム抽出（指定間隔）
    ↓
3. 各フレームをRoboflow YOLO APIで推論
    ↓
4. 検出結果と損傷スコアをDBに保存
```

## 実装ファイル

### 1. スキーマ定義
- **ファイル:** `backend/app/schemas/inspection.py`
- **内容:** リクエスト・レスポンスのPydanticモデル
  - `InspectionCreateRequest`: リクエストパラメータ
  - `InspectionCreateResponse`: 202 Acceptedレスポンス
  - `InspectionDetailResponse`: 検査詳細レスポンス

### 2. リポジトリ層
- **ファイル:** `backend/app/repositories/inspection_repository.py`
- **内容:** データベースアクセスロジック
  - `create_inspection()`: 検査レコード作成
  - `create_video()`: 動画レコード作成
  - `create_image()`: 画像（フレーム）レコード作成
  - `create_detected_object()`: 検出オブジェクト作成
  - `create_job()`: ジョブレコード作成
  - `update_inspection_status()`: 検査ステータス更新

### 3. 動画処理サービス
- **ファイル:** `backend/app/services/video_processing_service.py`
- **内容:** 動画処理とYOLO推論ロジック
  - `save_video()`: 動画ファイルの保存
  - `extract_frames()`: OpenCVでフレーム抽出
  - `infer_yolo()`: Roboflow APIで推論
  - `calculate_damage_score()`: 損傷スコア計算
  - `process_video_frames()`: 統合処理（フレーム抽出→推論）

### 4. 検査サービス
- **ファイル:** `backend/app/services/inspection_service.py`
- **内容:** 検査のビジネスロジック
  - `create_inspection_from_video()`: 動画から検査を作成
  - `_process_video_job()`: 動画処理ジョブの実行（内部メソッド）

### 5. APIエンドポイント
- **ファイル:** `backend/app/routes/inspections.py`
- **内容:** FastAPI ルーター
  - `POST /api/v1/inspections`: 検査作成エンドポイント

### 6. メインアプリケーション
- **ファイル:** `backend/app/main.py`
- **変更内容:** inspections ルーターを登録

## API仕様

### エンドポイント
```
POST /api/v1/inspections
```

### リクエスト（multipart/form-data）

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| file | File | ✓ | 動画ファイル（mp4, mov, avi, mkv） |
| latitude | float | - | 検査の代表位置（緯度） |
| longitude | float | - | 検査の代表位置（経度） |
| road_id | int | - | 関連する道路ID |
| frame_interval | int | - | フレーム抽出間隔（ミリ秒、デフォルト: 1000） |
| frame_rate | float | - | フレームレート上書き |

### レスポンス（202 Accepted）

```json
{
  "inspection_id": 123,
  "video_id": 456,
  "job_id": "uuid-of-processing-job",
  "status": "processing",
  "message": "Video uploaded and processing started. Check job status with /api/v1/jobs/{job_id}."
}
```

## 処理フロー

1. **動画アップロード受信**
   - ファイル検証（拡張子、サイズ）
   - ファイル内容の読み込み

2. **検査レコード作成**
   - `inspections` テーブルに新規レコード作成
   - ステータス: `processing`
   - 位置情報があればPostGIS POINT形式で保存

3. **動画保存**
   - ストレージ（`/tmp/videos`）に保存
   - `videos` テーブルにレコード作成

4. **ジョブ作成**
   - `jobs` テーブルにレコード作成
   - ジョブタイプ: `video_processing`

5. **動画処理実行**
   - OpenCVでフレーム抽出（指定間隔）
   - 各フレームを画像として保存
   - Roboflow YOLO APIで推論
   - 検出結果をDBに保存:
     - `images` テーブル: フレーム情報
     - `detected_objects` テーブル: 検出オブジェクト

6. **集約処理**
   - 全フレームの損傷スコアを平均
   - `inspections` テーブルの `aggregate_score` を更新
   - ステータスを `completed` に更新

## 依存パッケージ

以下のパッケージを `requirements.txt` に追加しました:

```
opencv-python-headless==4.8.0.74  # 動画処理
httpx==0.24.1                      # Roboflow API呼び出し
aiofiles==23.1.0                   # 非同期ファイルIO
python-multipart==0.0.6            # multipart/form-data対応
```

## 環境変数

- `ROBOFLOW_API_KEY`: Roboflow APIキー（デフォルト: "Jg5nNY2yVf0uOReHR3C7"）

## 既存コードとの整合性

### old/src/context/DataContext.tsx との対応

- **processVideo()**: 動画処理のメインロジック
  - → `InspectionService.create_inspection_from_video()`
  
- **extractFrames()**: フレーム抽出
  - → `VideoProcessingService.extract_frames()`
  
- **processFrames()**: フレームごとの推論
  - → `VideoProcessingService.infer_yolo()`

- **getYoloPredictions()**: YOLO推論
  - → `VideoProcessingService.infer_yolo()`

### old/src/utils/yoloImageApi.ts との対応

- **processImageWithYolo()**: 画像のYOLO処理
  - → `VideoProcessingService.infer_yolo()`
  
- Roboflow API設定
  - API_URL: `https://detect.roboflow.com`
  - MODEL_ID: `road-damages-detection/1`
  - API_KEY: 環境変数から取得

## 制限事項と今後の改善

### 現在の制限

1. **同期的な処理**: 現在は動画処理を同期的に実行しています
   - 大きな動画の場合、レスポンスが遅延する可能性

2. **ストレージ**: `/tmp/videos` を使用
   - 本番環境ではS3等のオブジェクトストレージを推奨

3. **エラーハンドリング**: 基本的なエラー処理のみ実装

### 今後の改善提案

1. **非同期ワーカー導入**
   - Celery、RQ、またはFastAPI BackgroundTasksを使用
   - ジョブの状態を追跡できる `GET /api/v1/jobs/{job_id}` エンドポイント

2. **ストレージ改善**
   - S3互換ストレージへの保存
   - 署名付きURLでのアップロード

3. **進捗通知**
   - WebSocketでの進捗通知
   - ジョブの詳細な進捗状況（X/Y フレーム処理完了）

4. **パフォーマンス最適化**
   - フレーム抽出の並列化
   - バッチ推論（複数フレームを一度に推論）

5. **AHP分析**
   - `analysis_results` テーブルへのAHPスコア保存

## テスト方法

### curlでのテスト

```bash
curl -X POST "http://localhost:8000/api/v1/inspections" \
  -F "file=@/path/to/video.mp4" \
  -F "latitude=35.70" \
  -F "longitude=139.75" \
  -F "road_id=1" \
  -F "frame_interval=1000"
```

### Pythonでのテスト

```python
import httpx

async with httpx.AsyncClient() as client:
    with open("video.mp4", "rb") as f:
        files = {"file": f}
        data = {
            "latitude": 35.70,
            "longitude": 139.75,
            "road_id": 1,
            "frame_interval": 1000
        }
        response = await client.post(
            "http://localhost:8000/api/v1/inspections",
            files=files,
            data=data
        )
        print(response.json())
```

## 参考

- API設計書: `/API_and_DB_Design.md`
- 既存のフロントエンド実装: `/old/src/context/DataContext.tsx`
- YOLO処理: `/old/src/utils/yoloImageApi.ts`
