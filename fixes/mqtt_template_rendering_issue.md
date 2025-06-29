# MQTT Template Rendering Issue

## Problem Description
Custom component sensors for tank levels (fresh water, black waste, gray waste) were showing in Home Assistant but with "unknown" values, despite MQTT messages being correctly published to the topics.

## Error Logs
```
2025-04-07 18:56:02.024 DEBUG (MainThread) [homeassistant.components.mqtt.client] Received message on RVC/TANK_STATUS/0 (qos=0): b'{"absolute level":65535,"data":"00051CFFFFFFFFFF","dgn":"1FFB7","instance":0,"instance definition":"fresh water","name":"TANK_STATUS","relative level":5,"resolution":28,"tank size":65535,"timestamp":"1744066562.076316"}'
2025-04-07 18:56:02.024 ERROR (MainThread) [custom_components.rvc_mqtt.sensor] Error rendering template for Fresh Water Tank Raw Data: Template.async_render_with_possible_json_value() got an unexpected keyword argument 'default'
```

## Root Cause
In the custom component's RvcMqttSensor class, the template rendering method was being called with a named parameter `default` which isn't supported by the current version of Home Assistant:

```python
rendered_value = self._template.async_render_with_possible_json_value(
    payload, default=""
)
```

## Solution
Modified the template rendering call to use positional parameters instead of named parameters:

```python
rendered_value = self._template.async_render_with_possible_json_value(
    payload, ""
)
```

This simple change allowed the template to correctly process the MQTT payload data and update the sensor values.

## Additional Notes
It's important to check the API compatibility when using functions from the Home Assistant core libraries, as their method signatures may change between versions.
