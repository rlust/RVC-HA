# Home Assistant Integration

This directory contains example configurations for integrating RVC-HA with Home Assistant.

## Light Integration

The `homeassistant-lights.yaml` file provides MQTT-based light configurations for all RVC lights in the system. 

### Setup Instructions

1. Copy `homeassistant-lights.yaml` to your Home Assistant configuration directory
2. Add the following to your Home Assistant `configuration.yaml`:
   ```yaml
   mqtt:
     broker: 100.110.189.122  # Your MQTT broker IP
     port: 9001               # Your MQTT broker port
     username: rc             # Your MQTT username
     password: rc             # Your MQTT password

   light: !include lights.yaml
   ```

3. Restart Home Assistant

### Features

- All RVC lights are exposed as dimmable MQTT lights
- Lights are organized into logical groups (Bedroom, Living Room, etc.)
- Full support for:
  - On/Off control
  - Brightness control
  - State reporting
  - Group control

### Light Commands

The lights support the following commands through Home Assistant:
- Turn On
- Turn Off
- Set Brightness (0-100%)
- Toggle

### MQTT Topics

Each light uses these MQTT topics:
- Command Topic: `RVC/DC_DIMMER_COMMAND_2/{instance}/set`
- State Topic: `RVC/DC_DIMMER_STATUS_3/{instance}`
- Brightness Command Topic: `RVC/DC_DIMMER_COMMAND_2/{instance}/set`
- Brightness State Topic: `RVC/DC_DIMMER_STATUS_3/{instance}`

### Troubleshooting

1. Ensure your MQTT broker is running and accessible
2. Verify MQTT credentials in Home Assistant configuration
3. Check Home Assistant logs for any MQTT connection issues
4. Verify the light instances match your RVC configuration
