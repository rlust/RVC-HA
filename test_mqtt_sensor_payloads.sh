#!/bin/bash
# Publishes example payloads to test new RVC MQTT sensors in Home Assistant

MOSQUITTO_HOST=localhost
MOSQUITTO_PORT=1883

mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/AC_SOURCE_STATUS/1' -m '{"ac voltage": 120, "ac frequency": 60, "source": "Shore Power", "timestamp": "1744684000.000000"}'
mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/GENERATOR_STATUS/1' -m '{"generator state": "Running", "hours": 123.4, "rpm": 1800, "timestamp": "1744684010.000000"}'
mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/CHARGER_STATUS/1' -m '{"charger state": "Bulk", "output voltage": 14.2, "output current": 55, "timestamp": "1744684020.000000"}'
mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/DC_LOAD_STATUS/1' -m '{"dc load": 22.5, "load type": "Lights", "timestamp": "1744684030.000000"}'
mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/THERMOSTAT_STATUS/1' -m '{"temperature": 72, "setpoint": 68, "mode": "Cool", "timestamp": "1744684040.000000"}'
mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/ENGINE_STATUS/1' -m '{"engine state": "Running", "rpm": 2200, "oil pressure": 45, "timestamp": "1744684050.000000"}'
mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/LEVEL_SENSOR/1' -m '{"level": 85, "sensor type": "Gray Water", "timestamp": "1744684060.000000"}'
mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/ALARM_STATUS/1' -m '{"alarm state": "Active", "alarm type": "Smoke", "timestamp": "1744684070.000000"}'
mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t 'RVC/POWER_STATUS/1' -m '{"power state": "On", "total load": 1500, "timestamp": "1744684080.000000"}'
