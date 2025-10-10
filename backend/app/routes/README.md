# Roads API Implementation

## 概要

このディレクトリには、道路情報を取得するためのFastAPI実装が含まれています。クリーンアーキテクチャの原則に従い、レイヤー分離されています。

## アーキテクチャ

```
app/
├── routes/          # API エンドポイント（プレゼンテーション層）
├── services/        # ビジネスロジック（アプリケーション層）
├── repositories/    # データアクセス（インフラストラクチャ層）
├── schemas/         # Pydantic スキーマ（データ検証）
├── models.py        # SQLModel モデル（データベースエンティティ）
├── database.py      # データベース接続設定
└── main.py          # FastAPI アプリケーションエントリーポイント
```

## レイヤーの責務

### 1. Routes Layer (`routes/roads.py`)
- **責務**: HTTPリクエスト/レスポンスの処理
- **機能**:
  - エンドポイント定義
  - 依存性注入
  - HTTPステータスコード管理
  - OpenAPI ドキュメント生成

### 2. Services Layer (`services/road_service.py`)
- **責務**: ビジネスロジック
- **機能**:
  - データ変換（DB → GeoJSON）
  - ビジネスルールの適用
  - 複数のリポジトリの調整

### 3. Repositories Layer (`repositories/road_repository.py`)
- **責務**: データアクセス
- **機能**:
  - SQLクエリの実行
  - PostGIS 関数の利用（ST_AsGeoJSON）
  - データベースとの直接的なやり取り

### 4. Schemas Layer (`schemas/geojson.py`)
- **責務**: データ検証とシリアライゼーション
- **機能**:
  - Pydantic モデル定義
  - GeoJSON RFC 7946 準拠
  - 自動バリデーション

## API エンドポイント

### GET /api/v1/roads

すべての道路の地理情報をGeoJSON形式で取得します。

**レスポンス例:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [139.7452763, 35.7296523],
          [139.745291, 35.7296358],
          [139.7453141, 35.72961]
        ]
      },
      "properties": {
        "id": 1,
        "name": "国道20号線"
      }
    }
  ]
}
```

### GET /api/v1/roads/count

道路の総数を取得します。

**レスポンス例:**
```json
{
  "count": 1234
}
```

## 実装の特徴

### 1. **依存性注入 (Dependency Injection)**
```python
# データベースセッションの注入
DatabaseSession = Annotated[AsyncSession, Depends(get_db)]

# サービス層の注入
def get_road_service(db: DatabaseSession) -> RoadService:
    repository = RoadRepository(db)
    return RoadService(repository)
```

### 2. **非同期処理 (Async/Await)**
- すべてのデータベース操作は非同期
- 高いスループットとスケーラビリティ

### 3. **型安全性**
- Pydantic による厳密な型チェック
- Python type hints の活用

### 4. **GeoJSON 対応**
- PostGIS の `ST_AsGeoJSON` 関数を使用
- GeoJSON RFC 7946 準拠

### 5. **エラーハンドリング**
- HTTPException による適切なエラーレスポンス
- ログ出力（本番環境では適切なロガーを使用）

## 使用技術

- **FastAPI**: 高速な Web フレームワーク
- **SQLAlchemy**: ORM と SQL ツールキット
- **Pydantic**: データバリデーション
- **GeoAlchemy2**: 地理空間データ拡張
- **AsyncPG**: PostgreSQL 非同期ドライバ

## テスト方法

### 1. Dockerコンテナの起動
```bash
docker compose up
```

### 2. API ドキュメントの確認
ブラウザで以下にアクセス:
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

### 3. cURLでのテスト
```bash
# 道路一覧の取得
curl http://localhost:8000/api/v1/roads

# 道路数の取得
curl http://localhost:8000/api/v1/roads/count
```

## 拡張性

この実装は以下の拡張が容易です:

1. **フィルタリング**: クエリパラメータの追加
2. **ページネーション**: limit/offset の実装
3. **キャッシング**: Redis などのキャッシュ層の追加
4. **認証**: JWT トークンベースの認証
5. **レート制限**: API 使用量の制限

## ベストプラクティス

1. **単一責任の原則**: 各レイヤーは明確な責務を持つ
2. **依存性の逆転**: 上位レイヤーは抽象に依存
3. **開放閉鎖の原則**: 拡張に開いて、修正に閉じている
4. **インターフェース分離**: 必要な機能のみを公開
5. **DRY原則**: コードの重複を避ける

## 今後の改善点

- [ ] ユニットテストの追加
- [ ] 統合テストの実装
- [ ] ロギングフレームワークの導入（structlog など）
- [ ] API バージョニング戦略の実装
- [ ] レスポンスキャッシュの実装
- [ ] OpenTelemetry によるトレーシング
