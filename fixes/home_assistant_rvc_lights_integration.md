# RVC Lights Integration for Home Assistant

## Problem

Home Assistant's built-in MQTT light integration had several issues when controlling RVC lights:

1. **Configuration Errors**: Invalid options in the MQTT configuration (`broker`, `client_id`, etc.) that are no longer supported in recent Home Assistant versions.
2. **Brightness Control Issues**: The default MQTT light platform didn't correctly handle the RVC brightness values (0-100 scale).
3. **Template Complexity**: The JSON message format from RVC required complex templates to extract state and brightness information.
4. **Maintenance Difficulties**: Configuration changes required editing YAML files with complex templates that were error-prone.

## Solution

We developed a custom component called `rvc_lights` that:

1. **Properly Integrates with RVC**: Directly understands the RVC protocol for DC dimmer controls.
2. **Handles Brightness Properly**: Converts between Home Assistant's 0-255 brightness scale and RVC's 0-100 scale.
3. **Simplifies Configuration**: Requires only the instance number, name, and a few optional parameters.
4. **Uses Proper Entity Structure**: Implements a full LightEntity with all required functionality.

### Implementation Details

The custom component:

- Subscribes to topics like `RVC/DC_DIMMER_STATUS_3/{instance}` to receive status updates
- Publishes commands to `RVC/DC_DIMMER_COMMAND_2/{instance}`
- Interprets the `operating status (brightness)` field for both state and brightness
- Uses command code 19 (ramp up) for turning on and 3 (off) for turning off
- Handles brightness conversion between the two systems

### Key Factors

1. **MQTT Integration**: Relies on Home Assistant's MQTT integration being properly configured
2. **RVC Message Format**: Works with the documented RVC message format in `rvcstateslights.md`
3. **Instance Mapping**: Requires correct instance numbers for each light from the RVC system

### Benefits

- Cleaner, more maintainable configuration
- Better error handling and logging
- Proper integration with Home Assistant's light entities
- Easier updates and changes to light configurations

## Testing

To verify the solution:
1. Install the custom component
2. Add light configurations to `configuration.yaml`
3. Restart Home Assistant
4. Verify lights appear in the UI
5. Test turning lights on/off and adjusting brightness

## Further Improvements

Potential future enhancements:
1. Add UI configuration through integration setup
2. Support for light effects or transitions
3. Group control for multiple lights
4. Auto-discovery of RVC lights from MQTT topics
