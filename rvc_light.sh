#!/bin/bash

# Simple script to control RVC lights via MQTT

# Usage information
function show_usage {
  echo "RVC Light Control"
  echo "Usage: $0 [instance] [on|off|toggle|bright|dim|stop] [brightness]"
  echo
  echo "Examples:"
  echo "  $0 46 on       # Turn light 46 on at 100% brightness"
  echo "  $0 46 off      # Turn light 46 off"
  echo "  $0 46 toggle   # Toggle light 46 between on and off"
  echo "  $0 46 bright   # Ramp up brightness of light 46"
  echo "  $0 46 dim 50   # Set light 46 to 50% brightness"
  echo "  $0 46 dim      # Ramp down brightness of light 46"
  echo "  $0 46 stop     # Stop any active ramping"
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
  toggle)
    CMD="5"
    BRIGHTNESS="100"
    ;;
  bright)
    CMD="19"  # ramp up
    ;;
  dim)
    if [ -z "$3" ]; then
      CMD="20"  # ramp down without specific brightness
    else
      CMD="19"  # ramp up/dim to specific brightness
    fi
    ;;
  stop)
    CMD="0"  # no command (stops ramping)
    ;;
  *)
    echo "Error: Unknown action '$ACTION'"
    show_usage
    exit 1
    ;;
esac

# Run the Node.js script
node rvc_node_red_mqtt.js "$INSTANCE" "$CMD" "$BRIGHTNESS"
