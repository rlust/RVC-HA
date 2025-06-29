"""
Device API endpoints: discovery and control
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Any

from ha_mcp_agent.core.mcp_client import mcp_client

router = APIRouter(prefix="/api/devices", tags=["devices"])

class Device(BaseModel):
    device_id: str
    name: str
    type: str
    capabilities: list[str]
    state: str
    brightness: int | None = None

class DeviceCommandRequest(BaseModel):
    device_id: str
    command: dict

class DeviceCommandResponse(BaseModel):
    status: str
    result: Any

@router.get("/", response_model=List[Device])
async def list_devices() -> List[Device]:
    """
    Discover and return all devices from Home Assistant.
    """
    try:
        entities = await mcp_client.list_devices()
        print("[DEBUG] Entity IDs fetched from Home Assistant:")
        for ent in entities:
            print(ent.get("entity_id"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    devices = []
    for ent in entities:
        # Map Home Assistant entity to Device model
        device_id = ent.get("entity_id")
        name = ent.get("attributes", {}).get("friendly_name") or device_id
        domain = device_id.split(".")[0] if device_id else "unknown"
        state = ent.get("state", "unknown")
        brightness = None
        if domain == "light":
            capabilities = ["on", "off", "brightness"]
            brightness = ent.get("attributes", {}).get("brightness")
        elif domain == "switch":
            capabilities = ["on", "off"]
        else:
            capabilities = ["on", "off"]
        devices.append(Device(device_id=device_id, name=name, type=domain, capabilities=capabilities, state=state, brightness=brightness))
    return devices

@router.post("/control", response_model=DeviceCommandResponse)
async def control_device(req: DeviceCommandRequest) -> DeviceCommandResponse:
    """
    Send a control command to a device via MCP client.
    """
    # Expect command: {"action": "on"/"off"/etc, ...}
    try:
        # Map command to Home Assistant service call
        device_id = req.device_id
        domain = device_id.split(".")[0]
        action = req.command.get("action")
        service_data = req.command.get("service_data", {})
        if action in ("on", "off"):
            service = "turn_" + action
        else:
            service = action
        command = {
            "domain": domain,
            "service": service,
            "entity_id": device_id,
            "service_data": service_data
        }
        result = await mcp_client.send_command(command)
        return DeviceCommandResponse(status="success", result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
