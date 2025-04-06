"""RVC Lights integration for Home Assistant."""
import logging

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
import homeassistant.helpers.config_validation as cv
from homeassistant.const import CONF_DEVICES, Platform

from .const import DOMAIN, CONF_ENABLE_AUTO_DISCOVERY
from .discovery import async_start_discovery
from .services import async_setup_services

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = vol.Schema(
    {DOMAIN: vol.Schema({
        vol.Optional(CONF_ENABLE_AUTO_DISCOVERY, default=True): cv.boolean,
    })}, 
    extra=vol.ALLOW_EXTRA
)

PLATFORMS = [Platform.LIGHT]

async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the RVC Lights component."""
    hass.data.setdefault(DOMAIN, {})
    
    # Extract configuration
    if DOMAIN in config:
        conf = config[DOMAIN]
        enable_auto_discovery = conf.get(CONF_ENABLE_AUTO_DISCOVERY, True)
    else:
        enable_auto_discovery = True
    
    # Store configuration in hass.data for access by platform
    hass.data[DOMAIN] = {
        CONF_ENABLE_AUTO_DISCOVERY: enable_auto_discovery
    }
    
    _LOGGER.info(f"Setting up RVC Lights component with auto-discovery: {enable_auto_discovery}")
    
    # Load the light platform using the recommended approach
    await hass.async_add_executor_job(
        hass.helpers.discovery.load_platform,
        "light", DOMAIN, {}, config
    )
    
    # Start discovery if enabled
    if enable_auto_discovery:
        _LOGGER.info("Starting RVC Lights auto-discovery")
        await async_start_discovery(hass)
    
    # Register component services
    await async_setup_services(hass)
    
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up RVC Lights from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok
