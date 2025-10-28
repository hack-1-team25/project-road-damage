# Road Damage Detection API and Database Design

## Overview
このシステムは、画像単位でデータを管理する道路損傷検出システムです。動画とGPS CSVを同時にアップロードし、指定間隔でフレームを抽出して危険箇所を分析します。

## Database Schema (PostgreSQL + PostGIS)

### Tables

#### 1. images
各画像の情報を保存します。道路には紐づけません。

```sql
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_type VARCHAR(20) NOT NULL,
    storage_path TEXT NOT NULL,
    processed_image_path TEXT,
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    gps_location GEOMETRY(Point, 4326),
    extracted_at TIMESTAMP,
    capture_timestamp TIMESTAMP,
    frame_index INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_images_video ON images(video_id);
CREATE INDEX idx_images_location ON images USING GIST(gps_location);
CREATE INDEX idx_images_status ON images(status);
```

#### 2. danger_spots
危険と判断された位置情報を画像単位で保存します。

```sql
CREATE TABLE danger_spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    danger_score DOUBLE PRECISION NOT NULL,
    damage_class VARCHAR(50),
    confidence DOUBLE PRECISION,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_danger_spots_image ON danger_spots(image_id);
CREATE INDEX idx_danger_spots_location ON danger_spots USING GIST(location);
CREATE INDEX idx_danger_spots_score ON danger_spots(danger_score);
```

#### 3. detected_objects
YOLOで検出されたオブジェクトを保存します。

```sql
CREATE TABLE detected_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    class VARCHAR(100) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    bbox_x DOUBLE PRECISION NOT NULL,
    bbox_y DOUBLE PRECISION NOT NULL,
    bbox_width DOUBLE PRECISION NOT NULL,
    bbox_height DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_detected_objects_image ON detected_objects(image_id);
CREATE INDEX idx_detected_objects_class ON detected_objects(class);
```

#### 4. analysis_results
各画像の分析結果を保存します。

```sql
CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    damage_score INTEGER NOT NULL,
    primary_damage_class VARCHAR(50),
    primary_confidence DOUBLE PRECISION,
    object_count INTEGER DEFAULT 0,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_results_image ON analysis_results(image_id);
CREATE INDEX idx_analysis_results_score ON analysis_results(damage_score);
```

#### 5. videos
アップロードされた動画の情報を保存します。

```sql
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    storage_type VARCHAR(20) NOT NULL,
    storage_path TEXT NOT NULL,
    duration_seconds DOUBLE PRECISION,
    frame_rate DOUBLE PRECISION,
    frame_interval INTEGER DEFAULT 60,
    total_frames INTEGER,
    extracted_frames INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    gps_log_path TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_uploaded_by ON videos(uploaded_by);
```

#### 6. jobs
バックグラウンド処理のジョブ管理をします。

```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress DOUBLE PRECISION DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_entity ON jobs(entity_id);
CREATE INDEX idx_jobs_status ON jobs(status);
```

#### 7. users
ユーザー管理テーブルです。

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

---

## API Endpoints

### Authentication

#### POST /api/v1/auth/register
新しいユーザーを登録します。

