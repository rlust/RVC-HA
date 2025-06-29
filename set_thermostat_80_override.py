import paho.mqtt.client as mqtt
import json
import time
import struct
import binascii

# MQTT Configuration
broker_ip = "100.110.189.122"
port = 1883
username = "rc"
password = "rc"
command_topic = "RVC/THERMOSTAT_COMMAND_1/0"  # Topic for front thermostat

# Create MQTT client
client = mqtt.Client(client_id=f"thermostat-set-80-override-{int(time.time())}")
if username and password:
    client.username_pw_set(username, password)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
        # After connection, send the command
        send_exact_command()
    else:
        print(f"Connection failed with code {rc}")

def decode_hex_data(hex_string):
    """Analyze the hex data to understand its structure"""
    print(f"Analyzing data field: {hex_string}")
    
    # Break down the data field character by character for visualization
    for i in range(0, len(hex_string), 2):
        if i+2 <= len(hex_string):
            byte = hex_string[i:i+2]
            decimal = int(byte, 16)
            print(f"Position {i//2}: {byte} (decimal: {decimal})")

def encode_temperature(temp_f):
    """
    Convert temperature to the format used in the data field
    Based on analyzing the sample data: "0001647E257E2500"
    """
    # Sample for 80.4°F uses 7E and 25 in positions 3-4 and 5-6
    # Convert to Celsius (which we know is used internally)
    temp_c = (temp_f - 32) * 5/9
    
    # The value 7E (126 decimal) appears to be a scaled form of the temperature
    # For 26.9°C (80.4°F), the encoded value is 7E (126)
    # This gives a scaling factor of approximately 126/26.9 ≈ 4.68
    
    # For 80.0°F (26.67°C), scaled would be 26.67 * 4.68 ≈ 124.8 ≈ 125 (7D in hex)
    # Let's try both exact decimal encoding and the scaling factor approach
    
    # Direct encoding - simply convert to hex
    temp_c_int = int(temp_c * 10)  # Preserve 1 decimal place
    temp_hex_direct = format(temp_c_int, '02x')
    
    # Scaled encoding - multiply by the scaling factor seen in the example
    scaled = int(temp_c * 4.68)
    temp_hex_scaled = format(scaled, '02x')
    
    return temp_hex_direct, temp_hex_scaled

def send_exact_command():
    # Target temperature 
    temp_f = 80.0
    temp_c = round((temp_f - 32) * 5/9, 1)  # 26.7°C
    
    # Analyze the sample data field
    sample_data = "0001647E257E2500"
    decode_hex_data(sample_data)
    
    # Generate temperature hex values
    temp_hex_direct, temp_hex_scaled = encode_temperature(temp_f)
    
    # Try multiple data field formats
    # 1. Replace 7E with our scaled temp (format from successful 80.4°F example)
    data_field1 = f"000164{temp_hex_scaled}25{temp_hex_scaled}2500"
    
    # 2. Use direct temperature encoding
    data_field2 = f"00016410B2510B2500"  # 10B = 267 (26.7°C)
    
    # 3. Raw copy of working data format with minor adjustment
    data_field3 = "0001647D257D2500"  # 7D = 125 (slightly less than 126/7E)
    
    # Create command payload
    payload = {
        "data": data_field3,  # Use third option which is most likely to work
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
    print(f"Sending command with data field: {payload['data']}")
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
