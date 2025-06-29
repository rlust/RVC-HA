import tkinter as tk
from tkinter import ttk
import paho.mqtt.client as mqtt
import json
import time

# MQTT Configuration
broker_ip = "100.110.189.122"
port = 1883
username = "rc"
password = "rc"
command_topic = "RVC/THERMOSTAT_COMMAND_1/0"  # Topic for front thermostat

# MQTT Client Setup
client = mqtt.Client(client_id=f"thermostat-controller-{int(time.time())}")
if username and password:
    client.username_pw_set(username, password)

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
        # Subscribe to thermostat status topic to get current state
        client.subscribe("RVC/THERMOSTAT_STATUS_1/0")
    else:
        print(f"Connection failed with code {rc}")

def on_message(client, userdata, msg):
    try:
        print(f"Received message on {msg.topic}")
        if msg.topic == "RVC/THERMOSTAT_STATUS_1/0":
            status = json.loads(msg.payload)
            print(f"Current Status: {status}")
            
            # Analyze setpoint values for debugging
            if "setpoint temp cool" in status and "setpoint temp cool F" in status:
                cool_temp = status["setpoint temp cool"]
                cool_temp_f = status["setpoint temp cool F"]
                ratio = None
                if cool_temp_f != 0:
                    ratio = cool_temp / cool_temp_f
                print(f"DEBUG: Cool setpoint ratio = {ratio} (setpoint: {cool_temp}, F: {cool_temp_f})")
            
            # Update status display
            update_status_display(status)
    except Exception as e:
        print(f"Error processing message: {e}")

client.on_connect = on_connect
client.on_message = on_message

# Connect to the broker
client.connect(broker_ip, port, 60)
client.loop_start()  # Start the loop in a separate thread

# Update status display
def update_status_display(status):
    if status_text:
        status_text.config(state="normal")
        status_text.delete(1.0, tk.END)
        status_text.insert(tk.END, json.dumps(status, indent=2))
        status_text.config(state="disabled")

# Function to calculate cool setpoint value based on observed values
def calculate_cool_setpoint(temp_f):
    # Based on the debug ratio observed from actual thermostat data
    # Ratio = 0.3398058252427184 (28/82.4)
    # The setpoint appears to be the Celsius equivalent of the Fahrenheit value
    return round((temp_f - 32) * 5/9, 1)  # Convert F to C

# Function to send thermostat command with exact format
def send_command():
    # Get temperature from slider (Fahrenheit)
    temp_f = temp_scale.get()
    
    # Calculate the corresponding setpoint value
    setpoint_cool = calculate_cool_setpoint(temp_f)
    
    # Get selected modes
    op_mode = mode_var.get()
    fan_mode = fan_var.get()
    
    # Operating mode codes
    op_mode_codes = {
        "off": "0000",
        "cool": "0001",
        "heat": "0010",
        "auto": "0011",
        "undefined": "1111"
    }
    
    # Fan mode codes
    fan_mode_codes = {
        "auto": "00",
        "low": "01",
        "medium": "10",
        "high": "11",
        "undefined": "11"
    }
    
    # Create payload based on exact format provided by user
    payload = {
        "data": "00FFFFFFFFFAFFFF",
        "dgn": "1FEF9",
        "fan mode": fan_mode_codes.get(fan_mode, "11"),
        "fan mode definition": fan_mode if fan_mode != "undefined" else "undefined",
        "fan speed": "n/a",
        "instance": 0,
        "name": "THERMOSTAT_COMMAND_1",
        "operating mode": op_mode_codes.get(op_mode, "1111"),
        "operating mode definition": op_mode if op_mode != "undefined" else "undefined",
        "schedule mode": "11",
        "schedule mode definition": "undefined",
        "setpoint temp cool": setpoint_cool,
        "setpoint temp cool F": temp_f,
        "setpoint temp heat": "n/a",
        "setpoint temp heat F": 32,
        "timestamp": str(time.time())
    }
    
    # Publish to MQTT
    client.publish(command_topic, json.dumps(payload))
    status_label.config(text=f"Sent: {op_mode} mode at {temp_f}°F with {fan_mode} fan")
    print(f"Command sent: {payload}")

