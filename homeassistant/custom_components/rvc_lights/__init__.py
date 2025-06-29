"""RVC Lights integration for Home Assistant."""
import logging

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, SOURCE_IMPORT
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
    """Set up the RVC Lights component from YAML."""
    if DOMAIN in config:
        # Create a config entry from the YAML configuration.
        # This will trigger async_setup_entry.
        if not hass.config_entries.async_entries(DOMAIN):
            hass.async_create_task(
                hass.config_entries.flow.async_init(
                    DOMAIN,
                    context={"source": SOURCE_IMPORT},
                    data=config[DOMAIN],
                )
            )
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up RVC Lights from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    # Perform one-time setup for services and discovery
    if "setup_complete" not in hass.data[DOMAIN]:
        _LOGGER.debug("Performing one-time setup for RVC Lights")
        
        enable_auto_discovery = entry.data.get(CONF_ENABLE_AUTO_DISCOVERY, True)
        
        if enable_auto_discovery:
            _LOGGER.info("Starting RVC Lights auto-discovery")
            await async_start_discovery(hass)
        
        await async_setup_services(hass)
        
        hass.data[DOMAIN]["setup_complete"] = True

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok
