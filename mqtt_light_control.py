#!/usr/bin/env python3
import paho.mqtt.client as mqtt
import json
import time
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/mqtt_commands.log'),
        logging.StreamHandler()
    ]
)

# MQTT Broker settings
BROKER = "100.110.189.122"
PORT = 9001
USERNAME = "rc"
PASSWORD = "rc"

# Light commands
COMMAND_ON = 1
COMMAND_OFF = 3
COMMAND_SET_BRIGHTNESS = 0
COMMAND_RAMP_UP = 19
COMMAND_RAMP_DOWN = 20

# RVC specific settings
DEFAULT_DATA = "2EFF6E13FF00FFFF"
DEFAULT_DGN = "1FEDB"
DEFAULT_GROUP = "11111111"
DEFAULT_INTERLOCK = "00"
DEFAULT_DELAY = 255

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logging.info("Successfully connected to MQTT broker")
    else:
        logging.error(f"Failed to connect, return code: {rc}")

def on_publish(client, userdata, mid):
    logging.info(f"Message {mid} published successfully")

def on_disconnect(client, userdata, rc):
    if rc != 0:
        print(f"\n✗ Unexpected disconnection: {rc}")
    else:
        print("\n✓ Disconnected cleanly")

def create_mqtt_client():
    try:
        print("\nInitializing MQTT client...")
        client = mqtt.Client(transport="websockets")
        client.username_pw_set(USERNAME, PASSWORD)
        client.on_connect = on_connect
        client.on_publish = on_publish
        client.on_disconnect = on_disconnect
        print(f"Connecting to broker at {BROKER}:{PORT} using WebSocket...")
        client.connect(BROKER, PORT, 60)
        client.loop_start()
        return client
    except Exception as e:
        print(f"\n✗ Error creating MQTT client: {e}")
        return None

