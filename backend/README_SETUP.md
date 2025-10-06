Setup (macOS / Linux)

1) Install pyenv (if not installed)

   Follow https://github.com/pyenv/pyenv#installation

2) Install Python 3.11 and create venv

```bash
pyenv install 3.11.6
pyenv local 3.11.6
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
```

3) Run DB migrations (or use Docker)

 - Use `backend/migrations/init_schema.sql` with psql, or run `python -m backend.app.db_init` after configuring `DATABASE_URL`.
