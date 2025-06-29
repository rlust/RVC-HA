#!/usr/bin/env python3
import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime

# MQTT Broker settings
BROKER = "100.110.189.122"
PORT = 9001
USERNAME = "rc"
PASSWORD = "rc"

# Create log file
with open('sink_light_off.log', 'w') as f:
    f.write(f"Sink light OFF command log created at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

def log_message(message):
    """Write log message to file and console"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_entry = f"[{timestamp}] {message}"
    print(log_entry)
    with open('sink_light_off.log', 'a') as f:
        f.write(log_entry + "\n")

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        log_message("Successfully connected to MQTT broker")
    else:
        log_message(f"Failed to connect, return code: {rc}")

def on_publish(client, userdata, mid):
    log_message(f"Message {mid} published successfully")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        log_message(f"Unexpected disconnection: {rc}")
    else:
        log_message("Disconnected cleanly")

# Initialize MQTT client
log_message("Initializing MQTT client...")
client = mqtt.Client(transport="websockets")
client.username_pw_set(username=USERNAME, password=PASSWORD)
client.on_connect = on_connect
client.on_publish = on_publish
client.on_disconnect = on_disconnect

# Connect to broker
log_message(f"Connecting to broker at {BROKER}:{PORT} using WebSocket...")
client.connect(BROKER, PORT)
client.loop_start()

# Wait for connection
time.sleep(2)

try:
    # Prepare the sink light command to turn OFF
    instance_id = 46  # Sink Light
    topic = f"RVC/DC_DIMMER_COMMAND_2/{instance_id}"
    
    payload = {
        "command": 3,
        "command definition": "off",
        "data": "2EFF6E03FF00FFFF",
        "delay/duration": 255,
        "desired level": 55,
        "dgn": "1FEDB",
        "group": "11111111",
        "instance": instance_id,
        "interlock": "00",
        "interlock definition": "no interlock active",
        "name": "DC_DIMMER_COMMAND_2",
        "timestamp": str(time.time())
    }
    
    # Log the command details
    log_message(f"\n=== MQTT Command Details ===")
    log_message(f"Action: Turn OFF Sink Light (Instance {instance_id})")
    log_message(f"Topic: {topic}")
    log_message(f"Payload: {json.dumps(payload, indent=2)}")
    
    # Convert to string and send
    payload_str = json.dumps(payload)
    log_message(f"Publishing message to {topic}")
    result = client.publish(topic, payload_str)
    result.wait_for_publish()
    
    if result.rc == 0:
        log_message(f"✓ Command successfully published to {topic}")
    else:
        log_message(f"✗ Failed to publish command. Error code: {result.rc}")
        
except Exception as e:
    log_message(f"✗ Error sending command: {str(e)}")

# Wait for message to be published
time.sleep(2)

# Now also try the Home Assistant topic
try:
    # Prepare the sink light command to turn OFF using Home Assistant topic
    ha_topic = "homeassistant/sink_light/control"
    
    log_message(f"\n=== Trying Home Assistant Topic ===")
    log_message(f"Topic: {ha_topic}")
    log_message(f"Payload: {json.dumps(payload, indent=2)}")
    
    # Send the same payload to the Home Assistant topic
    result = client.publish(ha_topic, payload_str)
    result.wait_for_publish()
    
    if result.rc == 0:
        log_message(f"✓ Command successfully published to {ha_topic}")
    else:
        log_message(f"✗ Failed to publish command. Error code: {result.rc}")
        
except Exception as e:
    log_message(f"✗ Error sending command to HA topic: {str(e)}")

# Wait for message to be published
time.sleep(2)

# Disconnect
client.disconnect()
client.loop_stop()
log_message("Script execution completed")
