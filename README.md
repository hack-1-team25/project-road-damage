# Road Damage Detection System

道路損傷検出システム - 動画とGPS情報から道路の危険箇所を自動検出するシステム

## 🚀 クイックスタート

### 1. すべてのサービスを起動

```bash
# リポジトリルートで実行
docker compose up -d
```

これで以下のサービスが起動します:
- **PostgreSQL** (PostGIS対応) - ポート5432
- **Redis** - ポート6379  
- **Backend API** (FastAPI) - ポート8000

### 2. APIにアクセス

- **API ドキュメント**: http://localhost:8000/docs
- **API エンドポイント**: http://localhost:8000/api/v1
- **ヘルスチェック**: http://localhost:8000/health

### 3. 動画を分析

```bash
curl -X POST "http://localhost:8000/api/v1/videos" \
  -F "video_file=@your_video.mp4" \
  -F "gps_log_file=@gps_log.csv" \
  -F "frame_interval=10"
```

## 📁 プロジェクト構成

```
.
├── backend/              # FastAPI バックエンド
│   ├── app/
│   │   ├── api/         # APIエンドポイント (videos.py)
│   │   ├── models/      # データモデル (SQLAlchemy, Pydantic)
│   │   ├── services/    # ビジネスロジック (Roboflow, Video処理)
│   │   └── core/        # 設定、データベース接続
│   ├── migrations/      # SQLマイグレーション
│   ├── Dockerfile
│   ├── QUICK_START.md   # 詳細なセットアップガイド
│   └── API_USAGE.md     # API使用方法
├── frontend/            # Next.js フロントエンド
├── old/                 # 旧フロントエンド (Vite + React)
├── docker-compose.yml   # Docker Compose設定
└── API_and_DB_Design.md # API・DB設計書

```

## 🎯 主な機能

### バックエンドAPI (FastAPI)

- **POST /api/v1/videos** - 動画とGPS CSVをアップロードして分析
  - 10秒ごとにフレーム抽出
  - Roboflow YOLOで道路損傷検出
  - GPS座標マッピング
  - 危険度スコア計算 (0-5)
  - 注釈付き画像生成

- **GET /api/v1/videos/{video_id}** - 処理状況と分析結果取得

詳細: [backend/API_USAGE.md](backend/API_USAGE.md)

## 🔧 開発環境

### 必要なもの

- Docker & Docker Compose
- (オプション) Python 3.11+ (ローカル開発時)
- (オプション) Node.js 18+ (フロントエンド開発時)

### バックエンド開発

```bash
# すべてのサービス起動
docker compose up -d

# ログ確認
docker compose logs -f backend

# データベースに接続
docker compose exec db psql -U user -d road_damage_db

# バックエンドコンテナに入る
docker compose exec backend bash
```

詳細: [backend/QUICK_START.md](backend/QUICK_START.md)

### フロントエンド開発 (旧版)

```bash
cd old
npm install
npm run dev
```

フロントエンドは http://localhost:5173 で起動します

## 📊 データベース

PostgreSQL 15 + PostGIS拡張

主要テーブル:
- `videos` - 動画メタ情報
- `images` - 抽出されたフレーム
- `detected_objects` - YOLO検出オブジェクト
- `analysis_results` - 分析結果
- `danger_spots` - 危険箇所 (地図表示用)
- `jobs` - バックグラウンドジョブ

スキーマ: [backend/migrations/001_init_schema.sql](backend/migrations/001_init_schema.sql)

## 🗺️ GPS CSVフォーマット

```csv
timestamp,column2,column3,latitude,longitude
2024-10-28T10:00:00Z,data,data,35.708900,139.731900
2024-10-28T10:00:01Z,data,data,35.709000,139.732000
```

- 1行目: ヘッダー (スキップされます)
- カラム0: タイムスタンプ (ISO 8601形式)
- カラム3: 緯度
- カラム4: 経度

## 📖 ドキュメント

- [API設計書](./API_and_DB_Design.md) - 完全なAPI仕様とDB設計
- [バックエンドクイックスタート](./backend/QUICK_START.md) - セットアップと起動方法
- [API使用方法](./backend/API_USAGE.md) - APIの詳しい使い方

## 🛠️ トラブルシューティング

### ポート衝突

```bash
# ポートを変更する場合はdocker-compose.ymlを編集
# backend:
#   ports:
#     - "8080:8000"  # 8000 -> 8080に変更
```

### データベース初期化

```bash
# データベースを再作成
docker compose down -v
docker compose up -d
```

## 📝 環境変数

主要な環境変数はdocker-compose.ymlで設定済み:
- `ROBOFLOW_API_KEY`: Jg5nNY2yVf0uOReHR3C7
- `DEFAULT_FRAME_INTERVAL_SECONDS`: 10

カスタマイズは `backend/.env` で可能です。

## 🤝 開発フロー

1. `docker compose up -d` でサービス起動
2. http://localhost:8000/docs でAPIテスト
3. コード変更は自動的にリロード (--reload)
4. `docker compose logs -f backend` でログ確認
