"""Constants for the RVC Lights integration."""

DOMAIN = "rvc_lights"

# Configuration options
CONF_MQTT_BROKER = "mqtt_broker"
CONF_MQTT_PORT = "mqtt_port"
CONF_MQTT_USERNAME = "mqtt_username"
CONF_MQTT_PASSWORD = "mqtt_password"
CONF_MQTT_CLIENT_ID = "mqtt_client_id"

# RVC specific constants
RVC_COMMAND_TOPIC_PREFIX = "RVC/DC_DIMMER_COMMAND_2"
RVC_STATUS_TOPIC_PREFIX = "RVC/DC_DIMMER_STATUS_3"

# RVC command codes
RVC_CMD_OFF = 3
RVC_CMD_TOGGLE = 5
RVC_CMD_RAMP_UP = 19
RVC_CMD_RAMP_DOWN = 20
RVC_CMD_NONE = 0

# Default values
DEFAULT_BRIGHTNESS = 55
DEFAULT_DELAY_DURATION = 255
DEFAULT_NAME = "RVC Light"

# Light state and brightness keys in MQTT status messages
STATE_KEY = "operating status (brightness)"
LOAD_STATUS_KEY = "load status"
