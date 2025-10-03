# API設計とデータベース設計

このドキュメントは、既存のフロントエンドアプリケーションをリファクタリングし、Pythonバックエンド、Next.jsフロントエンド、PostgreSQLデータベースで再構築するためのAPIとデータベースの設計を定義します。

## 1. データベース設計 (PostgreSQL)

PostgreSQLの拡張機能であるPostGISを利用して地理空間データを効率的に扱います。

### 1.1. `roads` テーブル

道路の基本的な静的情報を格納します。

| カラム名      | 型                       | 説明                                   |
| ------------- | ------------------------ | -------------------------------------- |
| `id`          | `SERIAL PRIMARY KEY`     | 道路の一意なID                         |
| `name`        | `VARCHAR(255)`           | 道路の名称                             |
| `geom`        | `GEOMETRY(LineString)`   | 道路の地理情報（ラインストリング形式） |
| `created_at`  | `TIMESTAMP WITH TIME ZONE` | 作成日時 (デフォルトは現在時刻)        |
| `updated_at`  | `TIMESTAMP WITH TIME ZONE` | 更新日時 (デフォルトは現在時刻)        |

### 1.2. `inspections` テーブル

各検査イベントの概要を格納します。

| カラム名      | 型                       | 説明                                   |
| ------------- | ------------------------ | -------------------------------------- |
| `id`          | `SERIAL PRIMARY KEY`     | 検査の一意なID                         |
| `road_id`     | `INTEGER`                | `roads`テーブルへの外部キー            |
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

---

## 2. APIエンドポイント設計 (Python/FastAPI)

### 2.1. 道路関連API

- **`GET /api/v1/roads`**
  - **説明:** すべての道路の地理情報を取得します。
  - **レスポンス (200 OK):**
    ```json
    {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "LineString",
            "coordinates": [ ... ]
          },
          "properties": {
            "id": 1,
            "name": "国道20号線"
          }
        }
      ]
    }
    ```

### 2.2. 検査関連API

- **`POST /api/v1/inspections`**
  - **説明:** 新しい検査を開始します。クライアントは動画ファイル（例：車載カメラの録画）をアップロードします。サーバ側で動画を受け取り、フレーム抽出ジョブを作成して各フレームに対してAI推論（YOLO等）を非同期で実行します。フレームごとの検出結果と分析（AHP 等）はジョブ完了後に `inspections` に紐づけて保存されます。
  - **リクエストボディ (multipart/form-data):**
    - `file`: 動画ファイル（mp4, mov など）
    - `latitude` / `longitude` (optional): 検査の代表位置（動画全体に紐づく位置情報）
    - `road_id` (optional): 関連する道路ID
    - `frame_interval` (optional, integer): フレーム抽出間隔（例: 1000 = ミリ秒ごとに1フレーム抽出）
    - `frame_rate` (optional, float): 抽出時に使うフレームレート上書き
  - **挙動:**
    1. サーバは `videos` レコードを作成し動画をストレージに保存する（S3等）。
    2. 非同期ジョブ (`jobs` テーブル) を登録し、ワーカーが動画からフレームを抽出して `images`（フレーム単位）を作成する。
    3. 各 `image` に対して推論を実行し、`predictions` / `detected_objects` を保存する。
    4. 全フレーム推論完了後に `analysis_results`（AHP等）を計算して `inspections` に紐づける。
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
      "road_id": 1,
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
    - `road_id` (integer, optional)
    - `start_date` (string, optional, e.g., "2025-01-01")
    - `end_date` (string, optional, e.g., "2025-12-31")
    - `status` (string, optional)
  - **レスポンス (200 OK):**
    ```json
    [
      {
        "id": 123,
        "road_id": 1,
        "status": "completed",
        "created_at": "2025-10-03T10:00:00Z"
      },
      ...
    ]
    ```

### 2.3. 統計情報API

- **`GET /api/v1/statistics`**
  - **説明:** ダッシュボード用の統計データを取得します。
  - **クエリパラメータ:**
    - `road_id` (integer, optional)
  - **レスポンス (200 OK):**
    ```json
    {
      "total_inspections": 520,
      "total_cracks": 1240,
      "total_potholes": 350,
      "average_score": 78.2
    }
    ```
