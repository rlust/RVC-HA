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
client = mqtt.Client(client_id=f"thermostat-set-80f-exact-{int(time.time())}")
if username and password:
    client.username_pw_set(username, password)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
        # After connection, send the command
        send_cooling_80_command()
    else:
        print(f"Connection failed with code {rc}")

def format_data_field(op_mode="0001", fan_mode="00", temp_c=26.9):
    """
    Create the exact data field format based on the sample status message
    Format appears to be: op_mode + fan_mode + temp_codes
    Sample from 80.4°F status: "0001647E257E2500"
    """
    # Convert temp_c to hex string representation (with 2 decimals)
    # Multiply by 10 to preserve 1 decimal place in the integer conversion
    temp_int = int(temp_c * 10)
    
    # Format as hex (e.g., 26.9°C → 10d → "6d")
    temp_hex = format(temp_int, 'x')
    
    # Replicate the pattern from the sample data for 80.4°F/26.9°C
    # In the sample "0001647E257E2500", we see repeated values:
    # - 7E appears to be related to the setpoint (likely high byte)
    # - 25 appears to be related to the setpoint (likely low byte)
    # Let's encode it similarly
    
    # Convert the first two bytes "0001" directly (operating mode)
    # The next byte "64" appears constant, possibly a flag or control byte
    # Then the temp related bytes (7E and 25)
    # Finally replicated bytes and trailing 00
    
    data = f"{op_mode}64{temp_hex}{temp_hex}25{temp_hex}00"
    
    return data.upper()

def send_cooling_80_command():
    # Target temperature and settings
    temp_f = 80.0
    temp_c = round((temp_f - 32) * 5/9, 1)  # Convert F to C
    op_mode = "0001"  # cool
    fan_mode = "00"   # auto
    
    # Create the data field using the exact pattern from your example
    data_field = format_data_field(op_mode, fan_mode, temp_c)
    
    # Create command payload 
    payload = {
        "data": data_field,  # Using properly formatted data field
        "dgn": "1FEF9",      # Command DGN
        "fan mode": "00",
        "fan mode definition": "auto",
        "fan speed": 50,      # Match the 50 value from status
        "instance": 0,
        "name": "THERMOSTAT_COMMAND_1",
        "operating mode": "0001",
        "operating mode definition": "cool",
        "schedule mode": "00", 
        "schedule mode definition": "disabled", 
        "setpoint temp cool": temp_c,
        "setpoint temp cool F": temp_f,
        "setpoint temp heat": temp_c,       # Match heat to cool setpoint as in status
        "setpoint temp heat F": temp_f,     # Match heat to cool setpoint as in status
        "timestamp": str(time.time())
    }
    
    # Publish to MQTT
    print(f"Sending command with data field: {data_field}")
    print(f"Full payload: {json.dumps(payload, indent=2)}")
    client.publish(command_topic, json.dumps(payload))
    print(f"Command sent to set front AC to cool at 80°F ({temp_c}°C)")
    
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
