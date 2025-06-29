# Home Assistant MQTT Light Status Field Fix

## Problem

Home Assistant MQTT light integration was failing to properly interpret the status messages from the RVC lighting system because:

1. We were looking for the wrong field name in the MQTT status message JSON
2. The format of the MQTT status message needed special handling to extract brightness values and determine on/off states

## Example Status Messages

### Light OFF Status:
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

### Light ON Status:
```json
{
  "data": "2E7C40FCFF1304FF",
  "delay/duration": 255,
  "dgn": "1FEDA",
  "enable status": "11",
  "enable status definition": "enable status is unavailable or not supported",
  "group": "01111100",
  "instance": 46,
  "interlock status": "00",
  "interlock status definition": "interlock command is not active",
  "last command": 19,
  "last command definition": "ramp up",
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
  "timestamp": "1743818973.314492"
}
```

## Solution

1. Updated all light configurations to use the correct field name `operating status (brightness)` instead of `level`:

```yaml
state_template: "{% if value_json['operating status (brightness)']|int > 0 %}ON{% else %}OFF{% endif %}"
brightness_template: "{{ value_json['operating status (brightness)']|int }}"
```

2. Added `state_template` to each light to properly interpret the on/off state based on the brightness value

3. Added proper integer filter with the `|int` Jinja2 filter to ensure numerical interpretation of the brightness value

4. Fixed all command templates to send proper command codes for "ramp up" (19) and "off" (3) based on the RVC command reference

## Key Configuration Changes

```yaml
- platform: mqtt
  schema: template
  name: "Sink"
  unique_id: rvc_sink
  command_topic: "RVC/DC_DIMMER_COMMAND_2/46"
  state_topic: "RVC/DC_DIMMER_STATUS_3/46"
  optimistic: true
  state_template: "{% if value_json['operating status (brightness)']|int > 0 %}ON{% else %}OFF{% endif %}"
  brightness_template: "{{ value_json['operating status (brightness)']|int }}"
  command_on_template: >-
    {"command": 19, "command definition": "ramp up", "instance": 46, "desired level": 55, "delay/duration": 255}
  command_off_template: >-
    {"command": 3, "command definition": "off", "instance": 46, "desired level": 0, "delay/duration": 255}
  brightness_command_topic: "RVC/DC_DIMMER_COMMAND_2/46"
  brightness_command_template: >-
    {"command": 19, "command definition": "ramp up", "instance": 46, "desired level": {{ value }}, "delay/duration": 255}
```

## Notes for Future Maintenance

1. All MQTT status messages from RVC use `operating status (brightness)` for the brightness value
2. The brightness value ranges from 0-100
3. The `load status` field can also be used to determine on/off status ("00" = off, "01" = on)
4. Command codes are documented in the `light_control_commands.md` file
5. MQTT topics follow the pattern:
   - Commands: `RVC/DC_DIMMER_COMMAND_2/{instance}`
   - Status: `RVC/DC_DIMMER_STATUS_3/{instance}`
