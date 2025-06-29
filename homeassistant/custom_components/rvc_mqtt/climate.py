"""RVC MQTT Climate platform."""
import logging
import json
import voluptuous as vol

from homeassistant.components import mqtt
from homeassistant.components.climate import (
    ClimateEntity,
    PLATFORM_SCHEMA,
    HVACMode,
    ClimateEntityFeature,
    FAN_AUTO,
    FAN_LOW,
    FAN_MEDIUM,
    FAN_HIGH,
)
from homeassistant.components.climate.const import (
    PRESET_NONE,
)
from homeassistant.const import (
    ATTR_TEMPERATURE,
    CONF_NAME,
    CONF_UNIQUE_ID,
    UnitOfTemperature,
)
from homeassistant.core import callback
import homeassistant.helpers.config_validation as cv
from homeassistant.util.unit_system import METRIC_SYSTEM

_LOGGER = logging.getLogger(__name__)

DEFAULT_NAME = "RVC AC Control"
CONF_TOPIC = "topic"
CONF_INSTANCE = "instance"

# Operating mode mappings
MODE_MAPPING = {
    "off": 0,
    "automatic": 0,
    "heat": 1,
    "cool": 2,
    "fan only": 3,
}

# Reverse mode mapping for status updates
REVERSE_MODE_MAPPING = {
    0: HVACMode.AUTO,
    1: HVACMode.HEAT,
    2: HVACMode.COOL,
    3: HVACMode.FAN_ONLY,
}

# Fan speed mappings
FAN_MAPPING = {
    FAN_AUTO: 0,
    FAN_LOW: 1,
    FAN_MEDIUM: 2,
    FAN_HIGH: 3,
}

