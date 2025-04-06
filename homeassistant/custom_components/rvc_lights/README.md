# RVC Lights Custom Component for Home Assistant

This custom component provides a better way to integrate RVC light fixtures with Home Assistant. It translates MQTT messages from RVC's light control system (DC dimmers) into Home Assistant entities.

## Features

- Creates proper light entities in Home Assistant from RVC DC dimmer devices
- Supports brightness control
- Handles state update via MQTT status messages
- Uses the documented RVC command and status message format
- **Auto-discovery** of RVC lights from MQTT messages
- **Custom services** for advanced light control

## Installation Instructions

1. Copy the `rvc_lights` folder to your Home Assistant `custom_components` directory:

   ```bash
   cp -r /Users/randylust/RVC-HA/custom_components/rvc_lights /path/to/your/homeassistant/config/custom_components/
   ```

2. Restart Home Assistant to load the new component.

3. Add your RVC lights to your `configuration.yaml` file.

## Configuration

To use the RVC Lights component, add the following to your `configuration.yaml` file:

```yaml
# Enable the component with auto-discovery (default):
rvc_lights:
  enable_auto_discovery: true  # Optional, defaults to true

# For manual configuration (optional if using auto-discovery):
light:
  - platform: rvc_lights
    name: "Sink Light"
    unique_id: rvc_sink_light
    instance: 46
    default_brightness: 55
    optimistic: false
  
  - platform: rvc_lights
    name: "Living Room Light"
    unique_id: rvc_living_room_light
    instance: 1
    default_brightness: 70
    optimistic: false
```

### Configuration Options

| Option | Description |
|--------|-------------|
| `name` | Friendly name for the light entity |
| `unique_id` | A unique identifier for the light entity |
| `instance` | The RVC instance number for the light (from your RVC system) |
| `default_brightness` | Default brightness level (1-100) to use when turning on (default: 55) |
| `optimistic` | Whether to update state optimistically (default: false) |

## Technical Details

This component:
1. Subscribes to status messages on topic `RVC/DC_DIMMER_STATUS_3/{instance}`
2. Publishes commands to topic `RVC/DC_DIMMER_COMMAND_2/{instance}`
3. Uses "operating status (brightness)" from status messages to determine brightness and on/off state
4. Uses command code 19 (ramp up) for "on" and 3 (off) for "off"

## Auto-Discovery

With auto-discovery enabled, the component will automatically:

1. Listen for messages on `RVC/DC_DIMMER_STATUS_3/+` topics
2. Create light entities for each unique instance number detected
3. Name lights as "RVC Light {instance}" (you can rename them later in the UI)


This means you don't need to manually configure each light if you don't want to.

## Custom Services

This component provides several custom services for advanced control:

| Service | Description | Parameters |
|---------|-------------|------------|
| `rvc_lights.toggle` | Toggle lights on/off | `entity_id` |
| `rvc_lights.ramp_up` | Turn on/brighten lights | `entity_id`, `brightness_level` (1-100), `delay_duration` (0-255) |
| `rvc_lights.ramp_down` | Dim lights | `entity_id`, `brightness_level` (1-100), `delay_duration` (0-255) |
| `rvc_lights.send_command` | Send a custom RVC command | `entity_id`, `command` (0-255), `brightness_level` (optional, 0-100), `delay_duration` (0-255) |

### Example Service Call

```yaml
service: rvc_lights.ramp_up
target:
  entity_id: light.sink_light
data:
  brightness_level: 75
  delay_duration: 255
```

## Troubleshooting

If your lights aren't working properly:

1. Check that MQTT is properly configured in Home Assistant
2. Verify that the instance numbers match your RVC system
3. Check the Home Assistant logs for any error messages
4. Ensure your RVC-to-MQTT bridge is running and publishing to the correct topics
5. Check the format of the MQTT messages matches what's expected (see rvcstateslights.md)

