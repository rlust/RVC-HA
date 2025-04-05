#!/bin/bash

# Simple script to control RVC lights via MQTT

# Usage information
function show_usage {
  echo "RVC Light Control"
  echo "Usage: $0 [instance] [on|off|dim] [brightness]"
  echo
  echo "Examples:"
  echo "  $0 46 on      # Turn light 46 on at 100% brightness"
  echo "  $0 46 off     # Turn light 46 off"
  echo "  $0 46 dim 50  # Set light 46 to 50% brightness"
}

# Check arguments
if [ $# -lt 2 ]; then
  show_usage
  exit 1
fi

INSTANCE="$1"
ACTION="$2"
BRIGHTNESS="${3:-100}"

# Convert action to command code
case "$ACTION" in
  on)
    CMD="2"
    ;;
  off)
    CMD="3"
    BRIGHTNESS="0"
    ;;
  dim)
    CMD="19"  # ramp up
    if [ -z "$3" ]; then
      echo "Error: Brightness required for dim command"
      show_usage
      exit 1
    fi
    ;;
  *)
    echo "Error: Unknown action '$ACTION'"
    show_usage
    exit 1
    ;;
esac

# Run the Node.js script
node rvc_node_red_mqtt.js "$INSTANCE" "$CMD" "$BRIGHTNESS"
