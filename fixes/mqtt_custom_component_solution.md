# Home Assistant MQTT Custom Component Solution

## Problem

Home Assistant was using a legacy platform-based approach for MQTT sensors, which is no longer supported in newer Home Assistant versions. This caused errors like:

```
The mqtt platform for the sensor integration does not support platform setup. Please remove it from your config.
```

Users were forced to use the UI to manually create all MQTT sensor entities, which is time-consuming and doesn't support version control.

## Solution

We created a custom component called `rvc_mqtt` that allows YAML-based configuration of MQTT sensors while being compatible with newer Home Assistant versions. This approach:

1. Restores the ability to define sensors in YAML configuration files
2. Allows for version control of sensor configurations
3. Maintains backward compatibility with older sensor configurations
4. Avoids the need to manually create sensors through the UI

## Implementation Details

### 1. Custom Component Structure

We created a proper Home Assistant custom component with the following structure:

```
homeassistant/custom_components/rvc_mqtt/
├── __init__.py
├── manifest.json
├── sensor.py
└── rvc_sensors.yaml
```

### 2. Configuration Changes

Updated the main `configuration.yaml` to use the custom component:

```yaml
# RVC MQTT custom component for sensors
rvc_mqtt: !include custom_components/rvc_mqtt/rvc_sensors.yaml
```

### 3. YAML Sensor Configuration

In `rvc_sensors.yaml`, we can now define MQTT sensors using the familiar YAML syntax:

```yaml
sensor:
  - platform: mqtt
    unique_id: fresh_water_tank_level_relative
    name: "Fresh Water Tank Level"
    state_topic: "RVC/TANK_STATUS/0"
    value_template: >-
      {% if value_json is defined and value_json is mapping and 'relative level' in value_json %}
        {{ value_json['relative level'] }}
      {% else %}
        unknown
      {% endif %}
    # ... additional configuration
```

## How It Works

The custom component:

1. Registers itself as a Home Assistant integration
2. Parses the sensor configuration from YAML
3. Creates MQTT sensor entities using the Home Assistant MQTT API
4. Handles all the subscription to MQTT topics, value templates, and state updates

## Supported Features

- All standard MQTT sensor configuration options
- Value templates with JSON parsing
- Device information grouping
- Unit of measurement, device class, and state class
- Availability monitoring
- Expiration timing

## Example: Tank Level Sensor

For the fresh water tank sensor with this JSON structure:

```json
{
  "absolute level": 65535,
  "data": "00051CFFFFFFFFFF",
  "dgn": "1FFB7",
  "instance": 0,
  "instance definition": "fresh water",
  "name": "TANK_STATUS",
  "relative level": 5,
  "resolution": 28,
  "tank size": 65535,
  "timestamp": "1744046511.077755"
}
```

We created a sensor that:
- Shows the relative level as a percentage
- Has the appropriate water-percent icon
- Groups with the tank device information
- Shows a raw data view for debugging

## Benefits

1. **Maintainability**: All sensor configurations are in version-controlled YAML files
2. **Debugging**: Raw data sensors help troubleshoot data format issues
3. **Consistency**: Sensors follow a consistent configuration pattern
4. **Longevity**: Works with newer Home Assistant versions despite platform changes

## Future Improvements

- Add more RVC-specific sensor types
- Expand to include other entity types (binary_sensor, switch, etc.)
- Add auto-discovery for RVC devices based on MQTT topic patterns
