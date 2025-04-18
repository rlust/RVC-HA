#!/bin/bash
# Test script for RVC MQTT Home Assistant sensors
# Publishes test payloads and subscribes to each topic to verify JSON delivery

MOSQUITTO_HOST=localhost
MOSQUITTO_PORT=1883

# Array of topics and test payloads
TOPICS=(
  "RVC/AC_SOURCE_STATUS/1"
  "RVC/GENERATOR_STATUS_1"
  "RVC/CHARGER_STATUS/1"
  "RVC/DC_LOAD_STATUS/1"
  "RVC/THERMOSTAT_STATUS/1"
  "RVC/ENGINE_STATUS/1"
  "RVC/LEVEL_SENSOR/1"
  "RVC/ALARM_STATUS/1"
  "RVC/POWER_STATUS/1"
)

PAYLOADS=(
  '{"ac voltage": 120, "ac frequency": 60, "source": "Shore Power", "timestamp": "1744684000.000000"}'
  '{"data":"00383B0000FFFFFF","dgn":"1FFDC","engine load":"n/a","engine run time":15160,"name":"GENERATOR_STATUS_1","start battery voltage":"n/a","status":0,"status definition":"stopped","timestamp":"1744685923.344839"}'
  '{"charger state": "Bulk", "output voltage": 14.2, "output current": 55, "timestamp": "1744684020.000000"}'
  '{"dc load": 22.5, "load type": "Lights", "timestamp": "1744684030.000000"}'
  '{"temperature": 72, "setpoint": 68, "mode": "Cool", "timestamp": "1744684040.000000"}'
  '{"engine state": "Running", "rpm": 2200, "oil pressure": 45, "timestamp": "1744684050.000000"}'
  '{"level": 85, "sensor type": "Gray Water", "timestamp": "1744684060.000000"}'
  '{"alarm state": "Active", "alarm type": "Smoke", "timestamp": "1744684070.000000"}'
  '{"power state": "On", "total load": 1500, "timestamp": "1744684080.000000"}'
)

# Publish test payloads
echo "Publishing test payloads to MQTT topics..."
for i in "${!TOPICS[@]}"; do
  mosquitto_pub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -t "${TOPICS[$i]}" -m "${PAYLOADS[$i]}"
done

echo "\nSubscribing to each topic to verify JSON delivery (shows one message per topic):"
for topic in "${TOPICS[@]}"; do
  echo -e "\n--- $topic ---"
  mosquitto_sub -h $MOSQUITTO_HOST -p $MOSQUITTO_PORT -v -C 1 -t "$topic"
done

echo "\nNow check Home Assistant Developer Tools > States for each sensor to verify correct state and attributes."
