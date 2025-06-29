import asyncio
import json
from typing import AsyncGenerator, Optional, List, Dict, Any
import websockets

# TODO: Replace with config import
MCP_WS_URL = "ws://192.168.100.225:8123/api/websocket"
MCP_API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI1M2FkYmRhOWRiZDE0YTFjODUzNWU0NmEzM2NmYWU4NiIsImlhdCI6MTc0NTI1NTA2NywiZXhwIjoyMDYwNjE1MDY3fQ.C6Fv65Si2QPAkB3erlqJKayntUNN6K9QBG-yzwMPUs8"

class MCPClient:
    def __init__(self, ws_url: str = MCP_WS_URL, token: str = MCP_API_TOKEN):
        self.ws_url = ws_url
        self.token = token
        self.connection: Optional[websockets.WebSocketClientProtocol] = None
        self._lock = asyncio.Lock()
        self._msg_id = 1

    async def connect(self):
        async with self._lock:
            if self.connection:
                return
            self.connection = await websockets.connect(self.ws_url)
            # Authenticate
            await self.connection.send(json.dumps({
                "type": "auth",
                "access_token": self.token
            }))
            auth_resp = await self.connection.recv()
            auth_data = json.loads(auth_resp)
            if auth_data.get("type") != "auth_ok":
                raise RuntimeError(f"Auth failed: {auth_data}")

    async def list_devices(self) -> List[Dict[str, Any]]:
        await self.connect()
        # Home Assistant: get all states (entities)
        msg_id = self._msg_id
        self._msg_id += 1
        await self.connection.send(json.dumps({
            "id": msg_id,
            "type": "get_states"
        }))
        while True:
            resp = await self.connection.recv()
            data = json.loads(resp)
            if data.get("id") == msg_id:
                # Return all entity states
                return data.get("result", [])

    async def send_command(self, command: dict) -> dict:
        await self.connect()
        # Expect command to have: {service, entity_id, domain, service_data}
        msg_id = self._msg_id
        self._msg_id += 1
        payload = {
            "id": msg_id,
            "type": "call_service",
            "domain": command["domain"],
            "service": command["service"],
            "target": {"entity_id": command["entity_id"]},
            "service_data": command.get("service_data", {})
        }
        await self.connection.send(json.dumps(payload))
        while True:
            resp = await self.connection.recv()
            data = json.loads(resp)
            if data.get("id") == msg_id:
                return data

    async def receive_updates(self) -> AsyncGenerator[dict, None]:
        await self.connect()
        while True:
            msg = await self.connection.recv()
            yield json.loads(msg)

    async def subscribe_events(self) -> AsyncGenerator[dict, None]:
        await self.connect()
        # Subscribe to all state_changed events
        msg_id = self._msg_id
        self._msg_id += 1
        await self.connection.send(json.dumps({
            "id": msg_id,
            "type": "subscribe_events",
            "event_type": "state_changed"
        }))
        while True:
            event = await self.connection.recv()
            yield json.loads(event)

# Singleton for use throughout the app
mcp_client = MCPClient()
