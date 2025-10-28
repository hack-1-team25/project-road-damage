"""
Storage utility functions
"""
import os
from pathlib import Path
from app.core.config import settings


def ensure_storage_directories():
    """
    Ensure all required storage directories exist
    """
    directories = [
        os.path.join(settings.LOCAL_STORAGE_PATH, "videos"),
        os.path.join(settings.LOCAL_STORAGE_PATH, "gps"),
        os.path.join(settings.LOCAL_STORAGE_PATH, "frames"),
        os.path.join(settings.LOCAL_STORAGE_PATH, "processed"),
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)


def get_file_size_mb(file_path: str) -> float:
    """
    Get file size in MB
    """
    size_bytes = os.path.getsize(file_path)
    return size_bytes / (1024 * 1024)
