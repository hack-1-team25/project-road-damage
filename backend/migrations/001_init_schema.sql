-- Road Damage Detection Database Schema
-- PostgreSQL + PostGIS
-- Based on API_and_DB_Design.md

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- =============================================
-- 1. Users table
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =============================================
-- 2. Videos table
-- =============================================
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    storage_type VARCHAR(20) NOT NULL,
    storage_path TEXT NOT NULL,
    duration_seconds DOUBLE PRECISION,
    frame_rate DOUBLE PRECISION,
    frame_interval INTEGER DEFAULT 60,
    total_frames INTEGER,
    extracted_frames INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    gps_log_path TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded_by ON videos(uploaded_by);

-- =============================================
-- 3. Images table
-- =============================================
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_type VARCHAR(20) NOT NULL,
    storage_path TEXT NOT NULL,
    processed_image_path TEXT,
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    gps_location GEOMETRY(Point, 4326),
    extracted_at TIMESTAMP WITH TIME ZONE,
    capture_timestamp TIMESTAMP WITH TIME ZONE,
    frame_index INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_images_video ON images(video_id);
CREATE INDEX IF NOT EXISTS idx_images_location ON images USING GIST(gps_location);
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);

-- =============================================
-- 4. Detected objects table
-- =============================================
CREATE TABLE IF NOT EXISTS detected_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    class VARCHAR(100) NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    bbox_x DOUBLE PRECISION NOT NULL,
    bbox_y DOUBLE PRECISION NOT NULL,
    bbox_width DOUBLE PRECISION NOT NULL,
    bbox_height DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_detected_objects_image ON detected_objects(image_id);
CREATE INDEX IF NOT EXISTS idx_detected_objects_class ON detected_objects(class);

-- =============================================
-- 5. Analysis results table
-- =============================================
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    damage_score INTEGER NOT NULL,
    primary_damage_class VARCHAR(50),
    primary_confidence DOUBLE PRECISION,
    object_count INTEGER DEFAULT 0,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analysis_results_image ON analysis_results(image_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_score ON analysis_results(damage_score);

-- =============================================
-- 6. Danger spots table
-- =============================================
CREATE TABLE IF NOT EXISTS danger_spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    location GEOMETRY(Point, 4326) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    danger_score DOUBLE PRECISION NOT NULL,
    damage_class VARCHAR(50),
    confidence DOUBLE PRECISION,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_danger_spots_image ON danger_spots(image_id);
CREATE INDEX IF NOT EXISTS idx_danger_spots_location ON danger_spots USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_danger_spots_score ON danger_spots(danger_score);

-- =============================================
-- 7. Jobs table
-- =============================================
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    progress DOUBLE PRECISION DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_entity ON jobs(entity_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- =============================================
-- Triggers
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_images_updated_at BEFORE UPDATE ON images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update gps_location for images table (uses gps_latitude/gps_longitude)
CREATE OR REPLACE FUNCTION update_images_gps_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.gps_latitude IS NOT NULL AND NEW.gps_longitude IS NOT NULL THEN
        NEW.gps_location = ST_SetSRID(ST_MakePoint(NEW.gps_longitude, NEW.gps_latitude), 4326);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update location for danger_spots table (uses latitude/longitude)
CREATE OR REPLACE FUNCTION update_danger_spots_location()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_images_gps_location BEFORE INSERT OR UPDATE ON images
    FOR EACH ROW EXECUTE FUNCTION update_images_gps_location();

CREATE TRIGGER trigger_update_danger_spots_location BEFORE INSERT OR UPDATE ON danger_spots
    FOR EACH ROW EXECUTE FUNCTION update_danger_spots_location();

-- =============================================
-- Completion message
-- =============================================
DO $$
BEGIN
    RAISE NOTICE 'Database schema initialized successfully!';
END $$;
