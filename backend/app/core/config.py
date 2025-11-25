from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/road_damage_db"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    # Storage
    STORAGE_TYPE: str = "local"  # "local" or "s3"
    LOCAL_STORAGE_PATH: str = "./storage"
    S3_BUCKET_NAME: str = ""
    S3_REGION: str = ""
    S3_ENDPOINT: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    
    # Roboflow API
    ROBOFLOW_API_KEY: str = "Jg5nNY2yVf0uOReHR3C7"
    ROBOFLOW_MODEL_ID: str = "road-damages-detection/1"
    ROBOFLOW_API_URL: str = "https://detect.roboflow.com"
    
    # Authentication
    JWT_SECRET_KEY: str = "your-secret-key-change-this-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60
    
    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_WORKER_CONCURRENCY: int = 4
    
    # Application
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 500
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png"
    ALLOWED_VIDEO_TYPES: str = "video/mp4,video/quicktime,video/x-msvideo"
    ALLOWED_CSV_TYPES: str = "text/csv,application/vnd.ms-excel"
    ALLOWED_GPX_TYPES: str = "application/gpx+xml,application/xml,text/xml"
    
    # Processing
    DEFAULT_FRAME_INTERVAL_SECONDS: int = 10
    IMAGE_RESIZE_MAX_DIMENSION: int = 1024
    JPEG_QUALITY: int = 95
    VIDEO_PROCESSING_TIMEOUT_MINUTES: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields from .env


settings = Settings()
