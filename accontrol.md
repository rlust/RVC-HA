# AC Controls via CAN Bus (RV-C Protocol)

This document outlines `cansend` commands for controlling two air conditioner (AC) units using the RV-C protocol (DGN `1FFE0`, THERMOSTAT_COMMAND_1) on a CAN bus. The commands target:
- **AC Unit 1**: Instance `1`, CAN ID `19FFE096` (source address `96`).
- **AC Unit 2**: Instance `2`, CAN ID `19FFE097` (source address `96`, instance bit flipped).

The commands adjust settings like operating mode, fan speed, setpoint temperature, dead band, and second stage dead band. Note that AC unit 1 reverts to 50% fan speed after setting high fan speed, likely due to an overriding command or internal logic. Troubleshooting steps are provided.

## Setup
- **CAN Interface**: `can0` (used for sending commands). If the AC is on `can1`, replace `can0` with `can1`.
- **CAN ID**:
  - Unit 1: `19FFE096` (Priority: `6`, DGN: `1FFE0`, Source: `96`, Instance: `1`).
  - Unit 2: `19FFE097` (Instance: `2`, LSB flipped).
- **Payload Structure** (THERMOSTAT_COMMAND_1):
  - Byte 1: Operating Mode (`00` = Off, `01` = Manual, `02` = Auto).
  - Byte 2: Fan Speed (`00` = Off, `01` = High/100%, `02` = Medium/50%, `03` = Low/25% if supported).
  - Bytes 3-4: Dead Band (16-bit, 0.03125°C units; `FF FF` = invalid).
  - Bytes 5-6: Setpoint (16-bit, 0.03125°C units; `C8 C8` = invalid).
  - Bytes 7-8: Second Stage Dead Band (`FF FF` = invalid).
- **Fan Speeds**:
  - `01` = High (100%).
  - `02` = Medium (50%, default for unit 1 after revert).
  - `00` = Off.
  - `03` = Low (25%, assumed if supported).

## cansend Commands for AC Unit 1 (Instance 1, CAN ID 19FFE096)

### Turn Off
```bash
cansend can0 19FFE096#0000FFFFC8C8FFFF
```

### Fan High (Front AC, Instance 1)
```bash
cansend can0 19FFE096#0101FFFFC8C8FFFF
```
This command turns the fan to high on instance 1 (Front AC unit) for a brief time.