**Request:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "created_at": "timestamp"
}
```

#### POST /api/v1/auth/login
ログインしてトークンを取得します。

**Request:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### Images

#### POST /api/v1/images
単一の画像をアップロードします。

**Request (multipart/form-data):**
- `file`: 画像ファイル (JPEG/PNG)
- `gps_latitude`: (optional) 緯度 - 指定しない場合はEXIFから自動抽出
- `gps_longitude`: (optional) 経度 - 指定しない場合はEXIFから自動抽出
- `capture_timestamp`: (optional) 撮影日時 (ISO 8601形式) - 指定しない場合はEXIFから自動抽出

**Processing:**
1. 画像をストレージに保存
2. EXIFデータからGPS座標とタイムスタンプを抽出（未指定の場合）
3. 画像を最大1024pxにリサイズ
4. Roboflow YOLO APIで物体検出
5. 検出結果から危険度スコアを計算（0-5のスケール）
6. 最も信頼度の高い損傷クラスを特定
7. 注釈付き画像を生成（赤いバウンディングボックス + ラベル）
8. データベースに保存

**Response:**
```json
{
  "id": "uuid",
  "filename": "string",
  "storage_path": "string",
  "gps_latitude": 35.7089,
  "gps_longitude": 139.7319,
  "status": "uploaded",
  "created_at": "timestamp"
}
```

#### GET /api/v1/images/{image_id}
画像の詳細情報を取得します。

**Response:**
```json
{
  "id": "uuid",
  "filename": "string",
  "storage_path": "string",
  "processed_image_path": "string",
  "gps_latitude": 35.7089,
  "gps_longitude": 139.7319,
  "status": "analyzed",
  "analysis_result": {
    "damage_score": 3,
    "primary_damage_class": "D44",
    "primary_confidence": 0.85,
    "object_count": 2
  },
  "detected_objects": [
    {
      "class": "D44",
      "confidence": 0.85,
      "bbox": {"x": 100, "y": 200, "width": 150, "height": 200}
    }
  ],
  "created_at": "timestamp"
}
```

### Videos

#### POST /api/v1/videos
動画とGPS CSVを同時にアップロードして処理します。

**Request (multipart/form-data):**
- `video_file`: 動画ファイル (MP4/MOV/AVI)
- `gps_log_file`: **必須** GPS位置情報CSVファイル
- `frame_interval`: (optional) フレーム抽出間隔（秒）、デフォルト60秒

**GPS CSV Format:**
CSVファイルは以下の形式である必要があります:
```csv
header1,header2,header3,latitude,longitude
value1,value2,value3,35.708900,139.731900
value1,value2,value3,35.709100,139.732100
```

- **1行目**: ヘッダー行（スキップされます）
- **2行目以降**: データ行
- **カラム0**: タイムスタンプ (ISO 8601形式推奨)
- **カラム3**: 緯度 (latitude)
- **カラム4**: 経度 (longitude)

**Processing Flow:**
1. 動画ファイルとGPS CSVをストレージに保存
2. バックグラウンドジョブを作成してキューに追加
3. Celeryワーカーが以下を実行:
   - GPS CSVをパース（ヘッダー行をスキップ、カラム0,3,4を使用）
   - GPSデータをタイムスタンプ順にソート
   - 動画から指定間隔（デフォルト60秒）でフレームを抽出
   - 各フレームのタイムスタンプを計算（`frame_index * interval`）
   - 動画開始時刻を最初のGPSタイムスタンプとして、最も近いGPS座標をマッピング
   - 各フレームを最大1024pxにリサイズしてJPEG変換（quality=0.95）
   - Roboflow YOLO APIで各フレームを分析
   - 検出結果から危険度スコア計算（0-5）
   - 注釈付き画像を生成（赤いバウンディングボックス + ラベル）
   - データベースに保存（images, detected_objects, analysis_results, danger_spots）
4. ジョブの進捗状況を更新

**Response:**
```json
{
  "id": "uuid",
  "filename": "string",
  "storage_path": "string",
  "frame_interval": 60,
  "status": "processing",
  "job_id": "uuid",
  "created_at": "timestamp"
}
```

#### GET /api/v1/videos/{video_id}
動画の詳細情報と処理状況を取得します。

**Response:**
```json
{
  "id": "uuid",
  "filename": "string",
  "duration_seconds": 300,
  "frame_rate": 30,
  "frame_interval": 60,
  "total_frames": 5,
  "extracted_frames": 5,
  "status": "completed",
  "gps_log_path": "storage/gps/xxxxx.csv",
  "images": [
    {
      "id": "uuid",
      "frame_index": 0,
      "extracted_at": "timestamp",
      "gps_latitude": 35.7089,
      "gps_longitude": 139.7319,
      "damage_score": 3,
      "primary_damage_class": "D44",
      "confidence": 0.85
    }
  ],
  "created_at": "timestamp"
}
```

### Danger Spots

#### GET /api/v1/danger-spots
危険箇所をクエリします。

**Query Parameters:**
- `min_lat`: 最小緯度
- `max_lat`: 最大緯度
- `min_lng`: 最小経度
- `max_lng`: 最大経度
- `min_score`: 最小危険度スコア (0-5)
- `damage_class`: (optional) 損傷クラスでフィルタ (例: "D44")
- `limit`: 最大件数（デフォルト100）
- `offset`: ページネーションオフセット（デフォルト0）

**Response:**
```json
{
  "spots": [
    {
      "id": "uuid",
      "latitude": 35.7089,
      "longitude": 139.7319,
      "danger_score": 4.5,
      "damage_class": "D44",
      "confidence": 0.85,
      "image_id": "uuid",
      "image": {
        "filename": "frame-0.jpg",
        "processed_image_path": "storage/processed/xxxxx.jpg",
        "capture_timestamp": "2024-01-01T10:00:00Z"
      },
      "detected_at": "timestamp"
    }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

#### GET /api/v1/danger-spots/heatmap
危険箇所のヒートマップデータを取得します。

**Query Parameters:**
- `min_lat`, `max_lat`, `min_lng`, `max_lng`: バウンディングボックス
- `grid_size`: (optional) グリッドサイズ（デフォルト0.001度）

**Response:**
```json
{
  "points": [
    {
      "latitude": 35.7089,
      "longitude": 139.7319,
      "intensity": 4.5,
      "count": 3
    }
  ],
  "grid_size": 0.001
}
```

### Jobs

#### GET /api/v1/jobs/{job_id}
ジョブの進捗状況を取得します。

**Response:**
```json
{
  "id": "uuid",
  "job_type": "video_processing",
  "entity_id": "uuid",
  "status": "processing",
  "progress": 60.0,
  "current_step": "analyzing_frame_3",
  "total_steps": 5,
  "started_at": "timestamp",
  "created_at": "timestamp"
}
```

**Status Values:**
- `pending`: キューで待機中
- `processing`: 処理中
- `completed`: 完了
- `failed`: エラー発生

### Statistics

#### GET /api/v1/statistics
全体の統計情報を取得します。

**Query Parameters:**
- `start_date`: (optional) 集計開始日 (ISO 8601形式)
- `end_date`: (optional) 集計終了日 (ISO 8601形式)

**Response:**
```json
{
  "total_images": 1234,
  "total_videos": 56,
  "total_danger_spots": 789,
  "damage_distribution": {
    "no_damage": 500,
    "minor_damage": 300,
    "moderate_damage": 200,
    "severe_damage": 234
  },
  "damage_class_distribution": {
    "D44": 150,
    "D40": 120,
    "D20": 80
  },
  "average_confidence": 0.82,
  "last_updated": "timestamp"
}
```

---

## Processing Flow Details

### 動画 + GPS CSV処理フロー

#### 1. アップロードフェーズ
```
Client → POST /api/v1/videos (video + CSV)
  ↓
FastAPI: ファイル検証・保存
  ↓
DB: videos, jobs レコード作成
  ↓
Celery: ジョブをキューに追加
  ↓
Client ← Response: {video_id, job_id, status: "processing"}
```

#### 2. バックグラウンド処理フェーズ (Celery Worker)
```
Celery Worker起動
  ↓
[GPS CSV解析]
  - CSVファイル読み込み
  - ヘッダー行スキップ
  - 各行をパース: [timestamp, _, _, latitude, longitude]
  - タイムスタンプ順にソート
  - メモリに保持
  ↓
[動画メタデータ取得]
  - ffprobeで動画情報取得
  - duration, frame_rate を取得
  - total_frames = duration / frame_interval を計算
  ↓
[フレーム抽出ループ]
  For each interval (0s, 60s, 120s, ...):
    1. ffmpegでフレーム抽出
    2. frame_timestamp = frame_index * interval (ミリ秒)
    3. GPS座標マッピング:
       - video_start_time = gps_data[0].timestamp
       - target_time = video_start_time + frame_timestamp
       - 最も近いGPSポイントを検索
    4. 画像リサイズ (max 1024px)
    5. ストレージに保存
    6. DB: images レコード作成
  ↓
[YOLO分析ループ]
  For each extracted frame:
    1. Roboflow API呼び出し
       - POST https://detect.roboflow.com/road-damages-detection/1
       - FormData: image (JPEG, quality=0.95)
    2. レスポンス解析: {predictions: [{class, confidence, x, y, width, height}]}
    3. 最高信頼度の予測を特定
    4. danger_score計算: round(max_confidence * 5)
    5. 注釈画像生成:
       - Canvas上に元画像描画
       - 赤いバウンディングボックス描画 (lineWidth=2, strokeStyle="red")
       - ラベルテキスト描画 (class + confidence%)
    6. 注釈画像を保存
    7. DB更新:
       - detected_objects: 全予測結果を保存
       - analysis_results: 集計データを保存
       - danger_spots: スコア > 0 の場合に作成
    8. jobs.progress更新
  ↓
[完了]
  - videos.status = "completed"
  - jobs.status = "completed", progress = 100
```

#### 3. GPS座標マッピングアルゴリズム
```python
def find_closest_gps_point(frame_timestamp_ms: int, gps_data: List[GPSData]) -> GPSData:
    """
    動画フレームのタイムスタンプから最も近いGPSポイントを検索
    
    Args:
        frame_timestamp_ms: フレームのタイムスタンプ（動画開始からのミリ秒）
        gps_data: タイムスタンプ順にソート済みのGPSデータ
    
    Returns:
        最も時刻が近いGPSポイント
    """
    # 動画開始時刻 = 最初のGPSデータの時刻
    video_start_time = parse_timestamp(gps_data[0].timestamp)
    
    # フレームの実時刻
    target_time = video_start_time + timedelta(milliseconds=frame_timestamp_ms)
    
    # 最も近いポイントを線形探索
    closest = min(
        gps_data,
        key=lambda gps: abs(parse_timestamp(gps.timestamp) - target_time)
    )
    
    return closest
```

### 画像処理フロー

#### 1. EXIF GPS抽出
```
Image Upload → EXIF読み取り
  ↓
GPSLatitude, GPSLongitude, GPSLatitudeRef, GPSLongitudeRef取得
  ↓
DMS (度分秒) → DD (10進数) 変換:
  DD = degrees + minutes/60 + seconds/3600
  if direction == 'S' or 'W': DD = -DD
```

#### 2. YOLO分析・注釈生成
```
画像リサイズ (max 1024px)
  ↓
Roboflow API呼び出し
  ↓
予測結果受信: [{class, confidence, x, y, width, height}]
  ↓
Canvas生成:
  1. drawImage(原画像)
  2. For each prediction:
     - strokeRect(x, y, width, height) # 赤枠
     - fillText(class + confidence) # ラベル
  ↓
Canvas → JPEG Blob (quality=0.95)
  ↓
保存
```

---

## Roboflow API Integration

### Endpoint
```
POST https://detect.roboflow.com/{model_id}?api_key={key}&format=json
```

### Model
- **Model ID**: `road-damages-detection/1`
- **API Key**: `Jg5nNY2yVf0uOReHR3C7` (環境変数で管理)

### Request
```
Content-Type: multipart/form-data

Body:
  - file: image (JPEG/PNG, max 1024px)
```

### Response
```json
{
  "predictions": [
    {
      "x": 512.5,
      "y": 384.2,
      "width": 150.0,
      "height": 200.0,
      "class": "D44",
      "confidence": 0.85,
      "class_id": 2
    }
  ],
  "image": {
    "width": 1024,
    "height": 768
  }
}
```

### Damage Classes
- `D00`: 縦ひび割れ (Longitudinal Crack)
- `D10`: 横ひび割れ (Transverse Crack)
- `D20`: 亀甲状ひび割れ (Alligator Crack)
- `D40`: ポットホール (Pothole)
- `D44`: 路面補修跡 (Repair)

### Damage Score Calculation
```python
def calculate_damage_score(predictions: List[Prediction]) -> int:
    """
    YOLO予測結果から危険度スコアを計算
    
    Returns:
        0: 損傷なし
        1-2: 軽微な損傷 (Minor)
        3-4: 中程度の損傷 (Moderate)
        5: 深刻な損傷 (Severe)
    """
    if not predictions:
        return 0
    
    max_confidence = max(p.confidence for p in predictions)
    score = min(5, max(0, round(max_confidence * 5)))
    
    return score
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/road_damage_db
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

# Storage
STORAGE_TYPE=local  # "local" or "s3"
LOCAL_STORAGE_PATH=/app/storage
S3_BUCKET_NAME=
S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Roboflow API
ROBOFLOW_API_KEY=Jg5nNY2yVf0uOReHR3C7
ROBOFLOW_MODEL_ID=road-damages-detection/1
ROBOFLOW_API_URL=https://detect.roboflow.com

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CELERY_WORKER_CONCURRENCY=4

# JWT
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60

# File Upload
MAX_FILE_SIZE_MB=500
ALLOWED_IMAGE_TYPES=image/jpeg,image/png
ALLOWED_VIDEO_TYPES=video/mp4,video/quicktime,video/x-msvideo
ALLOWED_CSV_TYPES=text/csv,application/vnd.ms-excel

# Processing
DEFAULT_FRAME_INTERVAL_SECONDS=60
IMAGE_RESIZE_MAX_DIMENSION=1024
JPEG_QUALITY=0.95
VIDEO_PROCESSING_TIMEOUT_MINUTES=30

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "detail": "Invalid GPS CSV format. Expected columns: timestamp, _, _, latitude, longitude"
}
```

#### 404 Not Found
```json
{
  "detail": "Video with id 'xxxxx' not found"
}
```

#### 413 Payload Too Large
```json
{
  "detail": "File size exceeds maximum allowed size of 500MB"
}
```

#### 422 Unprocessable Entity
```json
{
  "detail": [
    {
      "loc": ["body", "gps_log_file"],
      "msg": "GPS CSV file is required for video upload",
      "type": "value_error.missing"
    }
  ]
}
```

#### 500 Internal Server Error
```json
{
  "detail": "Roboflow API error: Connection timeout"
}
```

---

## Performance Considerations

### Image Processing
- **Resize**: 最大1024pxにリサイズして転送量削減
- **Format**: JPEG (quality=0.95) で圧縮
- **Caching**: 処理済み画像はストレージに保存し再利用

### Video Processing
- **Background Jobs**: Celeryで非同期処理
- **Batch Processing**: フレーム抽出とYOLO分析を並列化可能
- **Progress Tracking**: ジョブテーブルで進捗管理

### Database
- **Spatial Indexing**: GiST インデックスで地理的クエリを高速化
- **Partitioning**: 大量データの場合、imagesテーブルを日付でパーティション化
- **Connection Pooling**: SQLAlchemyのプール機能を活用

### API Rate Limiting
- Roboflow API: レート制限に注意（無料プランの場合）
- 必要に応じてリトライロジック実装
