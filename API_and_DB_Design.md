# API設計とデータベース設計

このドキュメントは、既存のフロントエンドアプリケーションをリファクタリングし、Pythonバックエンド、Next.jsフロントエンド、PostgreSQLデータベースで再構築するためのAPIとデータベースの設計を定義します。

## 1. データベース設計 (PostgreSQL)

PostgreSQLの拡張機能であるPostGISを利用して地理空間データを効率的に扱います。

### 1.1. `inspections` テーブル

各検査イベントの概要を格納します。危険箇所の位置情報を保持し、UI上で表示します。

| カラム名      | 型                       | 説明                                   |
| ------------- | ------------------------ | -------------------------------------- |
| `id`          | `SERIAL PRIMARY KEY`     | 検査の一意なID                         |
| `location`    | `GEOMETRY(Point)`        | 検査地点の地理情報（ポイント形式）     |
| `status`      | `VARCHAR(50)`            | 検査のステータス (e.g., pending, processing, completed, failed) |
| `created_at`  | `TIMESTAMP WITH TIME ZONE` | 作成日時 (デフォルトは現在時刻)        |
| `updated_at`  | `TIMESTAMP WITH TIME ZONE` | 更新日時 (デフォルトは現在時刻)        |

### 1.3. `images` テーブル

アップロードされた画像を管理します。

| カラム名        | 型                       | 説明                                   |
| --------------- | ------------------------ | -------------------------------------- |
| `id`            | `SERIAL PRIMARY KEY`     | 画像の一意なID                         |
| `inspection_id` | `INTEGER`                | `inspections`テーブルへの外部キー      |
| `file_path`     | `VARCHAR(255)`           | 画像ファイルの保存先パス               |
| `uploaded_at`   | `TIMESTAMP WITH TIME ZONE` | アップロード日時 (デフォルトは現在時刻) |
| `damage_score`  | `REAL`                   | フレーム/画像単位で算出した危険度（例: 0.0-5.0） |

※ この設計はフレーム（画像）単位を表します。動画入力を受け付けるワークフローに対応するため、下記の `videos` テーブルと `images` の拡張（`frame_index`, `video_id`）を追加で定義します。

### 1.3b. `videos` テーブル (新規)

動画ファイルを管理し、サーバ側でフレーム抽出ジョブを起動する用途に使います。

| カラム名        | 型                       | 説明                                   |
| --------------- | ------------------------ | -------------------------------------- |
| `id`            | `SERIAL PRIMARY KEY`     | 動画の一意なID                         |
| `inspection_id` | `INTEGER`                | `inspections` テーブルへの外部キー     |
| `file_path`     | `VARCHAR(255)`           | 動画ファイルの保存先パス               |
| `duration_ms`   | `INTEGER`                | 動画長（ミリ秒）                       |
| `frame_rate`    | `FLOAT`                  | 元動画のフレームレート                 |
| `uploaded_at`   | `TIMESTAMP WITH TIME ZONE` | アップロード日時                        |

### 1.3（修正）: `images` テーブル拡張

既存の `images` テーブルに以下のカラムを追加することを想定します：

| 追加カラム      | 型         | 説明 |
| --------------- | ---------- | ---- |
| `video_id`      | `INTEGER`  | 元が動画由来のフレームなら `videos.id` を参照 |
| `frame_index`   | `INTEGER`  | 動画フレーム番号（動画由来の場合） |
| `width`         | `INTEGER`  | 画像幅（px） |
| `height`        | `INTEGER`  | 画像高（px） |
| `source`        | `VARCHAR(50)` | 'photo'|'video_frame' 等を表す |
| `damage_score`  | `REAL`     | フレーム/画像単位の危険度スコア（保存用） |

### 1.4. `detected_objects` テーブル

画像内でAIモデルによって検出されたオブジェクト（損傷箇所など）を格納します。

| カラム名        | 型                   | 説明                                   |
| --------------- | -------------------- | -------------------------------------- |
| `id`            | `SERIAL PRIMARY KEY` | 検出オブジェクトの一意なID             |
| `image_id`      | `INTEGER`            | `images`テーブルへの外部キー           |
| `class_name`    | `VARCHAR(100)`       | 検出されたオブジェクトのクラス名 (e.g., "crack", "pothole") |
| `confidence`    | `FLOAT`              | 検出の信頼度スコア                     |
| `bounding_box`  | `JSONB`              | 検出領域のバウンディングボックス座標 (e.g., `{"x": 10, "y": 20, "width": 50, "height": 30}`) |
| `created_at`    | `TIMESTAMP WITH TIME ZONE` | 作成日時 (デフォルトは現在時刻)        |
| `score`         | `REAL` (optional)    | 検出オブジェクト単位で付与する追加スコア（必要に応じて） |

