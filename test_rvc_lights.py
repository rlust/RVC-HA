#!/usr/bin/env python3
"""
Test script for RVC Lights integration.
This will publish MQTT messages to simulate RVC light status and commands.
"""
import argparse
import json
import logging
import time
from paho.mqtt import client as mqtt_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
_LOGGER = logging.getLogger("rvc_test")

# MQTT Settings
MQTT_BROKER = "localhost"
MQTT_PORT = 1883
MQTT_CLIENT_ID = "rvc_test_client"
MQTT_USERNAME = None
MQTT_PASSWORD = None

# RVC Topics
RVC_STATUS_TOPIC_PREFIX = "RVC/DC_DIMMER_STATUS_3" 
RVC_DIRECT_COMMAND_TOPIC = "RVC/DIRECT_COMMAND"

# Predefined lights with friendly names (from const.py)
RVC_LIGHTS = {
    25: "Bed Ceiling Lts A",
    26: "Bed Ceiling Lts B",
    27: "Bed Accent",
    28: "Bed Vanity",
    29: "Courtesy",
    30: "RR Bath Ceiling",
    31: "RR Bath Lav Lts",
    32: "RR Bath Accent",
    33: "Mid Bath Ceiling",
    34: "Mid Bath Accent",
    35: "Entry Ceiling",
    36: "Living Edge",
    37: "Livrm Ceiling A",
    38: "Livrm Ceiling B",
    39: "Livrm Accent A",
    40: "Livrm Accent B",
    41: "Sofa Ceiling",
    42: "Kitchen Ceiling",
    44: "D/S Slide",
    45: "Dinette",
    46: "Sink",
    47: "Midship",
    49: "Door Awning Extend",
    50: "Door Awning Retract",
    51: "Awning D/S",
    52: "Awning P/S",
    53: "Cargo",
    54: "Under Slide",
    56: "Bed Reading",
    57: "Security D/S",
    58: "Security P/S",
    59: "Security Motion",
    60: "Porch"
}

def connect_mqtt():
    """Connect to MQTT broker."""
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            _LOGGER.info("Connected to MQTT Broker!")
        else:
            _LOGGER.error(f"Failed to connect, return code {rc}")
    
    # Set up the client with proper version handling
    try:
        # Try modern client with callback_api_version parameter (paho-mqtt >= 2.0)
        client = mqtt_client.Client(client_id=MQTT_CLIENT_ID, callback_api_version=mqtt_client.CallbackAPIVersion.VERSION1)
    except (TypeError, AttributeError):
        # Fall back to older client version (paho-mqtt < 2.0)
        client = mqtt_client.Client(MQTT_CLIENT_ID)
        
    # Set credentials if provided
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    # Set up the callback
    client.on_connect = on_connect
    
    # Connect
    client.connect(MQTT_BROKER, MQTT_PORT)
    return client

def publish_status(client, instance, state=True, brightness=100):
    """Publish light status for discovery."""
    topic = f"{RVC_STATUS_TOPIC_PREFIX}/{instance}"
    
    # Create payload in the format expected by custom component
    # These are the exact field names expected in our component's const.py
    payload = {
        "name": "DC_DIMMER_STATUS_3",  # Required for discovery
        "data": "2E7C40FCFF0504FF",  # Example data field
        "delay/duration": 255,
        "destination address": 0,
        "dimmer mode": 255,
        "instance": instance,
        "load status": "Active" if state else "Inactive",  # matches LOAD_STATUS_KEY
        "operating status (brightness)": brightness if state else 0,  # matches STATE_KEY
        "source address": 0
    }
    
    # Publish message
    result = client.publish(topic, json.dumps(payload))
    status = result[0]
    if status == 0:
        _LOGGER.info(f"Published status to {topic}: {instance} - {brightness}% {'ON' if state else 'OFF'}")
    else:
        _LOGGER.error(f"Failed to publish to {topic}")

def subscribe_commands(client):
    """Subscribe to command topics to see what's being sent."""
    def on_message(client, userdata, msg):
        _LOGGER.info(f"Received on {msg.topic}: {msg.payload.decode()}")
    
    client.subscribe(RVC_DIRECT_COMMAND_TOPIC)
    client.on_message = on_message
    _LOGGER.info(f"Subscribed to {RVC_DIRECT_COMMAND_TOPIC}")

def simulate_all_lights(client):
    """Publish status for all predefined lights."""
    for instance, name in RVC_LIGHTS.items():
        _LOGGER.info(f"Publishing status for {name} (instance {instance})")
        publish_status(client, instance)
        time.sleep(0.5)  # Small delay between messages

def run():
    """Run the test script."""
    # Declare global variables at the start of the function
    global MQTT_BROKER, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD
    
    parser = argparse.ArgumentParser(description="Test RVC Lights integration with MQTT")
    parser.add_argument('--broker', type=str, default=MQTT_BROKER, help='MQTT broker address')
    parser.add_argument('--port', type=int, default=MQTT_PORT, help='MQTT broker port')
    parser.add_argument('--username', type=str, help='MQTT username')
    parser.add_argument('--password', type=str, help='MQTT password')
    args = parser.parse_args()
    
    # Update globals with command line args
    MQTT_BROKER = args.broker
    MQTT_PORT = args.port
    MQTT_USERNAME = args.username
    MQTT_PASSWORD = args.password
    
    # Connect to MQTT
    client = connect_mqtt()
    client.loop_start()
    
    # Subscribe to command topics
    subscribe_commands(client)
    
    try:
        # Simulate discovery of all lights
        _LOGGER.info("Simulating status of all predefined RVC lights...")
        simulate_all_lights(client)
        
        # Keep running to listen for commands
        _LOGGER.info("Listening for commands. Press Ctrl+C to exit.")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        _LOGGER.info("Stopping test script...")
    finally:
        client.loop_stop()
        client.disconnect()
        _LOGGER.info("Disconnected from MQTT broker")

if __name__ == "__main__":
    run()