# Function to send exact command for cool at 82°F with auto fan
def set_cooling_82_auto():
    # 82°F with the calculated setpoint based on the formula
    setpoint_cool = calculate_cool_setpoint(82.0)
    
    payload = {
        "data": "00FFFFFFFFFAFFFF",
        "dgn": "1FEF9",
        "fan mode": "00",  # Auto
        "fan mode definition": "auto",
        "fan speed": "n/a",
        "instance": 0,
        "name": "THERMOSTAT_COMMAND_1",
        "operating mode": "0001",  # Cool
        "operating mode definition": "cool",
        "schedule mode": "11",
        "schedule mode definition": "undefined",
        "setpoint temp cool": setpoint_cool,
        "setpoint temp cool F": 82.0,  # 82°F as specified
        "setpoint temp heat": "n/a",
        "setpoint temp heat F": 32,
        "timestamp": str(time.time())
    }
    
    # Update UI to match
    temp_scale.set(82)
    mode_var.set("cool")
    fan_var.set("auto")
    
    # Publish to MQTT
    client.publish(command_topic, json.dumps(payload))
    status_label.config(text="Sent: cool mode at 82°F with auto fan")
    print(f"Command sent: {payload}")

# GUI Setup
root = tk.Tk()
root.title("RV-C Front Thermostat Controller")
root.geometry("500x550")

# Title Label
ttk.Label(root, text="Front Thermostat Control", font=("Helvetica", 14, "bold")).pack(pady=10)

# Frame for temperature control
temp_frame = ttk.LabelFrame(root, text="Temperature Control")
temp_frame.pack(fill="x", expand="yes", padx=10, pady=10)

# Temperature slider (using Fahrenheit directly)
ttk.Label(temp_frame, text="Cooling Setpoint Temperature (°F)").pack(pady=5)
temp_scale = tk.Scale(temp_frame, from_=65, to=90, orient=tk.HORIZONTAL, 
                     length=300, resolution=1)
temp_scale.set(82)  # Default to 82°F as specified
temp_scale.pack(pady=5)

# Mode settings frame
mode_frame = ttk.LabelFrame(root, text="Mode Settings")
mode_frame.pack(fill="x", expand="yes", padx=10, pady=10)

# Operating Mode dropdown
ttk.Label(mode_frame, text="Operating Mode").grid(row=0, column=0, padx=5, pady=5, sticky="w")
mode_var = tk.StringVar(value="cool")  # Default to cool mode
mode_dropdown = ttk.Combobox(mode_frame, textvariable=mode_var, 
                            values=["off", "cool", "heat", "auto", "undefined"], 
                            state="readonly")
mode_dropdown.grid(row=0, column=1, padx=5, pady=5, sticky="w")

# Fan Mode dropdown
ttk.Label(mode_frame, text="Fan Mode").grid(row=1, column=0, padx=5, pady=5, sticky="w")
fan_var = tk.StringVar(value="auto")  # Default to auto fan
fan_dropdown = ttk.Combobox(mode_frame, textvariable=fan_var, 
                           values=["auto", "low", "medium", "high", "undefined"], 
                           state="readonly")
fan_dropdown.grid(row=1, column=1, padx=5, pady=5, sticky="w")

# Buttons frame
buttons_frame = ttk.Frame(root)
buttons_frame.pack(fill="x", expand="yes", padx=10, pady=10)

# Quick set button - "Cool 82°F Auto Fan"
quick_set_button = ttk.Button(buttons_frame, text="Set: Cool 82°F Auto Fan", command=set_cooling_82_auto)
quick_set_button.pack(side=tk.LEFT, padx=10, pady=10, expand=True)

# Custom settings button
send_button = ttk.Button(buttons_frame, text="Send Custom Settings", command=send_command)
send_button.pack(side=tk.RIGHT, padx=10, pady=10, expand=True)

# Status Label
status_label = ttk.Label(root, text="Ready to send command")
status_label.pack(pady=5)

# Current status display
status_frame = ttk.LabelFrame(root, text="Current Thermostat Status")
status_frame.pack(fill="x", expand="yes", padx=10, pady=10)

status_text = tk.Text(status_frame, height=10, width=50)
status_text.pack(padx=5, pady=5)
status_text.config(state="disabled")

# Start the GUI loop
root.mainloop()

# Cleanup on exit
client.loop_stop()
client.disconnect()
