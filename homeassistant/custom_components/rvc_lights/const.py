"""Constants for the RVC Lights integration."""

DOMAIN = "rvc_lights"

# Configuration options
CONF_MQTT_BROKER = "mqtt_broker"
CONF_MQTT_PORT = "mqtt_port"
CONF_MQTT_USERNAME = "mqtt_username"
CONF_MQTT_PASSWORD = "mqtt_password"
CONF_MQTT_CLIENT_ID = "mqtt_client_id"
CONF_ENABLE_AUTO_DISCOVERY = "enable_auto_discovery"

# RVC specific constants
RVC_COMMAND_TOPIC_PREFIX = "RVC/DC_DIMMER_COMMAND_2"
RVC_STATUS_TOPIC_PREFIX = "RVC/DC_DIMMER_STATUS_3"
RVC_DIRECT_COMMAND_TOPIC = "node-red/rvc/commands"

# RVC command codes
RVC_CMD_ON = 2
RVC_CMD_OFF = 3
RVC_CMD_TOGGLE = 5
RVC_CMD_RAMP_UP = 19
RVC_CMD_RAMP_DOWN = 20
RVC_CMD_STOP = 0

# Default values
DEFAULT_BRIGHTNESS = 55
DEFAULT_DELAY_DURATION = 255
DEFAULT_NAME = "RVC Light"

# Light state and brightness keys in MQTT status messages
# These must exactly match the field names in the MQTT payload
STATE_KEY = "operating status (brightness)"
LOAD_STATUS_KEY = "load status"

# RVC Light definitions (instance_id: friendly_name)
RVC_LIGHTS = {
    25: "Bed Ceiling Lts A",
    26: "Bed Ceiling Lts B",
    27: "Bed Accent",
    28: "Bed Vanity",
    29: "Courtesy",
    30: "RR Bath Ceiling",
    31: "RR Bath Lav Lts",
    32: "RR Bath Accent",
    33: "Mid Bath Ceiling",
    34: "Mid Bath Accent",
    35: "Entry Ceiling",
    36: "Living Edge",
    37: "Livrm Ceiling A",
    38: "Livrm Ceiling B",
    39: "Livrm Accent A",
    40: "Livrm Accent B",
    41: "Sofa Ceiling",
    42: "Kitchen Ceiling",
    44: "D/S Slide",
    45: "Dinette",
    46: "Sink",
    47: "Midship",
    49: "Door Awning Extend",
    50: "Door Awning Retract",
    51: "Awning D/S",
    52: "Awning P/S",
    53: "Cargo",
    54: "Under Slide",
    56: "Bed Reading",
    57: "Security D/S",
    58: "Security P/S",
    59: "Security Motion",
    60: "Porch",
}
