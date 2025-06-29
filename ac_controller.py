import tkinter as tk
from tkinter import ttk
import paho.mqtt.client as mqtt
import json
import time

# MQTT Configuration
broker_ip = "100.110.189.122"  # Replace with your MQTT broker IP
port = 1883             # Replace with your port (default is 1883)
username = "rc"  # Replace if authentication is required
password = "rc"  # Replace if authentication is required
command_topic = "RVC/AIR_CONDITIONER_COMMAND/1/set"  # Adjust if different

# MQTT Client Setup
client = mqtt.Client()
if username and password:
    client.username_pw_set(username, password)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
    else:
        print(f"Connection failed with code {rc}")

client.on_connect = on_connect

# Connect to the broker
client.connect(broker_ip, port, 60)
client.loop_start()  # Start the loop in a separate thread

# Function to generate raw RV-C data
def generate_rvc_data(instance, mode, fan_speed, ac_output):
    # Instance (1 byte), Mode (1 byte), Dead Band (2 bytes), Fan Speed (2 bytes), AC Output (2 bytes)
    # Assuming fan_speed and ac_output are 0-100%, scaled to 0-200 (0x00-0xC8)
    fan_hex = int(fan_speed * 2)  # Scale 0-100 to 0-200
    ac_hex = int(ac_output * 2)   # Scale 0-100 to 0-200
    data = f"01{mode:02x}FFFF{fan_hex:02x}{fan_hex:02x}{ac_hex:02x}{ac_hex:02x}"
    return data.upper()

# Function to send MQTT command
def send_command():
    fan_speed = int(fan_slider.get())
    ac_output = int(ac_slider.get())
    mode = mode_var.get()
    
    # Map mode to RV-C value (1 = Manual, adjust as needed)
    mode_map = {"Manual": 1}
    mode_value = mode_map.get(mode, 1)
    
    # Generate JSON payload
    payload = {
        "air conditioning output level": ac_output,
        "data": generate_rvc_data(1, mode_value, fan_speed, ac_output),
        "fan speed": fan_speed,
        "instance": 1,
        "operating mode": mode_value,
        "operating mode definition": mode.lower(),
        "timestamp": str(time.time())
    }
    
    # Publish to MQTT
    client.publish(command_topic, json.dumps(payload))
    status_label.config(text=f"Sent: Fan {fan_speed}%, AC {ac_output}%, Mode {mode}")

# GUI Setup
root = tk.Tk()
root.title("RV-C AC Controller")
root.geometry("400x300")

# Fan Speed Slider
tk.Label(root, text="Fan Speed (%)").pack(pady=5)
fan_slider = tk.Scale(root, from_=0, to=100, orient=tk.HORIZONTAL, length=200)
fan_slider.set(100)  # Default from your MQTT feed
fan_slider.pack()

# AC Output Slider
tk.Label(root, text="AC Output Level (%)").pack(pady=5)
ac_slider = tk.Scale(root, from_=0, to=100, orient=tk.HORIZONTAL, length=200)
ac_slider.set(100)  # Default from your MQTT feed
ac_slider.pack()

# Operating Mode Dropdown
tk.Label(root, text="Operating Mode").pack(pady=5)
mode_var = tk.StringVar(value="Manual")
mode_dropdown = ttk.Combobox(root, textvariable=mode_var, values=["Manual"], state="readonly")
mode_dropdown.pack()

# Send Button
send_button = tk.Button(root, text="Send Command", command=send_command)
send_button.pack(pady=10)

# Status Label
status_label = tk.Label(root, text="Ready")
status_label.pack(pady=5)

# Start the GUI loop
root.mainloop()

# Cleanup on exit
client.loop_stop()
client.disconnect()