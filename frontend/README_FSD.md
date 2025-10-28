# 路面損傷検出システム - フロントエンド

Feature-Sliced Design (FSD) に準拠した Next.js フロントエンドアプリケーション

## 機能

- **動画アップロード**: 路面の動画とGPS CSVファイルをアップロード
- **危険箇所可視化**: AI解析された危険箇所を地図上に表示
- **リアルタイム更新**: 危険箇所データの自動更新

## ディレクトリ構造 (FSD準拠)

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # メインページ
│   ├── layout.tsx         # レイアウト
│   └── globals.css        # グローバルスタイル
│
├── shared/                 # 共有レイヤー
│   ├── api/               # API通信
│   ├── types/             # 型定義
│   ├── lib/               # ユーティリティ
│   └── ui/                # 共通UIコンポーネント
│
├── entities/               # エンティティレイヤー
│   ├── danger-spot/       # 危険箇所エンティティ
│   └── video/             # 動画エンティティ
│
├── features/               # 機能レイヤー
│   └── upload-video/      # 動画アップロード機能
│       └── ui/
│           └── UploadPanel.tsx
│
└── widgets/                # ウィジェットレイヤー
    └── map/               # 地図ウィジェット
        ├── ui/
        │   └── MapView.tsx
        └── lib/
            └── utils.ts
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

アプリケーションは http://localhost:3000 で起動します。

## 使い方

### 1. 動画のアップロード

1. 左側のパネルで「動画ファイル」をドラッグ＆ドロップまたはクリックして選択
2. 「GPS データ（CSV）」ボタンをクリックしてGPSログファイルを選択
3. フレーム抽出間隔を設定（デフォルト: 10秒）
4. 「アップロード開始」ボタンをクリック

### 2. 地図の確認

- 右側の地図に危険箇所がマーカーで表示されます
- マーカーの色は危険度を示します:
  - 🔴 赤: 重度 (スコア 4-5)
  - 🟡 黄: 中度 (スコア 2-4)
  - 🟢 緑: 軽度 (スコア 0-2)
  - 🔵 青: 損傷なし
- マーカーをクリックすると詳細情報が表示されます

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **地図**: React Leaflet
- **HTTP クライアント**: Axios
- **アイコン**: Lucide React
- **ファイルアップロード**: React Dropzone

## API エンドポイント

### 危険箇所取得
```
GET /api/v1/danger-spots
```

パラメータ:
- `min_lat`, `max_lat`, `min_lng`, `max_lng`: バウンディングボックス
- `min_score`: 最小危険度スコア
- `damage_class`: 損傷クラスでフィルタ
- `limit`: 最大件数
- `offset`: ページネーション

### 動画アップロード
```
POST /api/v1/videos
```

FormData:
- `video_file`: 動画ファイル (MP4/MOV/AVI)
- `gps_log_file`: GPS CSVファイル
- `frame_interval`: フレーム抽出間隔（秒）

## 開発

### ビルド

```bash
npm run build
```

### 本番環境での起動

```bash
npm start
```

### リント

```bash
npm run lint
```

## 注意事項

- バックエンドAPIが起動している必要があります
- Leafletは動的インポートされ、クライアントサイドでのみレンダリングされます
- 地図データは30秒ごとに自動更新されます（変更可能）

## ライセンス

MIT
