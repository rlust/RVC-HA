# RV-C MQTT Control Application API Documentation

This document describes the HTTP API endpoints available for interacting with the RV-C MQTT Control Application.

## Authentication

All API endpoints are protected by Basic Authentication. You need to provide the username and password configured in your environment variables:

- `ADMIN_USERNAME` (defaults to "admin")
- `ADMIN_PASSWORD` (defaults to "rvpass")

## Base URL

All API endpoints are available at: `http://localhost:3003`

## Device API Endpoints

### List All Devices

Get a list of all devices and their current states.

- **URL**: `/api/devices`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**: Array of device objects

```json
[
  {
    "deviceId": "dimmer1",
    "deviceType": "dimmer",
    "brightness": 75
  },
  {
    "deviceId": "vent1",
    "deviceType": "vent",
    "position": 50
  }
]
```

### Get Device State

Get the current state of a specific device.

- **URL**: `/api/devices/:deviceId`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**: `:deviceId` - ID of the device
- **Response**: Device object

```json
{
  "deviceId": "dimmer1",
  "deviceType": "dimmer",
  "brightness": 75
}
```

### Send Command to Device

Send a command to a specific device.

- **URL**: `/api/devices/:deviceId/command`
- **Method**: `POST`
- **Auth Required**: Yes
- **URL Parameters**: `:deviceId` - ID of the device
- **Request Body**: Command payload
- **Response**: Command result

#### Request Example:

```json
{
  "command": "setBrightness",
  "brightness": 50
}
```

#### Response Example:

```json
{
  "commandId": "cmd_1a2b3c_4d5e6f",
  "deviceId": "dimmer1",
  "status": "success",
  "message": "Set brightness to 50%"
}
```

### Check Command Status

Check the status of a previously sent command.

- **URL**: `/api/commands/:commandId`
- **Method**: `GET`
- **Auth Required**: Yes
- **URL Parameters**: `:commandId` - ID of the command
- **Response**: Command status object

```json
{
  "commandId": "cmd_1a2b3c_4d5e6f",
  "deviceId": "dimmer1",
  "command": "setBrightness",
  "status": "success",
  "timestamp": "2023-08-15T12:34:56.789Z",
  "result": {
    "success": true,
    "message": "Set brightness to 50%"
  }
}
```

## Legacy API Endpoints

### Send Command (Legacy)

The legacy endpoint for sending commands to devices.

- **URL**: `/api/command`
- **Method**: `POST`
- **Auth Required**: Yes
- **Request Body**: Command with deviceId and payload
- **Response**: Command result

#### Request Example:

```json
{
  "deviceId": "dimmer1",
  "payload": {
    "command": "setBrightness",
    "brightness": 50
  }
}
```

## Logs API Endpoints

### Get Logs

Get a list of event logs.

- **URL**: `/api/logs`
- **Method**: `GET`
- **Auth Required**: Yes
- **Query Parameters**:
  - `limit` (optional): Maximum number of logs to return (default: 100)
  - `offset` (optional): Number of logs to skip (default: 0)
  - `deviceId` (optional): Filter by device ID
  - `deviceType` (optional): Filter by device type
  - `eventType` (optional): Filter by event type
- **Response**: Array of log objects

```json
[
  {
    "id": 1,
    "deviceId": "dimmer1",
    "deviceType": "dimmer",
    "event": "brightness_set",
    "status": "{\"brightness\":50}",
    "timestamp": "2023-08-15T12:34:56.789Z"
  }
]
```

### Export Logs as CSV

Export all logs in CSV format.

- **URL**: `/api/export/logs.csv`
- **Method**: `GET`
- **Auth Required**: Yes
- **Response**: CSV file download

## Supported Device Types and Commands

The API supports the following device types and commands:

### Dimmer Devices

- `setBrightness`: Set the brightness level
  - Required parameters: `brightness` (number, 0-100)
- `turnOn`: Turn the dimmer on
  - Optional parameters: `instance` (number), `delay` (number, 0-255)
- `turnOff`: Turn the dimmer off
  - Optional parameters: `instance` (number)

### Vent Devices

- `setPosition`: Set the vent position
  - Required parameters: `position` (number, 0-100)
- `open`: Open the vent completely
- `close`: Close the vent completely

### Temperature Sensors

- `calibrate`: Set a calibration offset
  - Required parameters: `offset` (number)

### HVAC Systems

- `setMode`: Set the HVAC mode
  - Required parameters: `mode` (string, one of: "off", "cool", "heat", "auto", "fan_only")
- `setFanMode`: Set the fan mode
  - Required parameters: `fanMode` (string, one of: "auto", "on")
- `setTemperature`: Set the temperature setpoint
  - Required parameters: `temperature` (number), `mode` (string, one of: "heat", "cool")

### Water Heaters

- `setMode`: Set the water heater mode
  - Required parameters: `mode` (string, one of: "off", "combustion", "electric", "gas_electric", "automatic")
- `setTemperature`: Set the water heater temperature
  - Required parameters: `temperature` (number, 0-80)

### Generators

- `setCommand`: Send a command to the generator
  - Required parameters: `command` (string, one of: "stop", "start", "manual_prime", "manual_preheat")

## MQTT Integration

The HTTP API interacts with MQTT using the following topics

- Command topics: `RVC/command/:deviceId`
- Status topics: `RVC/status/:deviceId/state`
- Discovery topics: `homeassistant/sensor/:deviceId/config`

When a command is sent via the HTTP API, it is also published to the corresponding MQTT command topic. Device state changes are published to the status topics.

## Error Handling

The API returns appropriate HTTP status codes for different error conditions

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request or parameters
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a JSON object with an `error` field containing a description of the error.

```json
{
  "error": "Missing required parameter: brightness"
}
