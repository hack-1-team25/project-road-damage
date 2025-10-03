Road Damage - Dev setup

This workspace contains the old frontend code (in `old/`) and a new `backend/` FastAPI starter plus a `docker-compose.yml` to run Postgres and the backend.

Getting started (macOS):

1. Copy backend/.env.example to backend/.env and fill secrets.

2. Start services:

```bash
# from repository root
docker-compose up --build
```

3. Frontend: use the existing `old/` project. From `old/` run:

```bash
cd old
npm install
npm run dev
```

Backend will be available at http://localhost:8000 and healthcheck at /api/health
