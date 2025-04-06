# RVC Lights Entity Registration Fix

## Problem

The RVC lights entities were not being properly registered in Home Assistant, despite MQTT messages being received. This was occurring even though discovery messages were being processed by the system.

## Root Causes

1. Missing configuration constant: The `CONF_ENABLE_AUTO_DISCOVERY` was referenced in `__init__.py` but not defined in `const.py`.

2. Incorrect configuration key: The component was looking for an improperly named configuration key.

3. Message format mismatch: The discovery service was checking for a "name" field in the MQTT message payload that wasn't included in the test messages.

4. MQTT message parsing issues: The message handling in the RvcLight entity class wasn't properly parsing different formats of the load status and brightness fields.

## Solution

1. Added the missing `CONF_ENABLE_AUTO_DISCOVERY` constant to `const.py`.

2. Updated the configuration schema and handling in `__init__.py` to use the constant consistently.

3. Updated the platform loading mechanism in `__init__.py` to use the recommended approach:
   ```python
   await hass.async_add_executor_job(
       hass.helpers.discovery.load_platform,
       "light", DOMAIN, {}, config
   )
   ```

4. Enhanced the message handling in `RvcLight` class with more robust parsing and debugging:
   - Added detailed logging for all MQTT message processing
   - Improved load_status parsing to handle different text formats ("Active", "on", "01", etc.)
   - Added error handling for invalid brightness values

5. Ensured the test script included the "name": "DC_DIMMER_STATUS_3" field required for discovery.

6. Added debug logging for the custom component to help with troubleshooting.

## Verification

MQTT messages are now being properly received and parsed, with the "name": "DC_DIMMER_STATUS_3" field triggering the discovery process for new light entities.

## Future Considerations

If entity registration issues persist:
1. Verify that the dispatch signal in discovery.py is properly connecting to the async_discover_device callback in light.py
2. Check if the add_entities function is actually adding the entities to Home Assistant
3. Consider implementing a platform.async_setup_entry instead of platform.setup for newer Home Assistant versions
