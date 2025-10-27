# Backend Setup Guide

## 🚀 セットアップ手順

### 1. Dockerの起動確認

```bash
# Dockerが起動しているか確認
docker ps
```

Dockerが起動していない場合は、Docker Desktopを起動してください。

### 2. データベースとRedisの起動

```bash
# プロジェクトルートディレクトリで実行
cd /Users/abesouichirou/Desktop/hack1

# PostgreSQL + PostGISとRedisを起動
docker compose up -d db redis

# コンテナの起動確認
docker compose ps

# DBの準備ができるまで待つ (約10-15秒)
docker compose logs db
```

### 3. データベースの初期化

マイグレーションSQLは自動的に実行されます（docker-composeの`/docker-entrypoint-initdb.d`）。

手動で実行する場合:

```bash
# PostgreSQLコンテナに接続
docker compose exec db psql -U user -d road_damage_db

# SQLを確認
\dt

# PostGISが有効か確認
SELECT PostGIS_Full_Version();

# テーブル一覧
\d images
\d danger_spots
\d detected_objects
\d analysis_results
\d videos
\d jobs

# 終了
\q
```

### 4. Python仮想環境のセットアップ

```bash
cd backend

# 仮想環境作成
python3 -m venv venv

# 仮想環境を有効化
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate  # Windows

# 依存関係のインストール
pip install -r requirements.txt
```

### 5. FastAPIサーバーの起動

```bash
# backend/ディレクトリで実行
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

ブラウザで http://localhost:8000/docs にアクセスして、API documentationを確認。

### 6. データベース接続の確認

```bash
# Pythonで接続テスト
python3 << 'EOF'
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="road_damage_db",
    user="user",
    password="password"
)

cur = conn.cursor()
cur.execute("SELECT version();")
print("PostgreSQL version:", cur.fetchone()[0])

cur.execute("SELECT PostGIS_Full_Version();")
print("PostGIS version:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
print("Number of tables:", cur.fetchone()[0])

cur.close()
conn.close()
print("✅ Database connection successful!")
EOF
```

## 🗄️ データベース構造

### テーブル一覧

| テーブル名 | 説明 |
|---|---|
| `images` | 画像データ（全ての分析の基準） |
| `danger_spots` | 検出された危険箇所（地図表示用） |
| `detected_objects` | AI推論で検出されたオブジェクト |
| `analysis_results` | AHP等の分析結果 |
| `videos` | 動画メタデータ |
| `jobs` | 非同期ジョブ管理 |
| `users` | ユーザー管理（認証用） |

### 設計のポイント

✅ **画像中心設計**: 全てのデータは画像単位で管理
✅ **PostGIS統合**: 地理情報はGeometry型で効率的に管理
✅ **インデックス最適化**: 検索パフォーマンスのため適切なインデックスを配置

## 🔧 トラブルシューティング

### データベースに接続できない

```bash
# コンテナのログを確認
docker compose logs db

# コンテナの再起動
docker compose restart db

# ポート5432が使用されているか確認
lsof -i :5432
```

### マイグレーションが実行されていない

```bash
# 手動でマイグレーション実行
docker compose exec db psql -U user -d road_damage_db -f /docker-entrypoint-initdb.d/001_init_schema.sql
```

### Redisに接続できない

```bash
# Redisのログを確認
docker compose logs redis

# Redisに接続テスト
docker compose exec redis redis-cli ping
# 応答: PONG
```

## 次のステップ

1. ✅ データベースセットアップ完了
2. ⏭️ SQLAlchemyモデルの作成
3. ⏭️ APIエンドポイントの実装
4. ⏭️ 画像アップロード機能の実装
5. ⏭️ AI推論統合

詳細は `README.md` を参照してください。
