import paho.mqtt.client as mqtt
import json
import time

# MQTT Configuration
broker_ip = "100.110.189.122"
port = 1883
username = "rc"
password = "rc"
command_topic = "RVC/THERMOSTAT_COMMAND_1/0"  # Topic for front thermostat

# Create MQTT client
client = mqtt.Client(client_id=f"thermostat-set-exact-{int(time.time())}")
if username and password:
    client.username_pw_set(username, password)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
        # After connection, send the command
        send_exact_command()
    else:
        print(f"Connection failed with code {rc}")

def send_exact_command():
    # Use the exact same data field from the successful 80.4°F example
    data_field = "0001647E257E2500"
    temp_f = 80.4  # Exact temperature from your example
    temp_c = 26.9  # Exact temperature from your example
    
    # Create command payload with exact values from your example
    payload = {
        "data": data_field,
        "dgn": "1FEF9",
        "fan mode": "00",
        "fan mode definition": "auto",
        "fan speed": 50,
        "instance": 0,
        "name": "THERMOSTAT_COMMAND_1",
        "operating mode": "0001",
        "operating mode definition": "cool",
        "schedule mode": "00", 
        "schedule mode definition": "disabled", 
        "setpoint temp cool": temp_c,
        "setpoint temp cool F": temp_f,
        "setpoint temp heat": temp_c,
        "setpoint temp heat F": temp_f,
        "timestamp": str(time.time())
    }
    
    # Publish to MQTT
    print(f"Sending command with exact data field: {data_field}")
    print(f"Full payload: {json.dumps(payload, indent=2)}")
    client.publish(command_topic, json.dumps(payload))
    print(f"Command sent to set front AC to cool at exactly 80.4°F ({temp_c}°C)")
    
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
