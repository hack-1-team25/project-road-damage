-- Init schema for project-road-damage
-- Enables PostGIS and creates tables according to API_and_DB_Design.md

CREATE EXTENSION IF NOT EXISTS postgis;

-- roads
CREATE TABLE IF NOT EXISTS roads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  geom geometry(LineString, 4326),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- inspections
CREATE TABLE IF NOT EXISTS inspections (
  id SERIAL PRIMARY KEY,
  road_id INTEGER,
  location geometry(Point, 4326),
  status VARCHAR(50) DEFAULT 'pending',
  aggregate_score REAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- images
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER,
  file_path VARCHAR(255),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  video_id INTEGER,
  frame_index INTEGER,
  width INTEGER,
  height INTEGER,
  source VARCHAR(50),
  damage_score REAL,
  original_timestamp TIMESTAMPTZ,
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION
);

-- videos
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER,
  file_path VARCHAR(255),
  duration_ms INTEGER,
  frame_rate FLOAT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- detected_objects
CREATE TABLE IF NOT EXISTS detected_objects (
  id SERIAL PRIMARY KEY,
  image_id INTEGER,
  class_name VARCHAR(100),
  confidence FLOAT,
  bounding_box JSONB,
  score REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- analysis_results
CREATE TABLE IF NOT EXISTS analysis_results (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER,
  score REAL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- jobs
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER,
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'queued',
  progress INTEGER,
  payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_roads_geom ON roads USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_inspections_location ON inspections USING GIST (location);
