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
    RVC_DIRECT_COMMAND_TOPIC,
    RVC_CMD_ON,
    RVC_CMD_OFF,
    RVC_CMD_TOGGLE,
    RVC_CMD_RAMP_UP,
    RVC_CMD_RAMP_DOWN,
    RVC_CMD_STOP,
    DEFAULT_BRIGHTNESS,
    DEFAULT_DELAY_DURATION,
    STATE_KEY,
    LOAD_STATUS_KEY,
    RVC_LIGHTS,
    CONF_ENABLE_AUTO_DISCOVERY,
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
    lights = []
    
    _LOGGER.info(f"Setting up RVC Lights platform with discovery_info: {discovery_info}")
    
    # Get component config
    component_config = hass.data.get(DOMAIN, {})
    enable_auto_discovery = component_config.get(CONF_ENABLE_AUTO_DISCOVERY, True)
    
    # Register all predefined RVC lights
    for instance, name in RVC_LIGHTS.items():
        if instance in discovered_lights:
            continue
            
        # Create a light entity for each predefined instance
        light = RvcLight(
            name,
            f"rvc_light_{instance}",
            instance,
            False,
            DEFAULT_BRIGHTNESS,
        )
        
        lights.append(light)
        discovered_lights.add(instance)
        _LOGGER.info(f"Registered predefined RVC light: {name} (instance {instance})")
        
    # Handle manual configuration
    if not discovery_info and CONF_NAME in config and "instance" in config:
        instance = config["instance"]
        if instance not in discovered_lights:
            light = RvcLight(
                config[CONF_NAME],
                config.get(CONF_UNIQUE_ID, f"rvc_light_{instance}"),
                instance,
                config.get(CONF_OPTIMISTIC, False),
                config.get("default_brightness", DEFAULT_BRIGHTNESS),
            )
            
            lights.append(light)
            discovered_lights.add(instance)
            _LOGGER.info(f"Added manually configured RVC light: {config[CONF_NAME]} (instance {instance})")
    
    # Add all created entities
    if lights:
        add_entities(lights)
    
    # Only set up discovery if enabled
    if enable_auto_discovery:
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
                discovery_info.get(CONF_OPTIMISTIC, False),
                discovery_info.get("default_brightness", DEFAULT_BRIGHTNESS),
            )
            
            add_entities([light])
            discovered_lights.add(instance)
            _LOGGER.info(f"Added discovered RVC light instance {instance}")
        
        # Subscribe to discovery events
        async_dispatcher_connect(
            hass, DISCOVERY_SIGNAL, async_discover_device
        )
    
    # Register custom services
    async def handle_toggle_service(call):
        """Handle the toggle service call."""
        entity_ids = call.data.get("entity_id")
        entities = [entity for entity in lights if entity.entity_id in entity_ids] if entity_ids else lights
        
        for light in entities:
            await light.async_toggle()
    
    async def handle_ramp_up_service(call):
        """Handle the ramp up service call."""
        entity_ids = call.data.get("entity_id")
        entities = [entity for entity in lights if entity.entity_id in entity_ids] if entity_ids else lights
        
        for light in entities:
            await light.async_ramp_up()
            
    async def handle_ramp_down_service(call):
        """Handle the ramp down service call."""
        entity_ids = call.data.get("entity_id")
        entities = [entity for entity in lights if entity.entity_id in entity_ids] if entity_ids else lights
        
        for light in entities:
            await light.async_ramp_down()
            
    async def handle_stop_ramp_service(call):
        """Handle the stop ramping service call."""
        entity_ids = call.data.get("entity_id")
        entities = [entity for entity in lights if entity.entity_id in entity_ids] if entity_ids else lights
        
        for light in entities:
            await light.async_stop_ramp()
    
    # Register the custom services
    hass.services.async_register(
        DOMAIN, "toggle", handle_toggle_service, schema=cv.make_entity_service_schema({})
    )
    hass.services.async_register(
        DOMAIN, "ramp_up", handle_ramp_up_service, schema=cv.make_entity_service_schema({})
    )
    hass.services.async_register(
        DOMAIN, "ramp_down", handle_ramp_down_service, schema=cv.make_entity_service_schema({})
    )
    hass.services.async_register(
        DOMAIN, "stop_ramp", handle_stop_ramp_service, schema=cv.make_entity_service_schema({})
    )

