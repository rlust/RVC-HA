# RVC Light Control Commands

This document contains MQTT commands for controlling various lights in the RV system.

## Available Light Devices

All lights use the MQTT topic pattern: `RVC/DC_DIMMER_COMMAND_2/{instance}`

### Bedroom Area

| Instance | Device Name |
|----------|-------------|
| 25 | Bed Ceiling Lights A |
| 26 | Bed Ceiling Lights B |
| 27 | Bed Accent |
| 28 | Bed Vanity |
| 56 | Bed Reading |

### Bathroom Areas

| Instance | Device Name |
|----------|-------------|
| 30 | Rear Bath Ceiling |
| 31 | Rear Bath Lavatory Lights |
| 32 | Rear Bath Accent |
| 33 | Mid Bath Ceiling |
| 34 | Mid Bath Accent |

### Living Room Area

| Instance | Device Name |
|----------|-------------|
| 36 | Living Edge |
| 37 | Living Room Ceiling A |
| 38 | Living Room Ceiling B |
| 39 | Living Room Accent A |
| 40 | Living Room Accent B |
| 41 | Sofa Ceiling |

### Kitchen & Dining Area

| Instance | Device Name |
|----------|-------------|
| 42 | Kitchen Ceiling |
| 45 | Dinette |
| 46 | Sink |

### Entry & Common Areas

| Instance | Device Name |
|----------|-------------|
| 29 | Courtesy |
| 35 | Entry Ceiling |
| 44 | D/S Slide |
| 47 | Midship |
| 54 | Under Slide |

### Security & Exterior

| Instance | Device Name |
|----------|-------------|
| 53 | Cargo |
| 57 | Security D/S |
| 58 | Security P/S |
| 59 | Security Motion |
| 60 | Porch |


## Command Reference

All commands use the MQTT topic pattern: `RVC/DC_DIMMER_COMMAND_2/{instance}`

Available commands:

| Command Code | Name | Description | Parameters |
|-------------|------|-------------|------------|
| 0 | Set Level | Set brightness level with delay | brightness (0-100%), time (0-240s) |
| 1 | On Duration | Turn on for specified duration | time (0-240s) |
| 2 | On Delay | Turn on after specified delay | time (0-240s) |
| 3 | Off Delay | Turn off after specified delay | time (0-240s) |
| 4 | Stop | Stop current ramp operation | none |
| 5 | Toggle | Toggle light on/off | none |
| 6 | Memory Off | Turn off and save state | none |
| 17 | Ramp Brightness | Ramp to specified brightness | brightness (0-100%) |
| 18 | Ramp Toggle | Toggle with ramping | none |
| 19 | Ramp Up | Gradually increase brightness | none |
| 20 | Ramp Down | Gradually decrease brightness | none |
| 21 | Ramp Up/Down | Cycle brightness up and down | none |
| 33 | Lock | Lock the light controls | none |
| 34 | Unlock | Unlock the light controls | none |
| 49 | Flash | Flash the light | none |
| 50 | Flash Momentarily | Brief flash | none |

## Living Edge Light (Instance 36)

MQTT Topic: `RVC/DC_DIMMER_COMMAND_2/36`

### Example Toggle Command

```json
{
    "command": 5,
    "command definition": "toggle",
    "data": "24FFFA05FF00FFFF",
    "delay/duration": 255,
    "desired level": 125,
    "dgn": "1FEDB",
    "group": "11111111",
    "instance": 36,
    "interlock": "00",
    "interlock definition": "no interlock active",
    "name": "DC_DIMMER_COMMAND_2",
    "timestamp": "1743657200.264909"
}
```

### Command Template

General template for commands:

```json
{
    "command": <command_code>,
    "instance": 36,
    "desired level": <0-255>,  // Optional: for brightness control
    "delay/duration": <0-255>, // Optional: for timed operations
    "name": "DC_DIMMER_COMMAND_2",
    "dgn": "1FEDB"
}
```
