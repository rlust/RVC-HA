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
with open('sink_light_test.log', 'w') as f:
    f.write(f"Sink light test log created at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

def log_message(message):
    """Write log message to file and console"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_entry = f"[{timestamp}] {message}"
    print(log_entry)
    with open('sink_light_test.log', 'a') as f:
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

def send_mqtt_command(client, topic, payload):
    """Send an MQTT command and log the details"""
    log_message(f"\n=== MQTT Command Details ===")
    log_message(f"Topic: {topic}")
    log_message(f"Payload: {json.dumps(payload, indent=2)}")
    
    payload_str = json.dumps(payload)
    log_message(f"Publishing message to {topic}")
    result = client.publish(topic, payload_str)
    result.wait_for_publish()
    
    if result.rc == 0:
        log_message(f"✓ Command successfully published to {topic}")
    else:
        log_message(f"✗ Failed to publish command. Error code: {result.rc}")

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
    while True:
        print("\nSink Light Control Test")
        print("1. Turn ON via RVC topic")
        print("2. Turn OFF via RVC topic")
        print("3. Turn ON via Home Assistant topic")
        print("4. Turn OFF via Home Assistant topic")
        print("5. Exit")
        
        choice = input("Enter your choice (1-5): ").strip()
        
        if choice == "5":
            log_message("Exiting...")
            break
            
        # Define the payloads
        instance_id = 46  # Sink Light
        
        turn_on_payload = {
            "command": 19,
            "command definition": "ramp up",
            "data": "2EFF6E13FF00FFFF",
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
        
        turn_off_payload = {
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
        
        # Define the topics
        rvc_topic = f"RVC/DC_DIMMER_COMMAND_2/{instance_id}"
        ha_topic = "homeassistant/sink_light/control"
        
        if choice == "1":
            log_message("Turning ON sink light via RVC topic")
            send_mqtt_command(client, rvc_topic, turn_on_payload)
        elif choice == "2":
            log_message("Turning OFF sink light via RVC topic")
            send_mqtt_command(client, rvc_topic, turn_off_payload)
        elif choice == "3":
            log_message("Turning ON sink light via Home Assistant topic")
            send_mqtt_command(client, ha_topic, turn_on_payload)
        elif choice == "4":
            log_message("Turning OFF sink light via Home Assistant topic")
            send_mqtt_command(client, ha_topic, turn_off_payload)
        else:
            log_message("Invalid choice. Please try again.")
            
except KeyboardInterrupt:
    log_message("Program interrupted by user")
except Exception as e:
    log_message(f"✗ Error: {str(e)}")
finally:
    # Disconnect
    client.disconnect()
    client.loop_stop()
    log_message("Script execution completed")

if __name__ == "__main__":
    pass  # Main execution is in the try/except block above
