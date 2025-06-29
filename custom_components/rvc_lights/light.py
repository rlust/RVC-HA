"""Light platform for RVC Lights integration."""
import json
import logging
from typing import Any, Dict, List, Optional, Callable

import voluptuous as vol

from homeassistant.components import mqtt
from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_EFFECT,
    PLATFORM_SCHEMA,
    LightEntity,
    ColorMode,
    LightEntityFeature,
)
from homeassistant.const import (
    CONF_NAME,
    CONF_UNIQUE_ID,
    CONF_OPTIMISTIC,
    STATE_ON,
    STATE_OFF,
)
from homeassistant.core import HomeAssistant, callback
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType

from .const import (
    DOMAIN,
    RVC_COMMAND_TOPIC_PREFIX,
    RVC_STATUS_TOPIC_PREFIX,
    RVC_CMD_OFF,
    RVC_CMD_RAMP_UP,
    DEFAULT_BRIGHTNESS,
    DEFAULT_DELAY_DURATION,
    STATE_KEY,
    LOAD_STATUS_KEY,
)

from .discovery import DISCOVERY_SIGNAL

_LOGGER = logging.getLogger(__name__)

PLATFORM_SCHEMA = PLATFORM_SCHEMA.extend(
    {
        vol.Required(CONF_NAME): cv.string,
        vol.Required(CONF_UNIQUE_ID): cv.string,
        vol.Required("instance"): cv.positive_int,
        vol.Optional(CONF_OPTIMISTIC, default=False): cv.boolean,
        vol.Optional("default_brightness", default=DEFAULT_BRIGHTNESS): cv.positive_int,
    }
)

async def async_setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    add_entities: AddEntitiesCallback,
    discovery_info: Optional[DiscoveryInfoType] = None,
) -> None:
    """Set up the RVC Lights platform."""
    # Track the discovered lights to avoid duplicates
    discovered_lights = set()
    
    # Process manually configured lights
    if not discovery_info:
        light = RvcLight(
            config[CONF_NAME],
            config[CONF_UNIQUE_ID],
            config["instance"],
            config[CONF_OPTIMISTIC],
            config.get("default_brightness", DEFAULT_BRIGHTNESS),
        )
        
        add_entities([light])
        discovered_lights.add(config["instance"])
    
    # Process discovered devices
    @callback
    def async_discover_device(discovery_info):
        """Discover and add a RVC light."""
        instance = discovery_info["instance"]
        
        # Skip if this instance was already added
        if instance in discovered_lights:
            return
            
        # Create the light entity
        light = RvcLight(
            discovery_info[CONF_NAME],
            discovery_info[CONF_UNIQUE_ID],
            instance,
            discovery_info[CONF_OPTIMISTIC],
            discovery_info.get("default_brightness", DEFAULT_BRIGHTNESS),
        )
        
        add_entities([light])
        discovered_lights.add(instance)
        _LOGGER.info(f"Added discovered RVC light instance {instance}")
    
    # Subscribe to discovery events
    async_dispatcher_connect(
        hass, DISCOVERY_SIGNAL, async_discover_device
    )

class RvcLight(LightEntity):
    """Representation of an RVC Light."""

    _attr_color_mode = ColorMode.BRIGHTNESS
    _attr_supported_color_modes = {ColorMode.BRIGHTNESS}

    def __init__(
        self,
        name: str,
        unique_id: str,
        instance: int,
        optimistic: bool,
        default_brightness: int,
    ) -> None:
        """Initialize an RVC Light."""
        self._attr_name = name
        self._attr_unique_id = unique_id
        self._instance = instance
        self._optimistic = optimistic
        self._default_brightness = min(max(default_brightness, 1), 100)
        
        self._state = False
        self._brightness = 0
        
        self._command_topic = f"{RVC_COMMAND_TOPIC_PREFIX}/{instance}"
        self._status_topic = f"{RVC_STATUS_TOPIC_PREFIX}/{instance}"
        
        # Set default attributes
        self._attr_should_poll = False
        self._attr_assumed_state = optimistic

    async def async_added_to_hass(self) -> None:
        """Subscribe to MQTT events."""
        
        @callback
        def message_received(msg):
            """Handle new MQTT messages."""
            try:
                payload = json.loads(msg.payload)
                
                # Get brightness from operating status
                if STATE_KEY in payload:
                    brightness = int(payload[STATE_KEY])
                    self._brightness = min(max(brightness, 0), 100)
                    self._state = self._brightness > 0
                # Alternative: use load status if operating status not available
                elif LOAD_STATUS_KEY in payload:
                    self._state = payload[LOAD_STATUS_KEY] == "01"
                    if self._state and self._brightness == 0:
                        self._brightness = self._default_brightness
                
                self.async_write_ha_state()
            except Exception as ex:
                _LOGGER.error("Failed to parse MQTT message: %s", ex)
        
        await mqtt.async_subscribe(
            self.hass, self._status_topic, message_received, 1
        )

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn the light on."""
        brightness = kwargs.get(ATTR_BRIGHTNESS)
        
        if brightness is not None:
            # Convert from HA brightness (0-255) to RVC brightness (0-100)
            rvc_brightness = min(max(round(brightness / 255 * 100), 1), 100)
        else:
            rvc_brightness = self._default_brightness
            
        payload = {
            "command": RVC_CMD_RAMP_UP,
            "command definition": "ramp up",
            "instance": self._instance,
            "desired level": rvc_brightness,
            "delay/duration": DEFAULT_DELAY_DURATION
        }
        
        # Publish the MQTT message
        await mqtt.async_publish(
            self.hass, self._command_topic, json.dumps(payload), 0, False
        )
        
        # Update state if optimistic
        if self._optimistic:
            self._state = True
            self._brightness = rvc_brightness
            self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn the light off."""
        payload = {
            "command": RVC_CMD_OFF,
            "command definition": "off",
            "instance": self._instance,
            "desired level": 0,
            "delay/duration": DEFAULT_DELAY_DURATION
        }
        
        # Publish the MQTT message
        await mqtt.async_publish(
            self.hass, self._command_topic, json.dumps(payload), 0, False
        )
        
        # Update state if optimistic
        if self._optimistic:
            self._state = False
            self._brightness = 0
            self.async_write_ha_state()

    @property
    def is_on(self) -> bool:
        """Return true if light is on."""
        return self._state

    @property
    def brightness(self) -> Optional[int]:
        """Return the brightness of this light (0-255)."""
        if self._brightness == 0:
            return 0
        # Convert from RVC brightness (0-100) to HA brightness (0-255)
        return min(max(round(self._brightness * 255 / 100), 1), 255)
