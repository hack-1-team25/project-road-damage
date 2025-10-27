from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(
    title="Road Damage Detection API",
    description="API for detecting and managing road damage from images and videos",
    version="1.0.0",
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Road Damage Detection API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# API ルーターをここで登録予定
# from app.api import images, videos, danger_spots, statistics
# app.include_router(images.router, prefix=settings.API_V1_PREFIX, tags=["images"])
# app.include_router(videos.router, prefix=settings.API_V1_PREFIX, tags=["videos"])
# app.include_router(danger_spots.router, prefix=settings.API_V1_PREFIX, tags=["danger_spots"])
# app.include_router(statistics.router, prefix=settings.API_V1_PREFIX, tags=["statistics"])
