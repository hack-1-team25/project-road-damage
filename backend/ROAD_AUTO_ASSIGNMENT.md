# 道路自動割当機能の実装

## 概要
動画アップロード時に各フレームの GPS 座標から最寄り道路を自動検索し、道路ごとに inspection を作成する機能を実装しました。

## 主な変更点

### 1. API 変更（`routes/inspections.py`）
- **削除:** `road_id` パラメータ（フロントエンドから送信不要）
- **追加:** GPS 座標から道路を自動検索
- **レスポンス変更:** 複数の inspection を含むレスポンス形式

**Before:**
```python
POST /api/v1/inspections
- road_id: Optional[int]  # フロントエンドが指定

Response:
{
  "inspection_id": 123,
  "video_id": 456,
  "job_id": "...",
  "status": "processing"
}
```

**After:**
```python
POST /api/v1/inspections
# road_id パラメータは削除（自動検索）

Response:
{
  "parent_inspection_id": 123,
  "video_id": 456,
  "job_id": "...",
  "inspections": [
    {"inspection_id": 124, "road_id": 1, "frame_count": 10, "aggregate_score": 2.5},
    {"inspection_id": 125, "road_id": 2, "frame_count": 5, "aggregate_score": 1.8}
  ],
  "status": "processing",
  "message": "Created 2 road-specific inspections."
}
```

### 2. リポジトリ層の追加（`repositories/inspection_repository.py`）

#### 新メソッド:

**`get_nearest_road_for_point(longitude, latitude, max_distance_m=50.0)`**
- 1つの GPS 座標から最寄り道路を検索
- PostGIS の空間クエリ（ST_DWithin, ST_Distance）を使用
- 距離閾値（デフォルト 50m）以内の道路のみを対象

```python
# PostGIS SQL クエリ
WITH pt AS (
    SELECT ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) AS geom
)
SELECT r.id, 
       ST_Distance(r.geom::geography, pt.geom::geography) AS distance_m
FROM roads r, pt
WHERE ST_DWithin(r.geom::geography, pt.geom::geography, :max_m)
ORDER BY distance_m
LIMIT 1
```

**`get_nearest_roads_from_points(gps_points, max_distance_m=50.0)`**
- 複数の GPS 座標から道路出現回数を集計
- 道路ごとのフレーム数をカウント

### 3. サービス層の変更（`services/inspection_service.py`）

#### 主な処理フロー:

1. **動画保存:** ファイルをストレージに保存
2. **親 inspection 作成:** 動画全体を管理する親 inspection（road_id=NULL）
3. **フレーム抽出 & 推論:** GPS 付きでフレームを抽出して YOLO 推論
4. **道路別グルーピング:** 各フレームの GPS から最寄り道路を検索し、road_id ごとにフレームをグループ化
5. **道路別 inspection 作成:** 各道路グループに対して個別の inspection を作成
   - 各 inspection に画像（images）、検出オブジェクト（detected_objects）を保存
   - 道路ごとに aggregate_score を計算
6. **完了:** すべての inspection のステータスを `completed` に更新

#### コード例（抜粋）:
```python
# 各フレームを道路別にグルーピング
frames_by_road: Dict[Optional[int], List[Dict]] = {}

for frame_result in frame_results:
    lat = frame_result.get("latitude")
    lon = frame_result.get("longitude")
    
    road_id = None
    if lat and lon:
        # 最寄り道路を検索（50m以内）
        nearest = await self.repository.get_nearest_road_for_point(
            longitude=lon,
            latitude=lat,
            max_distance_m=50.0
        )
        if nearest:
            road_id = nearest['id']
    
    # 道路IDごとにフレームをグルーピング
    if road_id not in frames_by_road:
        frames_by_road[road_id] = []
    frames_by_road[road_id].append(frame_result)

# 道路ごとに inspection を作成
for road_id, frames in frames_by_road.items():
    inspection = await self.repository.create_inspection(
        road_id=road_id,
        latitude=median_lat,
        longitude=median_lon,
        status="processing"
    )
    # フレーム保存、aggregate_score 計算...
```

### 4. スキーマ変更（`schemas/inspection.py`）

**新スキーマ:**
- `RoadInspectionInfo`: 道路別検査情報
- `InspectionCreateResponse`: 更新（複数 inspection 対応）

```python
class RoadInspectionInfo(BaseModel):
    inspection_id: int
    road_id: Optional[int]
    frame_count: int
    aggregate_score: float

class InspectionCreateResponse(BaseModel):
    parent_inspection_id: int
    video_id: int
    job_id: str
    inspections: List[RoadInspectionInfo]
    status: str
    message: str
```

## データベース要件

### 必須インデックス
道路検索のパフォーマンス向上のため、空間インデックスが必須です：

```sql
CREATE INDEX idx_roads_geom ON roads USING GIST (geom);
```

### データ例

**入力（GPS CSV）:**
```csv
timestamp,,,latitude,longitude
2025-10-10T10:00:00,,,35.7296523,139.7452763
2025-10-10T10:00:01,,,35.7296358,139.745291
2025-10-10T10:00:02,,,35.72961,139.7453141
```

