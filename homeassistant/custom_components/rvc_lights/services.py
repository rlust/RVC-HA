"""Services for RVC Lights."""
import json
import logging
import voluptuous as vol

from homeassistant.components import mqtt
from homeassistant.const import ATTR_ENTITY_ID, CONF_DEVICE_ID
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers import entity_registry
from homeassistant.core import HomeAssistant, ServiceCall

from .const import (
    DOMAIN,
    RVC_COMMAND_TOPIC_PREFIX,
    RVC_DIRECT_COMMAND_TOPIC,
    RVC_CMD_ON,
    RVC_CMD_OFF,
    RVC_CMD_TOGGLE,
    RVC_CMD_RAMP_UP,
    RVC_CMD_RAMP_DOWN,
    RVC_CMD_STOP,
    DEFAULT_DELAY_DURATION,
)

_LOGGER = logging.getLogger(__name__)

# Service definitions
SERVICE_TOGGLE = "toggle"
SERVICE_RAMP_UP = "ramp_up"
SERVICE_RAMP_DOWN = "ramp_down"
SERVICE_STOP_RAMP = "stop_ramp"
SERVICE_SEND_COMMAND = "send_command"

# Service schemas
SCHEMA_ENTITY_SERVICE = vol.Schema({
    vol.Required(ATTR_ENTITY_ID): cv.entity_ids,
})

SCHEMA_BRIGHTNESS_SERVICE = vol.Schema({
    vol.Required(ATTR_ENTITY_ID): cv.entity_ids,
    vol.Optional("brightness_level", default=55): vol.All(
        vol.Coerce(int), vol.Range(min=1, max=100)
    ),
    vol.Optional("delay_duration", default=DEFAULT_DELAY_DURATION): vol.All(
        vol.Coerce(int), vol.Range(min=0, max=255)
    ),
})

SCHEMA_SEND_COMMAND = vol.Schema({
    vol.Required(ATTR_ENTITY_ID): cv.entity_ids,
    vol.Required("command"): vol.All(
        vol.Coerce(int), vol.Range(min=0, max=255)
    ),
    vol.Optional("brightness_level"): vol.All(
        vol.Coerce(int), vol.Range(min=0, max=100)
    ),
    vol.Optional("delay_duration", default=DEFAULT_DELAY_DURATION): vol.All(
        vol.Coerce(int), vol.Range(min=0, max=255)
    ),
})

async def async_setup_services(hass: HomeAssistant) -> None:
    """Set up RVC Light services."""
    
    async def async_get_instance_from_entity_id(entity_id: str) -> int:
        """Get the RVC instance ID from an entity ID."""
        entity_reg = entity_registry.async_get(hass)
        entity_entry = entity_reg.async_get(entity_id)
        
        if not entity_entry or not entity_entry.platform == DOMAIN:
            return None
            
        # Get light entity and extract instance ID
        state = hass.states.get(entity_id)
        if not state:
            return None
            
        # The instance should be accessible via the light's attributes
        if "instance" in state.attributes:
            return state.attributes["instance"]
            
        return None
    
    async def async_handle_toggle_service(call: ServiceCall) -> None:
        """Handle the toggle service call."""
        entity_ids = call.data.get(ATTR_ENTITY_ID, [])
        
        for entity_id in entity_ids:
            instance = await async_get_instance_from_entity_id(entity_id)
            if not instance:
                _LOGGER.error(f"Could not find instance for entity {entity_id}")
                continue
                
            # Send toggle command using direct format
            simple_payload = f"{instance} {RVC_CMD_TOGGLE} 100"
            
            await mqtt.async_publish(
                hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
            )
            _LOGGER.debug(f"Sent toggle command for instance {instance}")
    
    async def async_handle_ramp_service(call: ServiceCall, ramp_up: bool) -> None:
        """Handle the ramp up/down service call."""
        entity_ids = call.data.get(ATTR_ENTITY_ID, [])
        brightness = call.data.get("brightness_level", 100) # Default to max
        
        command = RVC_CMD_RAMP_UP if ramp_up else RVC_CMD_RAMP_DOWN
        command_name = "ramp up" if ramp_up else "ramp down"
        
        for entity_id in entity_ids:
            instance = await async_get_instance_from_entity_id(entity_id)
            if not instance:
                _LOGGER.error(f"Could not find instance for entity {entity_id}")
                continue
                
            # Send ramp command using direct format
            simple_payload = f"{instance} {command} {brightness}"
            
            await mqtt.async_publish(
                hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
            )
            _LOGGER.debug(f"Sent {command_name} command for instance {instance}: {brightness}%")
    
    async def async_handle_ramp_up_service(call: ServiceCall) -> None:
        """Handle the ramp up service call."""
        await async_handle_ramp_service(call, True)
    
    async def async_handle_ramp_down_service(call: ServiceCall) -> None:
        """Handle the ramp down service call."""
        await async_handle_ramp_service(call, False)
    
    async def async_handle_stop_ramp_service(call: ServiceCall) -> None:
        """Handle the stop ramp service call."""
        entity_ids = call.data.get(ATTR_ENTITY_ID, [])
        
        for entity_id in entity_ids:
            instance = await async_get_instance_from_entity_id(entity_id)
            if not instance:
                _LOGGER.error(f"Could not find instance for entity {entity_id}")
                continue
                
            # Send stop command using direct format
            simple_payload = f"{instance} {RVC_CMD_STOP} 0"
            
            await mqtt.async_publish(
                hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
            )
            _LOGGER.debug(f"Sent stop ramp command for instance {instance}")
    
    async def async_handle_send_command(call: ServiceCall) -> None:
        """Handle the send custom command service call."""
        entity_ids = call.data.get(ATTR_ENTITY_ID, [])
        command = call.data.get("command")
        brightness = call.data.get("brightness_level", 0)
        # Note: delay parameter is no longer used with direct commands
        
        for entity_id in entity_ids:
            instance = await async_get_instance_from_entity_id(entity_id)
            if not instance:
                _LOGGER.error(f"Could not find instance for entity {entity_id}")
                continue
                
            # Send custom command using direct format
            simple_payload = f"{instance} {command} {brightness}"
            
            await mqtt.async_publish(
                hass, RVC_DIRECT_COMMAND_TOPIC, simple_payload, 0, False
            )
            _LOGGER.debug(f"Sent custom command {command} for instance {instance} with brightness {brightness}")
    
    # Register services
    hass.services.async_register(
        DOMAIN, SERVICE_TOGGLE, async_handle_toggle_service, SCHEMA_ENTITY_SERVICE
    )
    
    hass.services.async_register(
        DOMAIN, SERVICE_RAMP_UP, async_handle_ramp_up_service, SCHEMA_BRIGHTNESS_SERVICE
    )
    
    hass.services.async_register(
        DOMAIN, SERVICE_RAMP_DOWN, async_handle_ramp_down_service, SCHEMA_BRIGHTNESS_SERVICE
    )
    
    hass.services.async_register(
        DOMAIN, SERVICE_STOP_RAMP, async_handle_stop_ramp_service, SCHEMA_ENTITY_SERVICE
    )
    
    hass.services.async_register(
        DOMAIN, SERVICE_SEND_COMMAND, async_handle_send_command, SCHEMA_SEND_COMMAND
    )
