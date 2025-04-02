# RV-C Device States Documentation

This document outlines how to retrieve state information for various RV-C devices via MQTT topics.

## Water Heater

To get the current state of the water heater, including the hot water temperature, subscribe to the following MQTT topic:

```text
RVC/WATERHEATER_STATUS/1
```

### Example Payload

An example JSON payload received on this topic looks like this:

```json
{
  "ac element status": "11",
  "ac element status definition": "undefined",
  "ac power failure status": "11",
  "ac power failure status definition": "undefined",
  "burner status": "00",
  "burner status definition": "off",
  "data": "0102FFFF342CF00C",
  "dc power failure status": "00",
  "dc power failure status definition": "dc power present",
  "dgn": "1FFF7",
  "failure to ignite status": "00",
  "failure to ignite status definition": "no failure",
  "high temperature limit switch status": "11",
  "high temperature limit switch status definition": "undefined",
  "instance": 1,
  "name": "WATERHEATER_STATUS",
  "operating modes": 2,
  "operating modes definition": "electric",
  "set point temperature": "n/a",
  "set point temperature F": 32,
  "thermostat status": "00",
  "thermostat status definition": "set point met",
  "timestamp": "1743620534.070871",
  "water temperature": 80.6,
  "water temperature F": 177
}

 

Key fields:
* `water temperature`: Water temperature in Celsius.
* `water temperature F`: Water temperature in Fahrenheit.

## Air Conditioner (HVAC)

To get the current state of an HVAC unit, subscribe to the following MQTT topic format, replacing `{instance}` with the specific unit instance (e.g., 1 for the front unit):

```text
RVC/AIR_CONDITIONER_STATUS/{instance}
```

Example for Front HVAC (Instance 1):

```text
RVC/AIR_CONDITIONER_STATUS/1
```

### Example Payload (Instance 1)

```json
{
  "air conditioning output level": 100,
  "data": "0101C8C8C8C8FFFF",
  "dead band": 255,
  "dgn": "1FFE1",
  "fan speed": 100,
  "instance": 1,
  "max air conditioning output level": 100,
  "max fan speed": 100,
  "name": "AIR_CONDITIONER_STATUS",
  "operating mode": 1,
  "operating mode definition": "manual",
  "second stage dead band": 255,
  "timestamp": "1743620767.305828"
}

 

Key fields:
* `operating mode definition`: Current mode (e.g., manual, auto, cool, heat).
* `fan speed`: Current fan speed percentage.
* `air conditioning output level`: Current cooling output level percentage.

Example for Middle HVAC (Instance 2):

```text
RVC/AIR_CONDITIONER_STATUS/2
```

### Example Payload (Instance 2)

```json
{
  "air conditioning output level": 0,
  "data": "0200FFFF0000FF00",
  "dead band": 255,
  "dgn": "1FFE1",
  "fan speed": 0,
  "instance": 2,
  "max air conditioning output level": "n/a",
  "max fan speed": "n/a",
  "name": "AIR_CONDITIONER_STATUS",
  "operating mode": 0,
  "operating mode definition": "automatic",
  "second stage dead band": 0,
  "timestamp": "1743620952.426055"
}
