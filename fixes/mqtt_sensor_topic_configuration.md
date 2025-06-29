# MQTT Sensor Topic Configuration Fix

## Problem

Home Assistant MQTT sensors for the water heater and air conditioner were not appearing in the UI despite seemingly proper configuration. Through investigation, we identified several issues:

1. **Incorrect MQTT Topic Paths**: The actual topic paths being used by the RVC system included instance numbers
2. **Mismatched Data Structure**: The expected fields in the JSON data did not match what was actually being sent
3. **Missing MQTT Broker Authentication**: The external MQTT broker required username/password credentials
4. **Incorrect Broker Connection**: Home Assistant needed to connect to an external broker rather than the local Mosquitto instance

## Solution

We successfully addressed these issues with the following solutions:

1. **Updated MQTT Broker Configuration**:
   - Connected to the external broker at `100.110.189.122:1883` with credentials (username: `rc`, password: `rc`)
   - Added configuration in `configuration.yaml` to ensure consistent connection

2. **Corrected Topic Paths**:
   - Water heater: `RVC/WATERHEATER_STATUS_2/1` (not `RVC/WATERHEATER_STATUS`)
   - Air conditioner: `RVC/AIR_CONDITIONER_STATUS/1`, `/2`, and `/3` for different zones

3. **Updated JSON Field Mapping**:
   - Discovered the water heater sends data like `electric element level` (hex value) rather than temperature
   - Added conversion from hex strings to integers using `| int(0, 16)` in templates

4. **Added Raw Data Sensors**:
   - Created sensors that display the entire JSON payload for both water heater and AC units
   - These help diagnose the actual data structure without needing to check logs

## Implementation Details

### Water Heater Sensor Example

```yaml
- platform: mqtt
  unique_id: water_heater_electric_level
  name: "Water Heater Electric Element Level"
  state_topic: "RVC/WATERHEATER_STATUS_2/1"
  value_template: >-
    {% if value_json is defined and value_json is mapping and 'electric element level' in value_json %}
      {{ value_json['electric element level'] | int(0, 16) }}
    {% else %}
      unknown
    {% endif %}
  state_class: "measurement"
  icon: "mdi:lightning-bolt"
  qos: 0
  expire_after: 600
  force_update: true
  device:
    identifiers:
      - hotwaterheater1
    name: "RV Water Heater"
    manufacturer: "RVC"
    model: "RVC Water Heater"
```

### Raw Data Sensor Example

```yaml
- platform: mqtt
  unique_id: water_heater_raw_1
  name: "Water Heater Raw Data"
  state_topic: "RVC/WATERHEATER_STATUS_2/1"
  value_template: "{{ value_json }}"
  icon: "mdi:code-json"
  qos: 0
  expire_after: 600
  force_update: true
  device:
    identifiers:
      - hotwaterheater1
    name: "RV Water Heater"
    manufacturer: "RVC"
    model: "RVC Water Heater"
```

## Observed Data Structure

The water heater data structure observed from the live MQTT messages:

```json
{
    "data": "0110000000000004",
    "dgn": "1FE99",
    "electric element level": "0000",
    "engine preheat": 0,
    "engine preheat definition": "undefined",
    "instance": 1,
    "max electric element level": "0001",
    "name": "WATERHEATER_STATUS_2",
    "timestamp": "1744045301.142204"
}
```

## Testing and Verification

We verified the solution by:
1. Monitoring the MQTT topics directly through the Home Assistant UI's MQTT listener tool
2. Restarting Home Assistant and confirming the sensors appeared correctly
3. Adding raw data sensors to display the complete JSON payloads

## Lessons Learned

When configuring MQTT sensors for RVC devices:

1. **Direct Topic Inspection**: Always inspect the actual MQTT topics and payload structure directly before configuring sensors
2. **Authentication Details**: Make sure to configure any required MQTT broker authentication credentials
3. **Raw Data Sensors**: Include sensors that display the entire JSON payload during initial setup to aid in troubleshooting
4. **Data Type Handling**: RVC systems may use hex strings for numeric values that need conversion
5. **Instance Numbers**: Topics often include device instance numbers (e.g., `.../1`, `.../2`, etc.)