注: `bounding_box` の座標系は保存時に明示（pixel座標 or normalized 0..1）してください。動画フレーム由来の場合はピクセル座標で保存するのが実装上扱いやすいです。

### 1.5. `analysis_results` テーブル

AHPスコアリングなどの高度な分析結果を格納します。

| カラム名        | 型                       | 説明                                   |
| --------------- | ------------------------ | -------------------------------------- |
| `id`            | `SERIAL PRIMARY KEY`     | 分析結果の一意なID                     |
| `inspection_id` | `INTEGER`                | `inspections`テーブルへの外部キー      |
| `score`         | `FLOAT`                  | 総合評価スコア                         |
| `details`       | `JSONB`                  | 分析の詳細データ                       |
| `created_at`    | `TIMESTAMP WITH TIME ZONE` | 作成日時 (デフォルトは現在時刻)        |

### 1.6. `inspections` テーブルの集約スコア（推奨追記）

検査単位の集約スコアを追加で持たせると検索やダッシュボード表示が楽になります。既に `analysis_results` に格納できますが、直近の集約値を `inspections` に保存することを推奨します。

| カラム名 | 型 | 説明 |
|---|---|---|
| `aggregate_score` | `REAL` | 検査（inspection）単位での集約危険度スコア（例: 0.0-100.0 または 0.0-5.0） |


---

## 2. APIエンドポイント設計 (Python/FastAPI)

### 2.1. 検査関連API

- **`POST /api/v1/inspections`**
  - **説明:** 新しい検査を開始します。クライアントは動画ファイル(例:車載カメラの録画)をアップロードします。サーバ側で動画を受け取り、フレーム抽出ジョブを作成して各フレームに対してAI推論(YOLO等)を非同期で実行します。フレームごとの検出結果と分析(AHP 等)はジョブ完了後に `inspections` に紐づけて保存されます。
  - **リクエストボディ (multipart/form-data):**
    - `file`: 動画ファイル(mp4, mov など)
    - `latitude` / `longitude` (optional): 検査の代表位置(動画全体に紐づく位置情報)
    - `frame_interval` (optional, integer): フレーム抽出間隔(例: 1000 = ミリ秒ごとに1フレーム抽出)
    - `frame_rate` (optional, float): 抽出時に使うフレームレート上書き
  - **挙動:**
    1. サーバは `videos` レコードを作成し動画をストレージに保存する(S3等)。
    2. 非同期ジョブ (`jobs` テーブル) を登録し、ワーカーが動画からフレームを抽出して `images`(フレーム単位)を作成する。
    3. 各 `image` に対して推論を実行し、`predictions` / `detected_objects` を保存する。
    4. 全フレーム推論完了後に `analysis_results`(AHP等)を計算して `inspections` に紐づける。
  - **レスポンス (202 Accepted):**
    ```json
    {
      "inspection_id": 123,
      "video_id": 456,
      "job_id": "uuid-of-processing-job",
      "status": "processing",
      "message": "Video uploaded and processing started. Check job status with /api/v1/jobs/{job_id}."
    }
    ```

- **`GET /api/v1/inspections/{inspection_id}`**
  - **説明:** 特定の検査の結果を取得します。
  - **レスポンス (200 OK):**
    ```json
    {
      "id": 123,
      "location": { "type": "Point", "coordinates": [139.75, 35.70] },
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
        "details": { ... }
      }
    }
    ```

- **`GET /api/v1/inspections`**
  - **説明:** 検査のリストをフィルタリングして取得します。
  - **クエリパラメータ:**
    - `start_date` (string, optional, e.g., "2025-01-01")
    - `end_date` (string, optional, e.g., "2025-12-31")
    - `status` (string, optional)
  - **レスポンス (200 OK):**
    ```json
    [
      {
        "id": 123,
        "status": "completed",
        "created_at": "2025-10-03T10:00:00Z",
        "location": { "type": "Point", "coordinates": [139.75, 35.70] }
      },
      ...
    ]
    ```

### 2.2. 統計情報API

