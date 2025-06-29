# Thermostat Temperature Constraints 

## Issue
When attempting to set specific temperatures for the front AC unit via MQTT commands, we discovered that not all temperature values are accepted by the system. For example, when trying to set exactly 80°F, the system would consistently revert to 82.4°F.

## Investigation
We attempted multiple approaches to set a specific temperature:

1. Using standard JSON payloads with the correct setpoint calculation
2. Copying exact data fields from known working examples
3. Analyzing and recreating the binary data field format 
4. Modifying various parameters including the schedule mode

Despite these efforts, the thermostat would only accept certain predefined temperature values.

## Solution
The solution is to use the proven configuration that works reliably:
```python
def set_cooling_82_auto():
    setpoint_cool = calculate_cool_setpoint(82.0)
    
    payload = {
        "data": "00FFFFFFFFFAFFFF",
        "dgn": "1FEF9",
        "fan mode": "00",  # Auto
        "fan mode definition": "auto",
        "schedule mode": "00",
        "schedule mode definition": "disabled",
        "operating mode": "0001",  # Cool
        "operating mode definition": "cool",
        "setpoint temp cool": setpoint_cool,
        "setpoint temp cool F": 82.0
    }
    
    client.publish(command_topic, json.dumps(payload))
```

## Findings
The RV-C thermostat appears to have predefined temperature settings or steps it will accept. This is common in RV systems to maintain efficiency and simplify control interfaces. The thermostat accepts our commands but adjusts the temperature to the nearest valid value (in this case 82.4°F).

This behavior should be documented in the UI to set proper user expectations about available temperature options.