PLATFORM_SCHEMA = PLATFORM_SCHEMA.extend({
    vol.Required(CONF_TOPIC): cv.string,
    vol.Required(CONF_INSTANCE): cv.positive_int,
    vol.Optional(CONF_NAME, default=DEFAULT_NAME): cv.string,
    vol.Optional(CONF_UNIQUE_ID): cv.string,
})

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the RVC MQTT Climate devices."""
    # If we get configuration data from discovery_info, use that instead
    if discovery_info is not None:
        config = discovery_info
    
    if 'climate' not in config:
        return
        
    climate_devices = []
    for device_config in config['climate']:
        topic = device_config.get(CONF_TOPIC)
        instance = device_config.get(CONF_INSTANCE)
        name = device_config.get(CONF_NAME, DEFAULT_NAME)
        unique_id = device_config.get(CONF_UNIQUE_ID)
        
        _LOGGER.info(f"Setting up climate device: {name}, instance: {instance}, topic: {topic}")
        
        climate_devices.append(
            RvcMqttClimate(hass, name, topic, instance, unique_id)
        )
    
    if climate_devices:
        async_add_entities(climate_devices)

class RvcMqttClimate(ClimateEntity):
    """Representation of an RVC MQTT climate device."""

    def __init__(self, hass, name, topic, instance, unique_id):
        """Initialize the climate device."""
        self.hass = hass
        self._name = name
        self._topic = topic
        self._instance = instance
        self._unique_id = unique_id or f"rvc_ac_{instance}"
        # According to RVC-spec.yml, AIR_CONDITIONER_COMMAND has DGN 1FFE0
        self._command_topic = f"RVC/AIR_CONDITIONER_COMMAND/{instance}/set"
        self._status_topic = f"RVC/AIR_CONDITIONER_STATUS/{instance}"
        
        # Set initial state
        self._hvac_mode = HVACMode.OFF
        self._fan_mode = FAN_AUTO
        self._current_temperature = None
        self._target_temperature = 22
        self._unit = hass.config.units is METRIC_SYSTEM and UnitOfTemperature.CELSIUS or UnitOfTemperature.FAHRENHEIT
        self._available = False
        self._attr_supported_features = (
            ClimateEntityFeature.TARGET_TEMPERATURE |
            ClimateEntityFeature.FAN_MODE
        )
        self._attr_hvac_modes = [
            HVACMode.OFF,
            HVACMode.HEAT,
            HVACMode.COOL,
            HVACMode.AUTO,
            HVACMode.FAN_ONLY,
        ]
        self._attr_fan_modes = [
            FAN_AUTO,
            FAN_LOW,
            FAN_MEDIUM,
            FAN_HIGH,
        ]
        self._attr_preset_modes = [PRESET_NONE]
        self._attr_max_temp = 32
        self._attr_min_temp = 16
        self._attr_temperature_unit = self._unit
        self._attr_preset_mode = PRESET_NONE

    async def async_added_to_hass(self):
        """Subscribe to MQTT events."""
        await super().async_added_to_hass()

        @callback
        def message_received(msg):
            """Handle new MQTT messages."""
            try:
                data = json.loads(msg.payload)
                _LOGGER.debug("Received AC status: %s", data)

                if "operating mode" in data:
                    mode_value = data["operating mode"]
                    if mode_value in REVERSE_MODE_MAPPING:
                        self._hvac_mode = REVERSE_MODE_MAPPING[mode_value]
                    else:
                        self._hvac_mode = HVACMode.OFF

                if "fan speed" in data:
                    fan_value = data["fan speed"]
                    # Map fan speed value to Home Assistant fan modes
                    if fan_value == 0:
                        self._fan_mode = FAN_AUTO
                    elif fan_value == 1:
                        self._fan_mode = FAN_LOW
                    elif fan_value == 2:
                        self._fan_mode = FAN_MEDIUM
                    elif fan_value == 3:
                        self._fan_mode = FAN_HIGH

                # The actual temperature would come from a separate thermostat sensor
                # This just serves as a placeholder for now
                self._available = True
                self.async_write_ha_state()
            
            except Exception as e:
                _LOGGER.error("Error processing MQTT message: %s", e)

        # Subscribe to status updates
        await mqtt.async_subscribe(
            self.hass,
            self._status_topic,
            message_received,
            1
        )

    @property
    def name(self):
        """Return the name of the climate device."""
        return self._name

    @property
    def unique_id(self):
        """Return a unique ID."""
        return self._unique_id

    @property
    def current_temperature(self):
        """Return the current temperature."""
        return self._current_temperature

    @property
    def target_temperature(self):
        """Return the target temperature."""
        return self._target_temperature

    @property
    def hvac_mode(self):
        """Return hvac operation mode."""
        return self._hvac_mode

    @property
    def fan_mode(self):
        """Return the fan setting."""
        return self._fan_mode

    @property
    def available(self):
        """Return if the device is available."""
        return self._available

    async def async_set_temperature(self, **kwargs):
        """Set new target temperature."""
        if ATTR_TEMPERATURE in kwargs:
            self._target_temperature = kwargs.get(ATTR_TEMPERATURE)
            await self._send_command()
            self.async_write_ha_state()

    async def async_set_fan_mode(self, fan_mode):
        """Set new fan mode."""
        if fan_mode in self._attr_fan_modes:
            self._fan_mode = fan_mode
            await self._send_command()
            self.async_write_ha_state()

    async def async_set_hvac_mode(self, hvac_mode):
        """Set new hvac mode."""
        if hvac_mode in self._attr_hvac_modes:
            self._hvac_mode = hvac_mode
            await self._send_command()
            self.async_write_ha_state()

    async def _send_command(self):
        """Send command to the AC unit."""
        # Map HA modes to RVC modes
        rvc_mode = 0  # Default to automatic/off
        if self._hvac_mode == HVACMode.OFF:
            rvc_mode = 0
        elif self._hvac_mode == HVACMode.HEAT:
            rvc_mode = 1
        elif self._hvac_mode == HVACMode.COOL:
            rvc_mode = 2
        elif self._hvac_mode == HVACMode.FAN_ONLY:
            rvc_mode = 3
        elif self._hvac_mode == HVACMode.AUTO:
            rvc_mode = 0

        # Map HA fan modes to RVC fan speeds
        fan_speed = 0  # Default to auto
        if self._fan_mode == FAN_LOW:
            fan_speed = 1
        elif self._fan_mode == FAN_MEDIUM:
            fan_speed = 2
        elif self._fan_mode == FAN_HIGH:
            fan_speed = 3

        # Create payload matching RVC-spec.yml for AIR_CONDITIONER_COMMAND (1FFE0)
        payload = {
            "instance": self._instance,
            "operating mode": rvc_mode, # 0 for automatic, 1 for manual
            "fan speed": fan_speed * 25,  # Convert 0-3 to 0-100 percentage
            "air conditioning output level": 75 if self._hvac_mode == HVACMode.COOL else 0,  # AC output level as percentage
            "dead band": 255,  # Default value
            "second stage dead band": 255,  # Default value
            "name": "AIR_CONDITIONER_COMMAND",
            "dgn": "1FFE0"  # Correct DGN from RVC-spec.yml
        }

        # Enhanced logging for command tracking
        _LOGGER.debug("Sending AC command: %s", payload)
        _LOGGER.warning(f"TEST: Sending AC command to {self._command_topic}: {json.dumps(payload)}")
        _LOGGER.warning(f"TEST: Current AC state before command - Mode: {self._hvac_mode}, Fan: {self._fan_mode}, Target Temp: {self._target_temperature}")
        
        try:
            # Send the command
            await mqtt.async_publish(
                self.hass,
                self._command_topic,
                json.dumps(payload),
                0,
                False
            )
            _LOGGER.warning(f"TEST: Command successfully published to {self._command_topic}")
            
            # Also try with alternate topic format as a fallback
            alt_topic = f"RVC/AIR_CONDITIONER_COMMAND_2/{self._instance}/set"
            await mqtt.async_publish(
                self.hass,
                alt_topic,
                json.dumps(payload),
                0,
                False
            )
            _LOGGER.warning(f"TEST: Also published to alternate topic: {alt_topic}")
        except Exception as e:
            _LOGGER.error(f"TEST: Failed to publish AC command: {str(e)}")
