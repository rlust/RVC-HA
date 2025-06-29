"""Discovery support for RVC Lights."""
import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional

from homeassistant.components import mqtt
from homeassistant.core import callback, HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.typing import DiscoveryInfoType

from .const import (
    DOMAIN,
    RVC_STATUS_TOPIC_PREFIX,
)

_LOGGER = logging.getLogger(__name__)

DISCOVERY_SIGNAL = f"{DOMAIN}_discovery"
STATUS_TOPIC_PATTERN = re.compile(f"{RVC_STATUS_TOPIC_PREFIX}/([0-9]+)")

async def async_start_discovery(hass: HomeAssistant) -> None:
    """Start RVC light discovery."""
    
    @callback
    def async_device_message_received(msg):
        """Process the received message."""
        topic = msg.topic
        
        # Extract instance number from topic
        match = STATUS_TOPIC_PATTERN.match(topic)
        if not match:
            return
        
        instance = int(match.group(1))
        
        try:
            payload = json.loads(msg.payload)
            if "name" in payload and payload["name"] == "DC_DIMMER_STATUS_3":
                _LOGGER.info(f"Discovered RVC light with instance: {instance}")
                
                # Prepare discovery info
                discovery_info = {
                    "name": f"RVC Light {instance}",
                    "unique_id": f"rvc_light_{instance}",
                    "instance": instance,
                    "optimistic": False,
                    "default_brightness": 55,
                }
                
                # Dispatch discovery signal with the discovery info
                async_dispatcher_send(
                    hass, DISCOVERY_SIGNAL, discovery_info
                )
                
        except json.JSONDecodeError:
            _LOGGER.error(f"Failed to parse payload as JSON: {msg.payload}")
        except Exception as e:
            _LOGGER.error(f"Error processing discovery message: {e}")
    
    # Subscribe to all DC_DIMMER_STATUS_3 topics
    status_topic_filter = f"{RVC_STATUS_TOPIC_PREFIX}/+"
    await mqtt.async_subscribe(
        hass, status_topic_filter, async_device_message_received, 1
    )
    
    _LOGGER.info(f"Subscribed to {status_topic_filter} for RVC light discovery")
