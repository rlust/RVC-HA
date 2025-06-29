"""Constants for the RV-C Integration."""
from homeassistant.const import Platform

DOMAIN = "rvc"

# MQTT Topics
TOPIC_PREFIX = "RVC"
WATERHEATER_STATUS_TOPIC = f"{TOPIC_PREFIX}/WATERHEATER_STATUS"
AC_STATUS_TOPIC = f"{TOPIC_PREFIX}/AIR_CONDITIONER_STATUS"

# Device Types
DEVICE_TYPE_WATER_HEATER = "water_heater"
DEVICE_TYPE_AC = "climate"

# Attributes
ATTR_INSTANCE = "instance"
ATTR_WATER_TEMP = "water_temperature"
ATTR_WATER_TEMP_F = "water_temperature F"
ATTR_AC_MODE = "operating_mode"
ATTR_AC_FAN_SPEED = "fan_speed"
ATTR_AC_OUTPUT = "air_conditioning_output_level"

# Platforms that this integration supports
PLATFORMS = [Platform.WATER_HEATER, Platform.CLIMATE]
