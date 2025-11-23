# カスタムYOLOモデルへの移行完了

## 変更内容

### 1. APIからカスタムモデルへの切り替え

以前はRoboflow APIを使用して画像推論を行っていましたが、自作の`best.pt`モデルを使用するように変更しました。

### 2. 変更されたファイル

#### `backend/requirements.txt`
- `ultralytics>=8.3.0`を追加（YOLOv8推論ライブラリ）

#### `backend/app/services/roboflow_service.py`
- RoboflowAPIからカスタムYOLOモデルへ完全移行
- PyTorch 2.6+との互換性のため、`torch.load`をパッチ
- `best.pt`モデルを`app/services/`ディレクトリから読み込み
- 推論結果を既存の`RoboflowResponse`形式に変換（互換性維持）

### 3. モデルファイル

カスタムモデル`best.pt`は以下に配置:
```
backend/app/services/best.pt
```

### 4. 検出可能なクラス

モデルは以下の道路損傷タイプを検出できます:
- **D00**: クラック (線状)
- **D10**: クラック (ひび割れ)
- **D20**: クラック (ワニ皮状)
- **D40**: ポットホール
- **D43**: 白線かすれ
- **D44**: クロスウォーク消失
- **D50**: 段差

### 5. 動作確認

```bash
cd backend
python test_yolo_model.py
```

出力:
```
============================================================
Testing Custom YOLO Model
============================================================
✅ Model loaded successfully!
   Model type: <class 'ultralytics.models.yolo.model.YOLO'>
   Model names: {0: 'D00', 1: 'D10', 2: 'D20', 3: 'D40', 4: 'D43', 5: 'D44', 6: 'D50'}

✅ All tests passed!
```

### 6. API使用方法（変更なし）

既存のAPIエンドポイントはそのまま使用できます:

#### 画像アップロード
```bash
POST /api/v1/videos
```

#### 動画処理
動画をアップロードすると、自動的にフレームが抽出され、カスタムYOLOモデルで推論が実行されます。

### 7. 技術的な詳細

#### PyTorch 2.6+互換性対応
PyTorch 2.6以降では、`torch.load()`のデフォルト動作が`weights_only=True`に変更されました。カスタムYOLOモデル(`.pt`ファイル)を読み込むには、`weights_only=False`を指定する必要があります。

実装では、`torch.load`関数をパッチして、`.pt`ファイルの読み込み時に自動的に`weights_only=False`を設定しています。

```python
def _patched_torch_load(f, map_location=None, pickle_module=None, weights_only=None, **kwargs):
    if isinstance(f, str) and f.endswith('.pt'):
        weights_only = False
    return _original_torch_load(f, map_location=map_location, ...)
```

#### バウンディングボックスの形式変換
YOLOv8の出力形式 `(x1, y1, x2, y2)` から、Roboflow互換形式 `(center_x, center_y, width, height)` に変換しています。

### 8. 今後の改善点

- [ ] モデルの信頼度閾値の調整可能化
- [ ] バッチ推論のサポート
- [ ] GPU推論の有効化（現在はCPU）
- [ ] モデルバージョン管理
- [ ] A/Bテスト用の複数モデルサポート

### 9. トラブルシューティング

#### モデルファイルが見つからないエラー
```
FileNotFoundError: Model file not found: /path/to/best.pt
```

**解決策**: `best.pt`を`backend/app/services/`に配置してください。

#### PyTorchバージョンエラー
```
WeightsUnpickler error: Unsupported global...
```

**解決策**: コードはすでにパッチを適用していますが、問題が発生する場合は以下を実行:
```bash
pip install --upgrade ultralytics
```

### 10. パフォーマンス

カスタムモデルを使用することで:
- ✅ APIコールのコストを削減
- ✅ レスポンス時間の改善（ネットワークレイテンシなし）
- ✅ オフライン環境での動作が可能
- ✅ プライバシーの向上（画像を外部に送信しない）

---

## まとめ

Roboflow APIから自作のYOLOv8モデル(`best.pt`)への移行が完了しました。既存のAPIインターフェースは維持されているため、フロントエンドの変更は不要です。
