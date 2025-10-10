from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import roads, inspections

app = FastAPI(
    title="Road Damage Detection API",
    description="API for managing road damage detection and inspection",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS: フロントの開発起点（localhost:3000 等）を許可
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターを登録
app.include_router(roads.router)
app.include_router(inspections.router)

@app.get("/api/health")
async def health():
    """ヘルスチェックエンドポイント"""
    return {"status": "ok", "service": "road-damage-backend"}
