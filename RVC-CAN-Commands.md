# RV-C CAN Bus Command Reference

This document describes how to use the `cansend` utility to send commands to RV-C compatible devices on the CAN bus.

## DC_DIMMER_COMMAND_2 (0x1FEDB) - Light Control

The `DC_DIMMER_COMMAND_2` DGN (Data Group Number: 0x1FEDB, decimal: 130779) is used to control dimmers and lights in the RV-C system.

### Command Payload Structure

The actual payload for DC_DIMMER_COMMAND_2 is 8 bytes, sent as a 16-character hex string after the `#` in `cansend`.

**Example (toggle instance 36):**
```
cansend can0 01FEDB24#24FFFA05FF00FFFF
```

**Payload Byte Breakdown:**
| Byte | Example | Description                                |
|------|---------|--------------------------------------------|
| 0    | 24      | Command code (see table below)             |
| 1    | FF      | Reserved / always FF                       |
| 2    | FA      | Instance (high byte, see note below)       |
| 3    | 05      | Instance (low byte, see note below)        |
| 4    | FF      | Brightness (for set commands, else FF)     |
| 5    | 00      | Ramp rate or transition (if used, else 00) |
| 6    | FF      | Reserved / always FF                       |
| 7    | FF      | Reserved / always FF                       |

**Instance Encoding:**
- For instance N, use: `FA` (fixed) then the instance number as a single byte (e.g., 05 for 5, 24 for 36, etc.).
- For instance 36: `FA24`
- For instance 37: `FA25`

**Brightness Encoding:**
- For set brightness, use 0x00 (0%), 0x32 (50%), 0x64 (100%), etc. in byte 4.
- For toggle/on/off/stop, use `FF` in byte 4.

**Command Codes (Byte 0):**
| Code | Command | Description |
|------|---------|-------------|
| 00   | Set Brightness | Set to specific level (see below) |
| 01   | On      | Turn fully on |
| 02   | Off     | Turn fully off |
| 03   | Ramp Up | Gradually increase brightness |
| 04   | Ramp Down | Gradually decrease brightness |
| 05   | Stop    | Stop an active ramp operation |
| 24   | Toggle  | Switch between on and off |

**Notes:**
- The rest of the bytes (except for command, instance, and brightness/ramp) are typically set to FF or 00 as shown.
- Always use your working example as a reference for byte order and values.

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

### Brightness Byte (Byte 4)

- **00**: 0% (fully off)
- **19**: 25%
- **32**: 50% brightness
- **4B**: 75% brightness
- **64**: 100% brightness
- **FF**: Not applicable (used with toggle/on/off/stop)

### Examples

#### Controlling Instance 36 (instance 36 = `FA24`)

1. **Toggle Light 36**:
   ```
   cansend can0 01FEDB24#24FFFA24FF00FFFF
   ```

2. **Turn Light 36 On**:
   ```
   cansend can0 01FEDB24#01FFFA24FF00FFFF
   ```

3. **Turn Light 36 Off**:
   ```
   cansend can0 01FEDB24#02FFFA24FF00FFFF
   ```

4. **Set Light 36 to 25% Brightness**:
   ```
   cansend can0 01FEDB24#00FFFA241900FFFF
   ```
   Note: 25% = 0x19 in hexadecimal

5. **Set Light 36 to 75% Brightness**:
   ```
   cansend can0 01FEDB24#00FFFA244B00FFFF
   ```
   Note: 75% = 0x4B in hexadecimal

6. **Ramp Light 36 Up Slowly**:
   ```
   cansend can0 01FEDB24#03FFFA240500FFFF
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

Replace the instance value (`FA24` for instance 36) with the appropriate value for your target instance:

- Instance 37: `FA25`
- Instance 38: `FA26`
- Instance 39: `FA27`
- Instance 40: `FA28`

For example, to toggle light instance 40:
```
cansend can0 01FEDB24#24FFFA28FF00FFFF
```

### Instance Format in Payload

- The instance is encoded as two bytes: `FA` (fixed), then the instance number as a single byte (hex).
- E.g., instance 36 = `FA24`, instance 37 = `FA25`, etc.
- Always confirm with a working example from your system.

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