def turn_on_light(client, instance_id):
    try:
        topic = f"RVC/DC_DIMMER_COMMAND_2/{instance_id}"
        payload = {
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
        
        # Convert to string for MQTT
        payload_str = json.dumps(payload)
        
        # Log the command details
        log_msg = f"""
=== MQTT Command Details ===
Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Action: Turn ON Light (Instance {instance_id})
Broker: {BROKER}:{PORT}
Topic: {topic}
Payload: {json.dumps(payload, indent=2)}
"""
        logging.info(log_msg)
        
        # Convert to string and send
        payload_str = json.dumps(payload)
        result = client.publish(topic, payload_str)
        result.wait_for_publish()
        
        if result.rc == 0:
            logging.info(f"\n✓ Command successfully published to {topic}")
        else:
            logging.error(f"\n✗ Failed to publish command. Error code: {result.rc}")
            
    except Exception as e:
        logging.error(f"\n✗ Error sending command: {e}")
        
        # Convert to string
        payload_str = json.dumps(payload)
        
        print("\nSending command...")
        
        print(f"\nSending to broker: {BROKER}:{PORT}")
        print(f"Topic: {topic}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        result = client.publish(topic, payload_str)
        result.wait_for_publish()
        
        if result.rc == 0:
            print("\n✓ Command sent successfully!")
            print(f"Message published to {topic}")
        else:
            print(f"\n✗ Failed to send command. Error code: {result.rc}")
    except Exception as e:
        print(f"\n✗ Error sending command: {e}")

def turn_off_light(client, instance_id):
    try:
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
        payload_str = json.dumps(payload)
        print(f"\n=== MQTT Command Details ===")
        print(f"Topic: {topic}")
        print(f"Payload: {payload_str}")
        
        print(f"\nSending to broker: {BROKER}:{PORT}")
        print(f"Topic: {topic}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        result = client.publish(topic, payload_str)
        result.wait_for_publish()
        
        if result.rc == 0:
            print("\n✓ Command sent successfully!")
            print(f"Message published to {topic}")
        else:
            print(f"\n✗ Failed to send command. Error code: {result.rc}")
    except Exception as e:
        print(f"\n✗ Error sending command: {e}")

def set_brightness(client, instance_id, brightness):
    try:
        topic = f"RVC/DC_DIMMER_COMMAND_2/{instance_id}"
        payload = {
            "command": COMMAND_RAMP_UP,
            "command definition": "ramp up",
            "data": DEFAULT_DATA,
            "delay/duration": DEFAULT_DELAY,
            "desired level": brightness,
            "dgn": DEFAULT_DGN,
            "group": DEFAULT_GROUP,
            "instance": instance_id,
            "interlock": DEFAULT_INTERLOCK,
            "interlock definition": "no interlock active",
            "name": "DC_DIMMER_COMMAND_2",
            "timestamp": str(time.time())
        }
        payload_str = json.dumps(payload)
        print(f"\n=== MQTT Command Details ===")
        print(f"Topic: {topic}")
        print(f"Payload: {payload_str}")
        
        print(f"\nSending to broker: {BROKER}:{PORT}")
        print(f"Topic: {topic}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        result = client.publish(topic, payload_str)
        result.wait_for_publish()
        
        if result.rc == 0:
            print("\n✓ Command sent successfully!")
            print(f"Message published to {topic}")
        else:
            print(f"\n✗ Failed to send command. Error code: {result.rc}")
    except Exception as e:
        print(f"\n✗ Error sending command: {e}")

def main():
    # Clear the log file at startup
    with open('logs/mqtt_commands.log', 'w') as f:
        f.write('')
        
    print("\n=== RVC Light Control System ===\n")
    client = create_mqtt_client()
    if not client:
        print("\n✗ Failed to create MQTT client. Exiting.")
        return
    
    # Wait for connection
    time.sleep(2)
    
    while True:
        try:
            print("\nRVC Light Control")
            print("1. Turn On Light")
            print("2. Turn Off Light")
            print("3. Set Brightness")
            print("4. Exit")
            
            choice = input("Enter your choice (1-4): ").strip()
            if not choice:
                print("\n❌ Please enter a choice")
                continue
                
            print(f"\nReceived choice: {choice}")
            
            if choice == "4":
                print("\nDisconnecting from MQTT broker...")
                break
                
            if choice not in ["1", "2", "3"]:
                print("\n❌ Invalid choice! Please enter 1, 2, 3, or 4")
                continue
            
            print("\nEnter light instance ID:")
            print("25 = Bed Ceiling A")
            print("26 = Bed Ceiling B")
            print("46 = Sink Light")
            print("47 = Shower Light")
            
            try:
                instance_id = input("Instance ID (25-47): ").strip()
                if not instance_id:
                    print("\n❌ Please enter an instance ID")
                    continue
                    
                print(f"\nReceived instance ID: {instance_id}")
                
                if not instance_id.isdigit() or not (25 <= int(instance_id) <= 47):
                    print("\n❌ Invalid instance ID! Must be a number between 25 and 47")
                    continue
                
                instance_id = int(instance_id)
                
                if choice == "1":
                    print(f"\nTurning ON light with instance ID {instance_id}...")
                    turn_on_light(client, instance_id)
                elif choice == "2":
                    print(f"\nTurning OFF light with instance ID {instance_id}...")
                    turn_off_light(client, instance_id)
                elif choice == "3":
                    brightness = input("Enter brightness (0-100): ").strip()
                    if not brightness:
                        print("\n❌ Please enter a brightness value")
                        continue
                    if not brightness.isdigit() or not (0 <= int(brightness) <= 100):
                        print("\n❌ Invalid brightness! Must be a number between 0 and 100")
                        continue
                    print(f"\nSetting brightness to {brightness}% for light with instance ID {instance_id}...")
                    set_brightness(client, instance_id, int(brightness))
                
                # Wait a bit to see the effect
                time.sleep(1)
                
            except ValueError as ve:
                print(f"\n❌ Invalid number format: {ve}")
            except Exception as e:
                print(f"\n❌ Error: {e}")
                
        except Exception as e:
            print(f"\n❌ Error: {e}")
    
    print("\nCleaning up...")
    client.loop_stop()
    client.disconnect()
    print("Done!")

if __name__ == "__main__":
    main()
