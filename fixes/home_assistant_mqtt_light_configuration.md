# Home Assistant MQTT Light Configuration Fix

## Problem
Home Assistant was generating errors when trying to configure MQTT lights:

1. `Invalid config for 'mqtt' at configuration.yaml`: Configuration error in MQTT integration
2. `extra keys not allowed @ data['brightness']`: Error with the light entity configuration
3. `It's not possible to configure mqtt light by adding platform: mqtt to the light configuration`: Issue with the way MQTT lights were being defined

## Solution

### 1. MQTT Light Configuration Format
- Removed all `platform: mqtt` directives from individual light configurations
- Added `schema: template` to each light entity 
- Changed `brightness` parameter handling:
  - Added `brightness_template: "{{ value_json.level }}"` to extract brightness from incoming MQTT messages
  - Used separate command templates for different functions:
    - `command_on_template` - For turning the light on
    - `command_off_template` - For turning the light off 
    - `brightness_command_template` - For controlling brightness
  - Changed `{{ brightness }}` to `{{ value }}` in templates

### 2. Correct RVC Command Format
Updated the command templates to use the format that works with the RVC system:
```json
{
  "command": 19, 
  "command definition": "ramp up", 
  "instance": XX, 
  "desired level": YY, 
  "delay/duration": 255
}
```

- For ON commands: Command code 19 ("ramp up")
- For OFF commands: Command code 3 ("off")
- Used "desired level" instead of "brightness" 

### 3. MQTT Configuration
Properly configured the MQTT integration in the main configuration.yaml:
```yaml
mqtt:
  broker: 100.110.189.122
  port: 9001
  username: rc
  password: rc
  client_id: home_assistant
  protocol: websockets
  discovery: true
```

## Related Files
- `configuration.yaml` - Main Home Assistant configuration
- `lights.yaml` - MQTT light entities configuration

## References
- [Home Assistant MQTT Light Documentation](https://www.home-assistant.io/integrations/light.mqtt/)
- RVC MQTT command formats documented in `light_control_commands.md`
