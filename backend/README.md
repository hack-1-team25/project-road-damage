# Road Damage Detection Backend

FastAPI backend for detecting and managing road damage from images and videos.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.11+

### Setup

1. **環境変数の設定**
```bash
cp .env.example .env
# .envファイルを編集して必要な環境変数を設定
```

2. **Docker Composeで起動**
```bash
# プロジェクトルートで実行
cd ..
docker-compose up -d
```

3. **データベース初期化**
データベースは自動的に初期化されます。マイグレーションは `/migrations/001_init_schema.sql` が実行されます。

4. **APIドキュメント**
http://localhost:8000/docs

### ローカル開発

```bash
# 仮想環境の作成
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係のインストール
pip install -r requirements.txt

# データベース接続設定
export DATABASE_URL="postgresql://user:password@localhost:5432/road_damage_db"

# サーバーの起動
uvicorn app.main:app --reload
```

## 📁 Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py        # Settings
│   ├── models/              # Database models
│   ├── api/                 # API endpoints
│   └── services/            # Business logic
├── migrations/
│   └── 001_init_schema.sql  # Database schema
├── requirements.txt
├── Dockerfile
└── .env.example
```

## 🗄️ Database Schema

### Main Tables (画像中心設計)

- **`images`**: 画像単位のデータ（全ての分析の基準）
- **`danger_spots`**: 検出された危険箇所（地図表示用）
- **`detected_objects`**: AI推論で検出されたオブジェクト
- **`analysis_results`**: AHP等の分析結果
- **`videos`**: 動画メタデータ（オプション）
- **`jobs`**: 非同期ジョブ管理

詳細は `/migrations/001_init_schema.sql` を参照。

## 📡 API Endpoints (予定)

### 画像関連
- `POST /api/v1/images` - 画像アップロード & AI推論
- `GET /api/v1/images/{image_id}` - 画像詳細取得
- `GET /api/v1/images` - 画像リスト取得

### 動画関連
- `POST /api/v1/videos` - 動画アップロード & フレーム抽出
- `GET /api/v1/videos/{video_id}` - 動画処理状況取得

### 危険箇所関連
- `GET /api/v1/danger-spots` - 危険箇所リスト（地図表示用）
- `GET /api/v1/danger-spots/{id}` - 危険箇所詳細

### 統計情報
- `GET /api/v1/statistics` - ダッシュボード用統計

## 🔧 Configuration

環境変数は `.env` ファイルで管理:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/road_damage_db
ROBOFLOW_API_KEY=your_api_key
STORAGE_BACKEND=local  # or s3
```

## 🧪 Testing

```bash
pytest
```

## 📝 Development Notes

- **画像単位設計**: 全ての計算・保存は画像単位で行われます
- **動画処理**: 動画は前処理でフレームに分解され、個々の画像として扱われます
- **PostGIS**: 地理情報はPostGISのGeometry型で管理
- **非同期処理**: Celery + Redisでバックグラウンドジョブを実行

## 🔗 Related Documentation

- [API設計書](../API_and_DB_Design.md)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PostGIS Documentation](https://postgis.net/)
