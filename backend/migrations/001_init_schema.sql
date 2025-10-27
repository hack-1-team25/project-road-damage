-- Road Damage Detection Database Schema
-- PostgreSQL + PostGIS

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================
-- 1. images テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    file_path VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'photo', -- 'photo' | 'video_frame'
    video_id INTEGER NULL,
    frame_index INTEGER NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    gps_latitude DOUBLE PRECISION NULL,
    gps_longitude DOUBLE PRECISION NULL,
    original_timestamp TIMESTAMP WITH TIME ZONE NULL,
    damage_score REAL NULL, -- 0.0-100.0
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE NULL
);

-- Indexes for images
CREATE INDEX IF NOT EXISTS idx_images_video ON images(video_id);
CREATE INDEX IF NOT EXISTS idx_images_gps ON images(gps_latitude, gps_longitude);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_images_damage_score ON images(damage_score);

COMMENT ON TABLE images IS '画像単位のデータ管理。全ての分析はこのテーブルを基準に実行される';
COMMENT ON COLUMN images.source IS 'photo: 直接アップロード, video_frame: 動画から抽出';
COMMENT ON COLUMN images.damage_score IS '画像単位の危険度スコア (0.0-100.0)';

-- =============================================
-- 2. danger_spots テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS danger_spots (
    id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL, -- WGS84座標系
    danger_score REAL NOT NULL, -- 0.0-100.0
    danger_type VARCHAR(100) NOT NULL, -- 'crack', 'pothole', 'damage', etc.
    severity VARCHAR(50) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for danger_spots (PostGIS spatial index)
CREATE INDEX IF NOT EXISTS idx_danger_spots_location ON danger_spots USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_danger_spots_image ON danger_spots(image_id);
CREATE INDEX IF NOT EXISTS idx_danger_spots_severity ON danger_spots(severity);
CREATE INDEX IF NOT EXISTS idx_danger_spots_created_at ON danger_spots(created_at);

COMMENT ON TABLE danger_spots IS '検出された個々の危険箇所。地図上にマーカーとして表示';
COMMENT ON COLUMN danger_spots.location IS 'PostGIS Point型。WGS84座標系 (SRID=4326)';
COMMENT ON COLUMN danger_spots.severity IS 'low | medium | high | critical';

-- =============================================
-- 3. videos テーブル (オプション)
-- =============================================
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    file_path VARCHAR(255) NOT NULL,
    duration_ms INTEGER NOT NULL,
    frame_rate FLOAT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_uploaded_at ON videos(uploaded_at);

COMMENT ON TABLE videos IS '動画ファイルのメタ情報。フレーム抽出の追跡用';

-- Add foreign key constraint to images table
ALTER TABLE images 
ADD CONSTRAINT fk_images_video 
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL;

-- =============================================
-- 4. detected_objects テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS detected_objects (
    id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    class_name VARCHAR(100) NOT NULL, -- 'D00', 'D10', 'D20', 'D40', 'D43', 'D44', etc.
    confidence FLOAT NOT NULL, -- 0.0-1.0
    bounding_box JSONB NOT NULL, -- {"x": 10, "y": 20, "width": 50, "height": 30}
    score REAL NULL, -- オプションの追加スコア
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detected_objects_image ON detected_objects(image_id);
CREATE INDEX IF NOT EXISTS idx_detected_objects_class ON detected_objects(class_name);
CREATE INDEX IF NOT EXISTS idx_detected_objects_confidence ON detected_objects(confidence);

COMMENT ON TABLE detected_objects IS 'AI推論で検出されたオブジェクト（損傷箇所）';
COMMENT ON COLUMN detected_objects.bounding_box IS 'pixel座標系 {"x", "y", "width", "height"}';

-- =============================================
-- 5. analysis_results テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    score FLOAT NOT NULL, -- 総合評価スコア
    details JSONB NOT NULL, -- AHP等の詳細データ
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_image ON analysis_results(image_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_score ON analysis_results(score);

COMMENT ON TABLE analysis_results IS 'AHP等の高度な分析結果。画像単位で計算';

-- =============================================
-- 6. jobs テーブル (ジョブ管理)
-- =============================================
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NULL REFERENCES videos(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'video_processing', 'image_inference', etc.
    status VARCHAR(50) NOT NULL DEFAULT 'queued', -- 'queued', 'running', 'completed', 'failed'
    progress INTEGER DEFAULT 0, -- 0-100
    payload JSONB NULL, -- ジョブの入力パラメータ
    error_message TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

COMMENT ON TABLE jobs IS '非同期ジョブの管理（動画処理、AI推論等）';

-- =============================================
-- 7. users テーブル (オプション - 将来用)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'admin', 'user'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

COMMENT ON TABLE users IS 'ユーザー管理（認証・権限）';

-- =============================================
-- トリガー: updated_at の自動更新
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 初期データ (オプション)
-- =============================================
-- 管理者ユーザーの作成例 (パスワード: admin123)
-- INSERT INTO users (username, email, password_hash, role)
-- VALUES ('admin', 'admin@example.com', '$2b$12$...', 'admin');

-- 完了メッセージ
DO $$
BEGIN
    RAISE NOTICE 'Database schema initialized successfully!';
    RAISE NOTICE 'PostGIS extension enabled: %', (SELECT PostGIS_Full_Version());
END $$;
