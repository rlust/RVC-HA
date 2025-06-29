# HA MCP Agent

A scalable, agentic Home Assistant MCP (Master Control Program) API service built with FastAPI and Pydantic v2.

## Technology Stack
- **Language:** Python 3.11+
- **Framework:** FastAPI (async, type-safe API layer)
- **Data Validation:** Pydantic v2
- **Database:** Async database (asyncpg for PostgreSQL, aiomysql for MySQL, SQLAlchemy 2.0 ORM support)
- **Web Server:** Uvicorn (ASGI server)
- **Testing:** Pytest, HTTPX
- **Dependency Management:** Poetry
- **Protocols:** WebSocket (for real-time updates), HTTP/HTTPS (REST endpoints)
- **Security:** TLS 1.2+ for all network traffic, secure credential storage (future: platform-specific secure storage)
- **Caching:** Local cache (future: SQLite or Redis for device metadata and preferences)

## Architectural Patterns
- Functional, modular design (favor functions over classes)
- RORO (Receive an Object, Return an Object) pattern
- Early returns for error handling (guard clauses)
- Pydantic models for all input/output validation
- Async for all I/O-bound operations
- Role-based access control (future)

## Project Structure
- `main.py` — FastAPI app entrypoint
- `ha_mcp_agent/api/` — Route definitions (device, automation, auth)
- `ha_mcp_agent/core/` — Core logic (MCP client, cache, event handling)
- `ha_mcp_agent/models/` — Pydantic models and DB schemas
- `ha_mcp_agent/utils/` — Utility functions (security, websocket, helpers)
- `ha_mcp_agent/static/` — Static files (for web UI, if needed)
- `ha_mcp_agent/templates/` — Jinja2 templates (if using server-side rendering)
- `tests/` — Pytest-based tests

## Purpose
This project serves as an agentic API layer for Home Assistant MCP integrations, providing robust, type-safe, and scalable endpoints for smart home automation.

## Dependency Reference
All dependencies are managed in `pyproject.toml` (Poetry):
- fastapi, pydantic, uvicorn, asyncpg, sqlalchemy, pytest, httpx

## Next Steps
- Implement core communication layer and device discovery (see requirements.md for full plan).
