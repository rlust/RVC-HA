#!/bin/bash

# RVC Light MQTT Control Script

# Default values
MQTT_HOST="localhost"
MQTT_PORT="1883"
INSTANCE="46"
ACTION="status"

# Help function
show_help() {
  echo "Usage: $0 [options]"
  echo
  echo "Options:"
  echo "  -h, --host HOST      MQTT broker host (default: localhost)"
  echo "  -p, --port PORT      MQTT broker port (default: 1883)"
  echo "  -i, --instance NUM   RVC light instance number (default: 46)"
  echo "  -a, --action ACTION  Action to perform: on, off, status (default: status)"
  echo "  --help               Show this help message"
  echo
  echo "Examples:"
  echo "  $0 -i 46 -a on       Turn on RVC light instance 46"
  echo "  $0 -i 46 -a off      Turn off RVC light instance 46"
  echo "  $0 -i 46 -a status   Get status of RVC light instance 46"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -h|--host)
      MQTT_HOST="$2"
      shift
      shift
      ;;
    -p|--port)
      MQTT_PORT="$2"
      shift
      shift
      ;;
    -i|--instance)
      INSTANCE="$2"
      shift
      shift
      ;;
    -a|--action)
      ACTION="$2"
      shift
      shift
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Function to publish MQTT message
publish_mqtt() {
  local topic="$1"
  local message="$2"
  
  # Use Docker to access the MQTT broker
  docker exec rvc-ha-mosquitto-1 mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "$topic" -m "$message"
  
  # Show the command that was executed
  echo "Published to topic: $topic"
  echo "Message: $message"
}

# Function to subscribe to MQTT message
subscribe_mqtt() {
  local topic="$1"
  local count="$2"
  
  # Use Docker to access the MQTT broker
  docker exec rvc-ha-mosquitto-1 mosquitto_sub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "$topic" -C "$count"
}

# Control the RVC light based on the action
case "$ACTION" in
  "on")
    # Turn on the light with 100% brightness
    publish_mqtt "RVC/DC_DIMMER_COMMAND_2/$INSTANCE" '{"command": 19, "command definition": "ramp up", "instance": '"$INSTANCE"', "desired level": 100, "delay/duration": 255}'
    ;;
  "off")
    # Turn off the light
    publish_mqtt "RVC/DC_DIMMER_COMMAND_2/$INSTANCE" '{"command": 3, "command definition": "off", "instance": '"$INSTANCE"', "desired level": 0, "delay/duration": 255}'
    ;;
  "status")
    # Subscribe to the status topic to get the current state
    echo "Checking status of RVC light instance $INSTANCE (press Ctrl+C to exit)..."
    subscribe_mqtt "RVC/DC_DIMMER_STATUS_3/$INSTANCE" 1
    ;;
  *)
    echo "Unknown action: $ACTION"
    show_help
    exit 1
    ;;
esac
