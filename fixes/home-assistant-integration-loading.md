# Home Assistant Integration Loading Issue

## Problem
The RV-C integration was not loading properly in Home Assistant. The integration was not visible in the UI and was not processing MQTT messages correctly.

## Root Causes
1. The `__init__.py` file wasn't properly handling YAML configuration
2. Platform definitions in `const.py` were not using Home Assistant's Platform enum
3. MQTT sensor templates didn't match the actual JSON payload structure

## Solution
1. Updated `__init__.py` to:
   - Properly handle YAML configuration using `async_setup`
   - Load platforms using `async_load_platform`
   - Set up data structures in Home Assistant

2. Updated `const.py` to:
   - Use Home Assistant's Platform enum
   - Properly define supported platforms

3. Fixed MQTT sensor templates to match JSON structure:
   - Changed `value_json.water_temperature_F` to `value_json['water temperature F']`
   - Updated HVAC sensor to use fan speed instead of non-existent temperature field

## Verification
1. Check Home Assistant logs for component loading
2. Verify MQTT messages are being processed
3. Confirm sensors appear in Home Assistant UI
