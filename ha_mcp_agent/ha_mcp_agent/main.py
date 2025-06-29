from fastapi import FastAPI
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.requests import Request
import os

from ha_mcp_agent.api.device import router as device_router

app = FastAPI(title="HA MCP Agent")

# Serve static files (including index.html)
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

app.include_router(device_router)

@app.get("/", response_class=HTMLResponse)
def root():
    with open(os.path.join(static_dir, "index.html"), "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/devices/", response_class=HTMLResponse)
def devices_ui():
    with open(os.path.join(static_dir, "index.html"), "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
