"""
Images API endpoints
"""
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.models.database import Image

router = APIRouter(prefix="/images", tags=["images"])


@router.get("/{image_id}/file")
def get_image_file(
    image_id: UUID,
    processed: bool = False,
    db: Session = Depends(get_db)
):
    """
    画像ファイルを取得します
    
    - **image_id**: 画像ID
    - **processed**: 処理済み画像を取得する場合はTrue（デフォルト: False）
    """
    image = db.query(Image).filter(Image.id == image_id).first()
    
    if not image:
        raise HTTPException(404, "Image not found")
    
    # 処理済み画像か元画像かを選択
    if processed and image.processed_image_path:
        file_path = image.processed_image_path
    else:
        file_path = image.storage_path
    
    # ファイルの存在確認
    if not os.path.exists(file_path):
        raise HTTPException(404, "Image file not found on disk")
    
    # ファイルを返す
    return FileResponse(
        file_path,
        media_type="image/jpeg",
        filename=os.path.basename(file_path)
    )