class RvcLight(LightEntity):
    """Representation of an RVC Light."""

    _attr_color_mode = ColorMode.BRIGHTNESS
    _attr_supported_color_modes = {ColorMode.BRIGHTNESS}
    _attr_supported_features = LightEntityFeature.TRANSITION

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
                # Log the raw message for debugging
                _LOGGER.debug(f"Received message on {msg.topic}: {msg.payload}")
                
                # Parse the payload
                payload = json.loads(msg.payload)
                
                # Log the parsed payload
                _LOGGER.debug(f"Parsed payload for {self._attr_name}: {payload}")
                
                # Get brightness from operating status (brightness)
                if STATE_KEY in payload:
                    # Parse brightness value, ensuring it's an integer
                    try:
                        brightness = int(payload[STATE_KEY])
                        self._brightness = min(max(brightness, 0), 100)
                        self._state = self._brightness > 0
                        _LOGGER.debug(f"Updated {self._attr_name} brightness to {self._brightness}, state: {self._state}")
                    except (ValueError, TypeError):
                        _LOGGER.warning(f"Invalid brightness value in payload: {payload[STATE_KEY]}")
                
                # Check load status
                if LOAD_STATUS_KEY in payload:
                    load_status = payload[LOAD_STATUS_KEY]
                    # Check if active/inactive text or binary value
                    if isinstance(load_status, str):
                        if load_status.lower() in ("active", "on", "01", "1", "true"):
                            self._state = True
                        elif load_status.lower() in ("inactive", "off", "00", "0", "false"):
                            self._state = False
                    _LOGGER.debug(f"Updated {self._attr_name} load status to {load_status}, state: {self._state}")
                    
                    # If just turned on but no brightness, use default
                    if self._state and self._brightness == 0:
                        self._brightness = self._default_brightness
                        _LOGGER.debug(f"Set default brightness to {self._brightness} for {self._attr_name}")
                
                # Update Home Assistant state
                self.async_write_ha_state()
                _LOGGER.debug(f"Updated HA state for {self._attr_name}: state={self._state}, brightness={self._brightness}")
                
            except json.JSONDecodeError as ex:
                _LOGGER.error(f"Failed to parse MQTT message as JSON: {msg.payload}. Error: {ex}")
            except Exception as ex:
                _LOGGER.error(f"Error handling MQTT message for {self._attr_name}: {ex}")
        
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
        
        # Use direct command format for simplified control    
        simple_payload = f"{self._instance} {RVC_CMD_ON} {rvc_brightness}"
        
        # Publish to direct command topic
        await mqtt.async_publish(
            self.hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
        )
        
        # Update state if optimistic
        if self._optimistic:
            self._state = True
            self._brightness = rvc_brightness
            self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn the light off."""
        # Use direct command format for simplified control
        simple_payload = f"{self._instance} {RVC_CMD_OFF} 0"
        
        # Publish to direct command topic
        await mqtt.async_publish(
            self.hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
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
        
    async def async_toggle(self, **kwargs: Any) -> None:
        """Toggle the light on/off."""
        # Use direct command format for simplified control
        simple_payload = f"{self._instance} {RVC_CMD_TOGGLE} 100"
        
        # Publish to direct command topic
        await mqtt.async_publish(
            self.hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
        )
        
        # Update state if optimistic
        if self._optimistic:
            self._state = not self._state
            if self._state and self._brightness == 0:
                self._brightness = self._default_brightness
            self.async_write_ha_state()
    
    async def async_ramp_up(self, **kwargs: Any) -> None:
        """Start ramping up brightness."""
        # Use direct command format for simplified control
        simple_payload = f"{self._instance} {RVC_CMD_RAMP_UP} 100"
        
        # Publish to direct command topic
        await mqtt.async_publish(
            self.hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
        )
    
    async def async_ramp_down(self, **kwargs: Any) -> None:
        """Start ramping down brightness."""
        # Use direct command format for simplified control
        simple_payload = f"{self._instance} {RVC_CMD_RAMP_DOWN} 100"
        
        # Publish to direct command topic
        await mqtt.async_publish(
            self.hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
        )
    
    async def async_stop_ramp(self, **kwargs: Any) -> None:
        """Stop any ongoing ramping."""
        # Use direct command format for simplified control
        simple_payload = f"{self._instance} {RVC_CMD_STOP} 0"
        
        # Publish to direct command topic
        await mqtt.async_publish(
            self.hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
        )
