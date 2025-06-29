from fastapi.testclient import TestClient
from ha_mcp_agent.main import app

def test_health_check():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_list_devices():
    client = TestClient(app)
    response = client.get("/devices/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert any(d["device_id"] == "light.living_room" for d in data)

def test_control_device_connection_error():
    client = TestClient(app)
    payload = {"device_id": "light.living_room", "command": {"action": "on"}}
    response = client.post("/devices/control", json=payload)
    assert response.status_code == 500
    assert "Connect call failed" in response.json()["detail"]
