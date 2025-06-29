# RVC Light Status Messages

This document describes the MQTT message formats for RVC lighting devices. These messages follow the RV-C protocol for DC dimmer commands and status reports.

## DC Dimmer Status Messages

DC dimmer status messages report the current state and brightness level of lights in the RVC network.

### Topic Format

```text
RVC/DC_DIMMER_STATUS_3/{instance}
```

Where `{instance}` is the unique identifier for the specific light fixture.

### Example Topic (Sink Light - Instance 46)

```text
RVC/DC_DIMMER_STATUS_3/46
```

### Example Status Payload (Light ON)

```json
{
  "data": "2E7C40FCFF0504FF",
  "delay/duration": 255,
  "dgn": "1FEDA",
  "enable status": "11",
  "enable status definition": "enable status is unavailable or not supported",
  "group": "01111100",
  "instance": 46,
  "interlock status": "00",
  "interlock status definition": "interlock command is not active",
  "last command": 5,
  "last command definition": "toggle",
  "load status": "01",
  "load status definition": "operating status is non-zero or flashing",
  "lock status": "00",
  "lock status definition": "load is unlocked",
  "name": "DC_DIMMER_STATUS_3",
  "operating status (brightness)": 32,
  "overcurrent status": "11",
  "overcurrent status definition": "overcurrent status is unavailable or not supported",
  "override status": "11",
  "override status definition": "override status is unavailable or not supported",
  "timestamp": "1743821343.275065"
}
```

### Example Status Payload (Light OFF)

```json
{
  "data": "2E7C00FCFF0300FF",
  "delay/duration": 255,
  "dgn": "1FEDA",
  "enable status": "11",
  "enable status definition": "enable status is unavailable or not supported",
  "group": "01111100",
  "instance": 46,
  "interlock status": "00",
  "interlock status definition": "interlock command is not active",
  "last command": 3,
  "last command definition": "off",
  "load status": "00",
  "load status definition": "operating status is zero",
  "lock status": "00",
  "lock status definition": "load is unlocked",
  "name": "DC_DIMMER_STATUS_3",
  "operating status (brightness)": 0,
  "overcurrent status": "11",
  "overcurrent status definition": "overcurrent status is unavailable or not supported",
  "override status": "11",
  "override status definition": "override status is unavailable or not supported",
  "timestamp": "1743818620.537844"
}
```

## Key Fields for Light Status

| Field Name | Description | Used For |
|------------|-------------|----------|
| `operating status (brightness)` | Current brightness level (0-100) | Brightness level and determining ON/OFF state |
| `load status` | Current load state ("00" = off, "01" = on) | Alternative method for ON/OFF state determination |
| `last command` | Last command received (e.g., 3 = off, 5 = toggle, 19 = ramp up) | Command tracking |
| `instance` | Unique identifier for the light fixture | Addressing specific lights |

## Command Codes for DC Dimmers

| Command Code | Command Definition | Description |
|--------------|-------------------|-------------|
| 3 | off | Turn the light off |
| 5 | toggle | Toggle between on and off states |
| 19 | ramp up | Turn on and/or adjust brightness up |
| 20 | ramp down | Adjust brightness down |
| 0 | no command | No operation |

## Home Assistant Integration

For Home Assistant to properly interpret these messages, the following configuration is used:

```yaml
- schema: json
  name: "Sink"
  unique_id: rvc_sink
  command_topic: "RVC/DC_DIMMER_COMMAND_2/46"
  state_topic: "RVC/DC_DIMMER_STATUS_3/46"
  optimistic: false
  brightness: true
  brightness_scale: 100
  state_value_template: "{% if value_json['operating status (brightness)']|int > 0 %}ON{% else %}OFF{% endif %}"
  brightness_value_template: "{{ value_json['operating status (brightness)']|int }}"
  command_template: >-
    {"command": {% if state == "ON" %}19{% else %}3{% endif %}, 
     "command definition": {% if state == "ON" %}"ramp up"{% else %}"off"{% endif %}, 
     "instance": 46, 
     "desired level": {% if brightness is defined %}{{ brightness }}{% else %}55{% endif %}, 
     "delay/duration": 255}
```
