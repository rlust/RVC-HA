import paho.mqtt.client as mqtt
import json
import time

# MQTT Configuration
broker_ip = "100.110.189.122"
port = 1883
username = "rc"
password = "rc"
command_topic = "RVC/THERMOSTAT_COMMAND_1/0"  # Topic for front thermostat

# Function to calculate cool setpoint value (F to C conversion)
def calculate_cool_setpoint(temp_f):
    return round((temp_f - 32) * 5/9, 1)  # Convert F to C

# Create MQTT client
client = mqtt.Client(client_id=f"thermostat-set-80f-{int(time.time())}")
if username and password:
    client.username_pw_set(username, password)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
        # After connection, send the command
        send_cooling_80_command()
    else:
        print(f"Connection failed with code {rc}")

def send_cooling_80_command():
    # Create command payload based on exact format provided
    temp_f = 80.0
    setpoint_cool = calculate_cool_setpoint(temp_f)  # Will be ~26.7°C
    
    payload = {
        "data": "00FFFFFFFFFAFFFF",  # Command data format
        "dgn": "1FEF9",  # Command DGN
        "fan mode": "00",
        "fan mode definition": "auto",
        "fan speed": "n/a",
        "instance": 0,
        "name": "THERMOSTAT_COMMAND_1",
        "operating mode": "0001",
        "operating mode definition": "cool",
        "schedule mode": "00",  # Using 00 for disabled as shown in your status
        "schedule mode definition": "disabled", 
        "setpoint temp cool": setpoint_cool,
        "setpoint temp cool F": temp_f,
        "setpoint temp heat": "n/a",
        "setpoint temp heat F": 32,
        "timestamp": str(time.time())
    }
    
    # Publish to MQTT
    print(f"Sending command: {json.dumps(payload, indent=2)}")
    client.publish(command_topic, json.dumps(payload))
    print(f"Command sent to set front AC to cool at 80°F ({setpoint_cool}°C)")
    
    # Wait briefly to ensure message is sent
    time.sleep(1)
    client.disconnect()
    print("Disconnected from MQTT broker")

# Set callback and connect
client.on_connect = on_connect
client.connect(broker_ip, port, 60)

# Start the loop
print("Connecting to MQTT broker...")
client.loop_forever()
