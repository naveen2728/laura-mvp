$ErrorActionPreference = "Stop"

python -m alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port $(if ($env:PORT) { $env:PORT } else { "8000" })
