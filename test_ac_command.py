#!/usr/bin/env python3
import requests
import json
import time

# Configuration
HASS_URL = "http://localhost:8123"
ENTITY_ID = "climate.ac_front"  # The entity ID of the front AC
TOKEN = "YOUR_LONG_LIVED_TOKEN"  # Replace with your token if needed, or use UI

# Set headers for API requests
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}

def get_entity_state():
    """Get the current state of the AC entity"""
    try:
        response = requests.get(f"{HASS_URL}/api/states/{ENTITY_ID}", headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error getting entity state: {e}")
        return None

def set_hvac_mode(hvac_mode="cool"):
    """Set the HVAC mode for the AC"""
    data = {"entity_id": ENTITY_ID, "hvac_mode": hvac_mode}
    try:
        response = requests.post(
            f"{HASS_URL}/api/services/climate/set_hvac_mode",
            headers=headers,
            json=data
        )
        response.raise_for_status()
        print(f"Successfully set HVAC mode to {hvac_mode}")
        return True
    except Exception as e:
        print(f"Error setting HVAC mode: {e}")
        return False

def set_fan_mode(fan_mode="high"):
    """Set the fan mode for the AC"""
    data = {"entity_id": ENTITY_ID, "fan_mode": fan_mode}
    try:
        response = requests.post(
            f"{HASS_URL}/api/services/climate/set_fan_mode",
            headers=headers,
            json=data
        )
        response.raise_for_status()
        print(f"Successfully set fan mode to {fan_mode}")
        return True
    except Exception as e:
        print(f"Error setting fan mode: {e}")
        return False

def set_temperature(temperature=72):
    """Set the target temperature for the AC"""
    data = {"entity_id": ENTITY_ID, "temperature": temperature}
    try:
        response = requests.post(
            f"{HASS_URL}/api/services/climate/set_temperature",
            headers=headers,
            json=data
        )
        response.raise_for_status()
        print(f"Successfully set temperature to {temperature}")
        return True
    except Exception as e:
        print(f"Error setting temperature: {e}")
        return False

if __name__ == "__main__":
    # Print current state
    state = get_entity_state()
    if state:
        print(f"Current AC state: {json.dumps(state, indent=2)}")
    
    # Set to cooling mode
    set_hvac_mode("cool")
    time.sleep(2)
    
    # Set fan to high
    set_fan_mode("high")
    time.sleep(2)
    
    # Set temperature to 72°F
    set_temperature(72)
    time.sleep(2)
    
    # Get updated state
    updated_state = get_entity_state()
    if updated_state:
        print(f"Updated AC state: {json.dumps(updated_state, indent=2)}")
    
    print("\nCheck the Home Assistant logs for the MQTT commands being sent!")
