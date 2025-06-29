#!/bin/bash

# Home Assistant API Helper Script
# This script helps interact with Home Assistant API with proper authentication

HA_URL="http://localhost:8123"
TOKEN=""

# Function to generate a long-lived access token
generate_token() {
  echo "Please log in to Home Assistant at http://localhost:8123"
  echo "Go to your profile (click on user icon on bottom left)"
  echo "Scroll down to Long-Lived Access Tokens section and create a token"
  echo "Enter the token below:"
  read -r input_token
  TOKEN="$input_token"
  echo "TOKEN=\"$TOKEN\"" > /Users/randylust/RVC-HA/ha_token.sh
  chmod +x /Users/randylust/RVC-HA/ha_token.sh
  echo "Token saved for future use"
}

# Function to load token if it exists
load_token() {
  if [ -f "/Users/randylust/RVC-HA/ha_token.sh" ]; then
    source /Users/randylust/RVC-HA/ha_token.sh
    echo "Token loaded successfully"
  else
    echo "No saved token found"
    generate_token
  fi
}

# Function to call Home Assistant API
call_service() {
  domain="$1"
  service="$2"
  entity_id="$3"
  
  if [ -z "$TOKEN" ]; then
    echo "No token available, please generate one first"
    return 1
  fi
  
  result=$(curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"entity_id\": \"$entity_id\"}" \
    "$HA_URL/api/services/$domain/$service")
  
  echo "$result"
}

# Function to get entity state
get_entity_state() {
  entity_id="$1"
  
  if [ -z "$TOKEN" ]; then
    echo "No token available, please generate one first"
    return 1
  fi
  
  result=$(curl -s \
    -H "Authorization: Bearer $TOKEN" \
    "$HA_URL/api/states/$entity_id")
  
  echo "$result"
}

# Function to list entities
list_entities() {
  pattern="$1"
  
  if [ -z "$TOKEN" ]; then
    echo "No token available, please generate one first"
    return 1
  fi
  
  result=$(curl -s \
    -H "Authorization: Bearer $TOKEN" \
    "$HA_URL/api/states")
  
  if [ -n "$pattern" ]; then
    echo "$result" | grep -i "$pattern"
  else
    echo "$result"
  fi
}

# Main execution
case "$1" in
  "token")
    generate_token
    ;;
  "light.on")
    load_token
    call_service "light" "turn_on" "$2"
    ;;
  "light.off")
    load_token
    call_service "light" "turn_off" "$2"
    ;;
  "state")
    load_token
    get_entity_state "$2"
    ;;
  "list")
    load_token
    list_entities "$2"
    ;;
  *)
    echo "Usage:"
    echo "  $0 token                  - Generate a new access token"
    echo "  $0 light.on ENTITY_ID     - Turn on light"
    echo "  $0 light.off ENTITY_ID    - Turn off light"
    echo "  $0 state ENTITY_ID        - Get entity state"
    echo "  $0 list [PATTERN]         - List all entities, optionally filter by pattern"
    ;;
esac