**出力（inspections テーブル）:**
| id  | road_id | status    | aggregate_score | location（代表点） |
|-----|---------|-----------|-----------------|-------------------|
| 123 | NULL    | completed | NULL            | POINT(...)        | ← 親 inspection
| 124 | 1       | completed | 2.5             | POINT(...)        | ← 道路1の検査
| 125 | 2       | completed | 1.8             | POINT(...)        | ← 道路2の検査

**出力（images テーブル）:**
| id  | inspection_id | road_id | gps_latitude | gps_longitude | damage_score |
|-----|---------------|---------|--------------|---------------|--------------|
| 456 | 124           | 1       | 35.7296523   | 139.7452763   | 2.3          |
| 457 | 124           | 1       | 35.7296358   | 139.745291    | 2.7          |
| 458 | 125           | 2       | 35.72961     | 139.7453141   | 1.8          |

## エッジケース

### 1. GPS が道路に近くない場合
- 閾値（50m）以内に道路がない場合、`road_id = NULL` の inspection に含まれる
- フロントエンドで「未割当フレーム」として表示可能

### 2. 複数道路が同じ距離にある場合
- `ORDER BY distance_m LIMIT 1` で最初にヒットした道路を採用
- 将来的には候補リストを返して手動確認する UI も検討

### 3. GPS ノイズ・欠損
- GPS データがない or パースできないフレームは `road_id = NULL` グループに入る
- ノイズ除去（前処理フィルタ）は現在未実装

## パフォーマンス考慮

### 最適化ポイント
1. **空間インデックス必須:** `GIST (geom)` インデックス
2. **バッチ化:** 将来的には複数点を1クエリで処理（`ST_DWithin` の IN 句利用）
3. **キャッシュ:** 同じ road_id が連続する場合はキャッシュ可能

### 推定処理時間
- 1 フレームあたり道路検索: ~10ms（インデックス有）
- 100 フレーム動画: ~1秒（道路検索のみ）
- YOLO 推論時間: 別途（1フレーム 100-500ms）

## 運用設定

### 閾値調整
`max_distance_m` は用途に応じて調整：
- **都市部:** 10-30m（道路密集地）
- **郊外:** 50-100m（道路間隔が広い）

### 環境変数（推奨）
```bash
# .env
ROAD_SEARCH_MAX_DISTANCE_M=50.0  # 道路検索の最大距離（メートル）
```

## テスト

### 手動テスト手順
1. **準備:** roads テーブルに道路データを投入
2. **API 呼び出し:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/inspections \
     -F "file=@video.mp4" \
     -F "gps_file=@gps.csv" \
     -F "frame_interval=1000"
   ```
3. **確認:**
   - レスポンスに複数 inspection が含まれているか
   - 各 inspection の road_id が正しく設定されているか
   - aggregate_score が計算されているか

### 単体テスト例（pytest）
```python
async def test_get_nearest_road_for_point():
    # テストデータ: 道路を1件投入
    # 座標: 緯度35.729, 経度139.745
    
    repo = InspectionRepository(db)
    result = await repo.get_nearest_road_for_point(
        longitude=139.745,
        latitude=35.729,
        max_distance_m=50.0
    )
    
    assert result is not None
    assert result['id'] == expected_road_id
    assert result['distance_m'] < 50.0
```

## 今後の拡張

### 優先度高
1. **Map-matching:** OSRM/Valhalla 統合で経路に沿った道路割当
2. **候補道路リスト API:** フロントで手動確定できる UI
3. **ジョブ進捗更新:** 道路検索の進捗を `jobs.progress` に反映

### 優先度中
4. **バッチ検索:** 複数 GPS 点を1クエリで処理
5. **GPS ノイズフィルタ:** 外れ値除去・平滑化
6. **道路属性取得:** 道路名・種別を inspection に含める

### 優先度低
7. **機械学習ベース割当:** 過去の割当パターンから学習
8. **リアルタイム割当:** WebSocket でフレームごとに通知

## 関連ドキュメント
- [API_and_DB_Design.md](../API_and_DB_Design.md) - 全体設計
- [PostGIS Documentation](https://postgis.net/docs/) - 空間クエリリファレンス
- [FastAPI Documentation](https://fastapi.tiangolo.com/) - API フレームワーク

## トラブルシューティング

### Q: 道路が見つからない（全フレームで road_id=NULL）
A: 以下を確認:
1. roads テーブルにデータがあるか
2. GIST インデックスが作成されているか（`\d roads` で確認）
3. GPS 座標と roads.geom の SRID が一致しているか（両方 4326）
4. max_distance_m 閾値が適切か

### Q: パフォーマンスが遅い
A: 
1. `EXPLAIN ANALYZE` で SQL 実行計画を確認
2. GIST インデックスが使われているか確認
3. `roads` テーブルの `VACUUM ANALYZE` 実行

### Q: 同じ動画で道路が細かく分割されすぎる
A: 閾値や集約ロジックを調整:
- 連続する同じ road_id のフレームを1つの inspection にまとめる
- 最小フレーム数の閾値を設定（例: 3フレーム未満は除外）
