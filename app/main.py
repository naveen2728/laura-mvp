from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import api_keys, projects, tasks, users
from app.core.config import get_settings
from app.db.session import Base, engine
from app.mcp.server import mcp


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.run_migrations_on_startup:
        alembic_cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
    if settings.create_tables_on_startup:
        Base.metadata.create_all(bind=engine)
    async with mcp.session_manager.run():
        yield


app = FastAPI(title=get_settings().app_name, lifespan=lifespan)

app.include_router(users.router)
app.include_router(api_keys.router)
app.include_router(projects.router)
app.include_router(tasks.router)

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# The MCP SDK owns the JSON-RPC route under this mount. Clients connect to
# `http://localhost:8000/mcp` with `Authorization: Bearer <API_KEY>`.
app.mount("/mcp", mcp.streamable_http_app())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(static_dir / "index.html")
