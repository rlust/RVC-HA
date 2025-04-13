# RV-C CAN Bus Command Reference

This document describes how to use the `cansend` utility to send commands to RV-C compatible devices on the CAN bus.

## DC_DIMMER_COMMAND_2 (0x1FEDB) - Light Control

The `DC_DIMMER_COMMAND_2` DGN (Data Group Number: 0x1FEDB, decimal: 130779) is used to control dimmers and lights in the RV-C system.

### Command Structure

```
cansend can0 01FEDB24#CCFFPPBBRRTTFFFF
```

Where:
- **can0**: The CAN interface to use
- **01**: Source address (sender ID)
- **FEDB**: DGN (Data Group Number for DC_DIMMER_COMMAND_2)
- **24**: Priority (2) and destination address (4)
- **#**: Separator between CAN ID and data payload
- **CC**: Command code (see table below)
- **FF**: Fixed value (0xFF)
- **PP**: Instance number (instance of light to control, in hex format)
- **BB**: Brightness level (0-100% in hex, FF for default/not applicable)
- **RR**: Ramp rate (used with ramp commands, FF for default)
- **TT**: Transition time (duration for brightness change, FF for default)
- **FFFF**: Fixed value (0xFFFF)

### Command Codes (CC)

| Code | Command | Description |
|------|---------|-------------|
| 00 | Set Brightness | Set to specific level (0-100%) |
| 01 | On | Turn fully on |
| 02 | Off | Turn fully off |
| 03 | Ramp Up | Gradually increase brightness |
| 04 | Ramp Down | Gradually decrease brightness |
| 05 | Stop | Stop an active ramp operation |
| 24 | Toggle | Switch between on and off |

### Brightness Levels (BB)

- **00**: 0% (fully off)
- **32**: 50% brightness
- **64**: 100% brightness
- **FF**: Not applicable (used with toggle/on/off commands)

### Examples

#### Controlling Instance 36

1. **Toggle Light 36**:
   ```
   cansend can0 01FEDB24#24FFFA05FF00FFFF
   ```

2. **Turn Light 36 On**:
   ```
   cansend can0 01FEDB24#01FFFA05FF00FFFF
   ```

3. **Turn Light 36 Off**:
   ```
   cansend can0 01FEDB24#02FFFA05FF00FFFF
   ```

4. **Set Light 36 to 25% Brightness**:
   ```
   cansend can0 01FEDB24#00FFFA051900FFFF
   ```
   Note: 25% = 0x19 in hexadecimal

5. **Set Light 36 to 75% Brightness**:
   ```
   cansend can0 01FEDB24#00FFFA054B00FFFF
   ```
   Note: 75% = 0x4B in hexadecimal

6. **Ramp Light 36 Up Slowly**:
   ```
   cansend can0 01FEDB24#03FFFA050500FFFF
   ```
   Note: 0x05 is a slow ramp rate

7. **Ramp Light 36 Down Slowly**:
   ```
   cansend can0 01FEDB24#04FFFA050500FFFF
   ```

8. **Stop Ramping Light 36**:
   ```
   cansend can0 01FEDB24#05FFFA05FF00FFFF
   ```

#### Controlling Other Instances

Replace the instance value (FA05 in the examples above) with the appropriate value for your target instance:

- Instance 37: `FA06`
- Instance 38: `FA07`
- Instance 39: `FA08`
- Instance 40: `FA09`

For example, to toggle light instance 40:
```
cansend can0 01FEDB24#24FFFA09FF00FFFF
```

### Instance Format in Payload

In RV-C, the instance number appears to be encoded in the 5th and 6th bytes of the payload. In our examples:

- `FA05` for instance 36 (decimal)
- `FA06` for instance 37 (decimal)

The exact format appears to be FA followed by the hex value of the instance number.

## Notes

1. The CAN interface (`can0`) may differ depending on your system configuration.
2. The source address (`01`) may need to be adjusted based on your CAN network configuration.
3. These commands follow the RV-C specification section 6.24.6.
4. To determine the instance number of your lights, you may need to monitor CAN traffic or consult system documentation.

## Converting Decimal to Hexadecimal

For reference, here are some common decimal to hexadecimal conversions for brightness levels:

| Decimal % | Hex |
|-----------|-----|
| 0%        | 00  |
| 10%       | 0A  |
| 20%       | 14  |
| 25%       | 19  |
| 30%       | 1E  |
| 40%       | 28  |
| 50%       | 32  |
| 60%       | 3C  |
| 70%       | 46  |
| 75%       | 4B  |
| 80%       | 50  |
| 90%       | 5A  |
| 100%      | 64  |
