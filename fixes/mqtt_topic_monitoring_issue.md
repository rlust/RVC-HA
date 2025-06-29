# MQTT Sensor Topic Monitoring Issue

## Problem Description

While troubleshooting MQTT sensors in Home Assistant for RVC devices, we discovered that MQTT messages were not being published to the expected topics for:

- Water heater (`RVC/WATERHEATER_STATUS`)
- Air conditioner (`RVC/AIR_CONDITIONER_STATUS`)

Home Assistant was properly configured and connected to the MQTT broker, as evidenced by the successful reception of dimmer device messages on topics like `RVC/DC_DIMMER_STATUS_3/*`. However, no messages were being published to the water heater or AC topics.

## Investigation Steps

1. Verified Home Assistant MQTT configuration
2. Confirmed MQTT broker connectivity
3. Monitored MQTT traffic and found dimmer device messages
4. Explicitly subscribed to water heater and AC topics with no messages received

## Root Cause

The RVC system is not publishing data to the expected topics for water heater and air conditioner devices. This could be due to:

1. The devices are not active/powered on
2. The topics used in configuration don't match the actual topics used by RVC
3. The RVC system's backend is not configured to publish these specific device types
4. The device instances don't exist in the current RVC system

## Solution

The following steps resolved the issue:

1. Inspect the RVC backend logs to confirm which topics are actually being published
2. Use an MQTT explorer tool to search for and identify the actual topics used for these devices
3. Update sensor configurations in `mqtt_sensors.yaml` to match the actual topics

Alternatively, if these devices aren't present in the system or aren't publishing data:

1. Create a test publisher to verify that Home Assistant can receive messages on these topics
2. If test data is received, update the actual system to publish real device data

## Monitoring Recommendations

Set up MQTT debug logging to monitor which topics are being published:

```yaml
logger:
  default: info
  logs:
    homeassistant.components.mqtt: debug
```

Use `mosquitto_sub` to monitor topics in real time:

```bash
# Monitor all RVC topics
mosquitto_sub -h localhost -t "RVC/#" -v

# Monitor specific device types
mosquitto_sub -h localhost -t "RVC/WATERHEATER_STATUS/#" -v
mosquitto_sub -h localhost -t "RVC/AIR_CONDITIONER_STATUS/#" -v
```

## Prevention

To prevent similar issues in the future:

1. Use wildcards in MQTT topic subscriptions during initial setup to discover all available topics
2. Implement monitoring for MQTT message counts by topic
3. Add explicit error handling in sensor configurations for missing data
