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
  - **説明:** 新しい検査を開始します。画像ファイルと位置情報を受け取り、バックグラウンドでAI分析を実行します。
  - **リクエストボディ (multipart/form-data):**
    - `file`: 画像ファイル
    - `latitude`: 緯度
    - `longitude`: 経度
    - `road_id`: 関連する道路ID
  - **レスポンス (202 Accepted):**
    ```json
    {
      "inspection_id": 123,
      "status": "processing",
      "message": "Inspection started. Results will be available shortly."
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
