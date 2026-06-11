# Laura MVP

A minimal agentic orchestration platform: FastAPI REST APIs plus a database-backed remote MCP server exposed over Streamable HTTP.

## What It Includes

- Users, projects, tasks, and API keys in PostgreSQL via SQLAlchemy.
- Bearer API key auth shared by REST endpoints and MCP tools.
- Remote MCP endpoint at `http://localhost:8000/mcp`.
- MCP tools: `list_projects`, `create_project`, `list_tasks`, `create_task`, `update_task_status`.

## Local Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
docker compose up -d postgres
alembic upgrade head
uvicorn app.main:app --reload
```

If you are testing without Docker, set `DATABASE_URL=sqlite:///./laura.db` in `.env`, then run the same `alembic upgrade head` command.

The dashboard is available at `http://localhost:8000/`.

The REST API docs are available at `http://localhost:8000/docs`.

## Generate A Test API Key

Create a user:

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/users `
  -ContentType "application/json" `
  -Body '{"email":"dev@example.com","name":"Dev User"}'
```

Generate a key for that user:

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/api-keys `
  -ContentType "application/json" `
  -Body '{"user_id":1,"name":"local cursor"}'
```

Copy the `key` value from the response. It is only returned once.

## Test REST Auth

```powershell
$env:BM_KEY = "bm_live_your_key_here"
Invoke-RestMethod -Method Post http://localhost:8000/projects `
  -Headers @{ Authorization = "Bearer $env:BM_KEY" } `
  -ContentType "application/json" `
  -Body '{"name":"Demo Project","description":"Shared context for local agents"}'
```

## Test MCP With Inspector

```powershell
npx -y @modelcontextprotocol/inspector
```

In the Inspector:

- Transport: `Streamable HTTP`
- URL: `http://localhost:8000/mcp`
- Authentication: Bearer token
- Token: your `bm_live_...` API key

After connecting, list tools and call `list_projects`.

## Dashboard

Open `http://localhost:8000/`, paste your `bm_live_...` API key, and click `Use key`.

From there you can:

- Create and select projects.
- Create tasks and update task status.
- View API key metadata and revoke active keys.

## Deployment

Laura is ready to deploy as a containerized FastAPI app. The included files are:

- `Dockerfile`: production container using Python 3.13 and Uvicorn.
- `railway.toml`: Railway build, start, release, and health check config.
- `render.yaml`: Render blueprint with a managed Postgres database.
- `Procfile`: fallback process definitions for platforms that support Procfile.
- `scripts/start_production.sh`: run migrations, then start Uvicorn.

### Production Environment Variables

Set these in your hosting provider:

```text
APP_NAME=Laura MVP
DATABASE_URL=<managed postgres connection string>
CREATE_TABLES_ON_STARTUP=false
RUN_MIGRATIONS_ON_STARTUP=true
MCP_ISSUER_URL=https://your-public-laura-domain
MCP_RESOURCE_SERVER_URL=https://your-public-laura-domain
```

The app accepts common managed Postgres URL formats such as `postgres://...` and normalizes them for SQLAlchemy's `psycopg` driver.

### Railway

1. Push this repo to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Add a managed Postgres service.
4. Set `DATABASE_URL` to the Postgres connection string, or use Railway's variable reference for the Postgres service.
5. Set `MCP_ISSUER_URL` and `MCP_RESOURCE_SERVER_URL` to your Railway app URL.
6. Deploy.

Railway will use `railway.toml`:

```text
releaseCommand = python -m alembic upgrade head
startCommand = uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
```

After deployment, your remote MCP URL is:

```text
https://your-railway-domain/mcp
```

### Render

1. Push this repo to GitHub.
2. In Render, create a Blueprint from `render.yaml`, or create a Web Service manually from the Dockerfile.
3. Create/attach the `laura-postgres` managed database.
4. Set `MCP_ISSUER_URL` and `MCP_RESOURCE_SERVER_URL` to your Render service URL.
5. Run `python -m alembic upgrade head` as a one-off job or via Render deploy hooks before first use.

After deployment, your remote MCP URL is:

```text
https://your-render-domain/mcp
```

## Cursor MCP Configuration

For Cursor, add a remote MCP server entry similar to:

```json
{
  "mcpServers": {
    "laura-local": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer bm_live_your_key_here"
      }
    }
  }
}
```

Some Cursor builds label this as an HTTP or Streamable HTTP server in settings. Use the same URL and Authorization header.
