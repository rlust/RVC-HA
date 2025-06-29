from fastapi import FastAPI
from fastapi.responses import JSONResponse

from ha_mcp_agent.api.device import router as device_router

app = FastAPI(title="HA MCP Agent")

app.include_router(device_router)

@app.get("/health", response_class=JSONResponse)
def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}
