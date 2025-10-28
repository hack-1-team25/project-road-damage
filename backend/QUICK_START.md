# Road Damage Detection Backend - Quick Start

## 🚀 Docker Composeで起動

最も簡単な起動方法です。以下のコマンドで全てのサービス(PostgreSQL + Redis + Backend API)が起動します。

```bash
# プロジェクトルートディレクトリで実行
docker compose up -d

# ログを確認
docker compose logs -f backend
```

起動後、以下にアクセス可能:
- **API**: http://localhost:8000
- **API ドキュメント**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📦 含まれるサービス

- **db**: PostgreSQL 15 + PostGIS (地理空間データベース)
- **redis**: Redis 7 (ジョブキュー用)
- **backend**: FastAPI アプリケーション (ポート8000)

## 🔧 初回セットアップ

1. **環境変数ファイルの作成** (オプション)
   ```bash
   cd backend
   cp .env.example .env
   # .env を編集して設定を変更可能
   ```

2. **Docker Composeで起動**
   ```bash
   docker compose up -d
   ```

3. **データベース初期化の確認**
   ```bash
   # マイグレーションは自動実行されます
   docker compose logs db | grep "init"
   ```

## 📝 API使用例

### 動画をアップロードして分析

```bash
curl -X POST "http://localhost:8000/api/v1/videos" \
  -F "video_file=@path/to/video.mp4" \
  -F "gps_log_file=@path/to/gps.csv" \
  -F "frame_interval=10"
```

### 処理状況を確認

```bash
curl "http://localhost:8000/api/v1/videos/{video_id}"
```

## 🛠️ 開発時のコマンド

```bash
# サービスの起動
docker compose up -d

# ログ確認
docker compose logs -f backend

# サービスの停止
docker compose down

# データベースを含めて完全削除
docker compose down -v

# バックエンドのみ再起動
docker compose restart backend

# バックエンドコンテナに入る
docker compose exec backend bash

# データベースに接続
docker compose exec db psql -U user -d road_damage_db
```

## 📂 ストレージ構造

Docker Volumeに以下のディレクトリが作成されます:

```
/app/storage/
  ├── videos/       # アップロードされた動画
  ├── gps/          # GPS CSVファイル
  ├── frames/       # 抽出されたフレーム画像
  └── processed/    # YOLO分析後の注釈付き画像
```

## 🔍 トラブルシューティング

### ポートが既に使用されている

```bash
# ポート8000を使用しているプロセスを確認
lsof -i :8000

# docker-compose.ymlでポートを変更
# ports:
#   - "8080:8000"  # 8080に変更
```

### データベース接続エラー

```bash
# データベースが起動しているか確認
docker compose ps db

# ヘルスチェック確認
docker compose exec db pg_isready -U user -d road_damage_db
```

### バックエンドが起動しない

```bash
# ログを確認
docker compose logs backend

# 依存関係を再インストール
docker compose build --no-cache backend
docker compose up -d backend
```

## 📖 詳細ドキュメント

- [API使用方法](./API_USAGE.md) - API の詳細な使い方
- [API設計書](../API_and_DB_Design.md) - 完全なAPI仕様とDB設計

## 🌐 環境変数

主要な環境変数はdocker-compose.ymlで設定済みです:

- `DATABASE_URL`: PostgreSQL接続URL
- `ROBOFLOW_API_KEY`: Roboflow APIキー
- `DEFAULT_FRAME_INTERVAL_SECONDS`: フレーム抽出間隔(秒)

カスタマイズしたい場合は`.env`ファイルを作成してください。