- **`GET /api/v1/statistics`**
  - **説明:** ダッシュボード用の統計データを取得します。
  - **レスポンス (200 OK):**
    ```json
    {
      "total_inspections": 520,
      "total_cracks": 1240,
      "total_potholes": 350,
      "average_score": 78.2
    }
    ```

  ## 3. 追加で明記すべき実装・運用ルール（必須追記）

  以下は設計書に必ず追記しておくべき技術的・運用的な事項です。実装や運用での不整合を避けるため、バックエンド実装時に厳密に採用してください。

  ### 3.1. 永続化の必須ワークフロー
  - フロントエンドは画像/動画/検査メタをバックエンド API に送信し、バックエンドがストレージ（S3 等）と DB に永続化すること。
  - 直接クライアント内に API キーを埋め込んで外部推論サービスに投げる構成は避ける（セキュリティ上の理由）。推論呼び出しはバックエンド経由で行うか、署名付き一時認証等で管理すること。

  ### 3.2. ジョブ（非同期処理）設計
  - 大量のフレーム抽出や推論は非同期ワーカーで処理する。ジョブ管理のために `jobs` テーブルおよびジョブ API を用意する。
  - 推奨 `jobs` テーブル（例）:
    - id: SERIAL PRIMARY KEY
    - inspection_id: INTEGER NULL
    - type: VARCHAR(50) (例: "video_processing", "image_inference")
    - status: VARCHAR(50) (queued|running|completed|failed)
    - progress: INTEGER NULL
    - error_message: TEXT NULL
    - payload: JSONB NULL (ジョブ投入時の入力メタ)
    - created_at, updated_at
  - API:
    - POST /api/v1/inspections -> 202 Accepted と job_id を返す（動画アップロードと同時にジョブを生成）
    - GET /api/v1/jobs/{job_id} -> ジョブの状態とエラー情報を取得

  ### 3.3. 推論（Inference）アーキテクチャとキー管理
  - 推論を行う外部サービス API キーはバックエンドの環境変数で管理する（例: ROB0FLOW_API_KEY）。
  - 推論をバックエンドで実行するためのエンドポイント例: POST /api/v1/infer（image multipart/form-data）→ 推論を行い、`detected_objects` を返す/保存する。

  ### 3.4. 画像・動画メタと座標系（明確に）
  - `images` テーブルに少なくとも以下のカラムを持つことを必須とする:
    - id, inspection_id, file_path, width, height, uploaded_at
    - source: VARCHAR(50) ('photo' | 'video_frame')
    - video_id: INTEGER NULL
    - frame_index: INTEGER NULL
    - original_timestamp: TIMESTAMP WITH TIME ZONE NULL
    - gps_latitude: DOUBLE PRECISION NULL
    - gps_longitude: DOUBLE PRECISION NULL
  - `detected_objects.bounding_box` の座標系を明確にする（保存時に必須フィールド）:
    - 推奨: pixel 座標系（x,y は左上原点）を保存し、必ず `image_width` と `image_height` を合わせて保存すること。
    - オプションで normalized (0..1) も許容するが、その場合は `bbox_coordinate_system: 'pixel' | 'normalized'` を指定する。

  ### 3.5. ストレージとファイルアップロード
  - 画像/動画ファイルはオブジェクトストレージ（S3 等）へ保存することを推奨。バックエンドは受信して直接保存するか、クライアントに署名付きアップロード URL を返すワークフローを提供する。
  - 環境変数で `STORAGE_BACKEND` と `S3_BUCKET` 等を管理する。

  ### 3.6. 認証・権限
  - 全ての書き込み API（upload, infer, inspections, jobs）には認証を必須とする（例: JWT）。
  - 将来的にユーザー毎メタ（uploads by user）を追跡するため `users` テーブルを用意することを推奨する。

  ### 3.7. ロギング・エラー・リトライ
  - ジョブ失敗時は `jobs.error_message` と詳細ログを保存し、再試行ポリシー（exponential backoff）をワーカー側で実装する。

  ## 4. 追加テーブル定義（提案・追記）

  ### 4.1. `jobs` テーブル（ジョブ管理）
  | カラム名 | 型 | 説明 |
  |---|---|---|
  | `id` | `SERIAL PRIMARY KEY` | ジョブID |
  | `inspection_id` | `INTEGER` | 関連検査（ある場合） |
  | `type` | `VARCHAR(50)` | ジョブ種別（video_processing 等） |
  | `status` | `VARCHAR(50)` | queued|running|completed|failed |
  | `progress` | `INTEGER` | 0-100 |
  | `payload` | `JSONB` | ジョブの入力パラメータ |
  | `error_message` | `TEXT` | 失敗時のメッセージ |
  | `created_at`, `updated_at` | `TIMESTAMP WITH TIME ZONE` | タイムスタンプ |

  ### 4.2. `users` テーブル（オプション）
  | カラム名 | 型 | 説明 |
  |---|---|---|
  | `id` | `SERIAL PRIMARY KEY` | ユーザID |
  | `username` | `VARCHAR(255)` | ログイン用ユーザ名 |
  | `email` | `VARCHAR(255)` | メールアドレス |
  | `password_hash` | `VARCHAR(255)` | ハッシュ化パスワード |
  | `role` | `VARCHAR(50)` | admin|user など |
  | `created_at`, `updated_at` | `TIMESTAMP WITH TIME ZONE` | タイムスタンプ |

  ## 5. 追加 API エンドポイント（例）

  - POST /api/v1/images
    - 説明: 画像をアップロードして `images` レコードを作成する。
    - リクエスト: multipart/form-data (`file`, `inspection_id`?, `source`?, `frame_index`?)
    - レスポンス (201): `{ "image_id": 123, "file_path": "/media/..", "width": 800, "height": 600 }`

  - POST /api/v1/videos
    - 説明: 動画をアップロードし `videos` レコードを作成する。
    - リクエスト: multipart/form-data (`file`, `inspection_id`?)
    - レスポンス (201): `{ "video_id": 456, "file_path": "/media/videos/...", "duration_ms": 120000 }`

  - POST /api/v1/inspections
    - 説明: 新しい検査を作成し、動画処理ジョブをキューに登録する。
    - リクエスト: multipart/form-data (`file`(video) または 画像群, `latitude`, `longitude`, `frame_interval` 等)
    - レスポンス (202 Accepted): `{ "inspection_id": 123, "job_id": "uuid", "status": "processing" }`

  - POST /api/v1/infer
    - 説明: 画像を受け取りサーバ側で推論（Roboflow 等）を実行して結果を返す。バックエンドが API キーを保持する。
    - リクエスト: multipart/form-data (`file`)
    - レスポンス (200): `{ "predictions": [...], "image_width": 800, "image_height": 600 }`

  - GET /api/v1/jobs/{job_id}
    - 説明: ジョブ状態を取得する。ジョブ完了時に関連する `inspection`/`analysis_results` へのリンクを返す。

  ## 6. データフォーマット（例）

  `detected_objects` エントリ例 (JSONB)
  ```json
  {
    "image_id": 456,
    "class_name": "D44",
    "confidence": 0.95,
    "bounding_box": { "x": 10, "y": 20, "width": 50, "height": 30 },
    "bbox_coordinate_system": "pixel",
    "image_width": 1024,
    "image_height": 768
  }
  ```

  `images` メタ例 (DB)
  ```json
  {
    "id": 456,
    "inspection_id": 123,
    "file_path": "s3://bucket/path.jpg",
    "width": 1024,
    "height": 768,
    "source": "video_frame",
    "video_id": 12,
    "frame_index": 34,
    "original_timestamp": "2025-10-03T10:00:00Z",
    "gps_latitude": 35.70,
    "gps_longitude": 139.75
  }
  ```

  ## 7. 運用時の環境変数（必須の推奨一覧）
  - DATABASE_URL
  - STORAGE_BACKEND (e.g. s3|local)
  - S3_BUCKET, S3_REGION, S3_ENDPOINT
  - ROBOFLOW_API_KEY (バックエンド側でのみ設定)
  - JWT_SECRET
  - CELERY_BROKER_URL / REDIS_URL (ジョブワーカーを使う場合)

  ## 8. セキュリティ注意点
  - クライアントに外部推論サービスの API キーを埋め込まない。全てバックエンド側で管理する。
  - 画像データは個人情報を含む可能性があるため、保存前にマスクやアクセス制御を検討する。

  ## 9. 移行チェックリスト（フロント→バックエンド移行時）
  1. フロントの `getYoloPredictions` / `processYoloImage` をバックエンドの `/api/v1/infer` に置換する。
  2. 画像/動画アップロードを `POST /api/v1/images` / `POST /api/v1/videos` に差し替える（署名付きアップロードならクライアント側は直接 S3 に保存）。
  3. `/api/v1/inspections` はジョブをキューに投入し 202 を返す挙動にする。
  4. ジョブ完了で `detected_objects`, `images`, `analysis_results` を DB に保存する。

  ---

  追記は以上です。実装の際にこの追記を元に具体的な DB マイグレーション SQL / FastAPI の Pydantic モデル / ルーティングを作成できます。必要なら私の方で次に具体的な FastAPI のスケルトン（routes + models + sample migration SQL）を作成します。どれを先に作成しましょうか？
