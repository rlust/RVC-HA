# RVC Light Control Via Direct MQTT Commands

## Problem

The Home Assistant API authentication was presenting obstacles to controlling RVC lights. Specifically, instance 46 (Sink Light) was not responding properly through the Home Assistant service API calls.

## Solution

We implemented a direct MQTT command approach that bypasses the Home Assistant API entirely. This solution has two main components:

1. **Direct MQTT Control Scripts**: Created Node.js and shell scripts to send commands directly to the MQTT broker
2. **Simplified Command Format**: Changed from verbose JSON to a simple space-separated format: `instance command brightness`

### Implementation Details

#### 1. Command Structure

The simplified command structure uses three space-separated values:
- `instance`: The RVC light instance number (e.g., 46)
- `command`: The command code (2 = on, 3 = off, 19 = ramp up/dim)
- `brightness`: The brightness level (0-100)

Examples:
- `46 2 100` - Turn on instance 46 at 100% brightness
- `46 3 0` - Turn off instance 46
- `46 19 50` - Set instance 46 to 50% brightness

#### 2. MQTT Implementation

Commands are sent directly to the topic `node-red/rvc/commands` which is subscribed to by the existing MQTT infrastructure. The command format is very simple (just space-separated values), making it easy to debug and modify.

#### 3. Home Assistant Configuration

Updated light entities in Home Assistant to use the simplified command structure by:
- Changing the command_topic to `node-red/rvc/commands`
- Simplifying the command_template to use the space-separated format

#### 4. Control Scripts

Created several scripts for different control methods:
- `rvc_node_red_mqtt.js` - Node.js script for direct MQTT commands
- `rvc_light.sh` - Shell script wrapper for more user-friendly light control

## MQTT Broker Details

- **Address**: 100.110.189.122
- **Port**: 1883
- **Username**: rc
- **Password**: rc
- **Command Topic**: node-red/rvc/commands

## Usage Examples

### Using the Shell Script:
```bash
./rvc_light.sh 46 on      # Turn light 46 on at 100% brightness
./rvc_light.sh 46 off     # Turn light 46 off
./rvc_light.sh 46 dim 50  # Set light 46 to 50% brightness
```

### Using the Node.js Script:
```bash
node rvc_node_red_mqtt.js 46 2 100  # Turn on with command code 2
node rvc_node_red_mqtt.js 46 3 0     # Turn off with command code 3
```

## Benefits

- More reliable control by bypassing Home Assistant API authentication issues
- Direct communication with the RVC hardware via MQTT
- Simplified command format for easier debugging and management
- Works with both Node-RED and Home Assistant interfaces
