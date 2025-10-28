# Video Processing API - 使用方法

このAPIは動画とGPS CSVファイルを受け取り、10秒間隔でフレームを抽出してYOLO分析を行い、結果をデータベースに保存します。

## セットアップ

### 1. 環境変数の設定

```bash
cp .env.example .env
# .env ファイルを編集して必要な設定を追加
```

### 2. データベースのマイグレーション

```bash
# PostgreSQLコンテナに接続
docker exec -it <postgres_container> psql -U user -d road_damage_db

# マイグレーションを実行
\i /app/migrations/001_init_schema.sql
```

### 3. 依存関係のインストール

```bash
pip install -r requirements.txt
```

### 4. サーバーの起動

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API使用方法

### 動画のアップロード

```bash
curl -X POST "http://localhost:8000/api/v1/videos" \
  -F "video_file=@your_video.mp4" \
  -F "gps_log_file=@gps_log.csv" \
  -F "frame_interval=10"
```

**レスポンス例:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "your_video.mp4",
  "storage_path": "./storage/videos/550e8400_your_video.mp4",
  "frame_interval": 10,
  "status": "uploaded",
  "job_id": "660e8400-e29b-41d4-a716-446655440001",
  "extracted_frames": 0,
  "created_at": "2024-10-28T10:00:00Z"
}
```

### GPS CSV ファイルの形式

```csv
timestamp,column2,column3,latitude,longitude
2024-10-28T10:00:00Z,data,data,35.708900,139.731900
2024-10-28T10:00:01Z,data,data,35.709000,139.732000
```

- **1行目**: ヘッダー行(スキップされます)
- **2行目以降**: データ行
- **カラム0**: タイムスタンプ (ISO 8601形式推奨)
- **カラム3**: 緯度 (latitude)
- **カラム4**: 経度 (longitude)

### 処理状況の確認

```bash
curl "http://localhost:8000/api/v1/videos/{video_id}"
```

**レスポンス例:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "your_video.mp4",
  "storage_path": "./storage/videos/550e8400_your_video.mp4",
  "frame_interval": 10,
  "status": "completed",
  "duration_seconds": 120.5,
  "frame_rate": 30.0,
  "total_frames": 12,
  "extracted_frames": 12,
  "created_at": "2024-10-28T10:00:00Z",
  "images": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "filename": "frame_0000.jpg",
      "frame_index": 0,
      "extracted_at": "2024-10-28T10:00:05Z",
      "gps_latitude": 35.708900,
      "gps_longitude": 139.731900,
      "damage_score": 3,
      "primary_damage_class": "D44",
      "confidence": 0.85
    }
  ]
}
```

## 処理フロー

1. **アップロード**: 動画とGPS CSVファイルを受信
2. **GPS解析**: CSVファイルをパースしてタイムスタンプ順にソート
3. **フレーム抽出**: 指定間隔(デフォルト10秒)でフレームを抽出
4. **GPS マッピング**: 各フレームに最も近いGPS座標を割り当て
5. **YOLO分析**: Roboflow APIで各フレームを分析
6. **スコア計算**: 危険度スコア(0-5)を計算
7. **注釈画像生成**: バウンディングボックスとラベル付き画像を作成
8. **データベース保存**: 
   - `images`: 画像情報
   - `detected_objects`: 検出されたオブジェクト
   - `analysis_results`: 分析結果
   - `danger_spots`: 危険箇所(スコア > 0)

## データベーステーブル

- `videos`: 動画メタ情報
- `images`: 抽出された画像
- `detected_objects`: YOLO検出オブジェクト
- `analysis_results`: 画像分析結果
- `danger_spots`: 危険箇所(地図表示用)
- `jobs`: バックグラウンド処理ジョブ

## 環境変数

主要な環境変数:

- `ROBOFLOW_API_KEY`: Roboflow APIキー
- `DEFAULT_FRAME_INTERVAL_SECONDS`: デフォルトフレーム抽出間隔(秒)
- `DATABASE_URL`: PostgreSQL接続URL
- `LOCAL_STORAGE_PATH`: ローカルストレージパス

詳細は `.env.example` を参照してください。

## トラブルシューティング

### ffmpegがインストールされていない

```bash
# Ubuntu/Debian
apt-get update && apt-get install -y ffmpeg

# macOS
brew install ffmpeg
```

### PostgreSQLにPostGIS拡張がない

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### メモリ不足エラー

動画ファイルサイズや処理間隔を調整してください。
