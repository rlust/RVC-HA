"""
RVC MQTT Custom Component for Home Assistant.
This component allows for YAML configuration of MQTT sensors for RVC devices.
"""
import logging
import os
import yaml

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.discovery import async_load_platform

DOMAIN = "rvc_mqtt"
_LOGGER = logging.getLogger(__name__)

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the RVC MQTT component."""
    hass.data.setdefault(DOMAIN, {})
    
    # Load the configuration from the main YAML file
    config_path = os.path.join(hass.config.config_dir, "custom_components", DOMAIN, "rvc_sensors.yaml")
    _LOGGER.info(f"Loading RVC MQTT sensors from {config_path}")
    
    component_config = {"sensor": []}
    
    try:
        with open(config_path, 'r') as file:
            main_config = yaml.safe_load(file)
            _LOGGER.info(f"Loaded main sensor configuration")
            
            if main_config and 'sensor' in main_config:
                component_config["sensor"].extend(main_config.get("sensor", []))
                _LOGGER.info(f"Loaded {len(main_config.get('sensor', []))} sensors from main config")
    except Exception as e:
        _LOGGER.error(f"Error loading main RVC MQTT configuration: {e}")
    
    # Load additional sensor configurations
    additional_configs = ["circulation_pump_sensors.yaml", "thermostat_sensors.yaml"]
    
    for add_config_file in additional_configs:
        try:
            add_config_path = os.path.join(hass.config.config_dir, "custom_components", DOMAIN, add_config_file)
            _LOGGER.info(f"Loading additional sensors from {add_config_path}")
            
            with open(add_config_path, 'r') as file:
                add_config = yaml.safe_load(file)
                
                if add_config and 'sensor' in add_config:
                    component_config["sensor"].extend(add_config.get("sensor", []))
                    _LOGGER.info(f"Loaded {len(add_config.get('sensor', []))} sensors from {add_config_file}")
        except Exception as e:
            _LOGGER.error(f"Error loading additional configuration {add_config_file}: {e}")
    
    # Forward the combined configuration to the sensor platform
    if component_config["sensor"]:
        hass.async_create_task(
            async_load_platform(hass, 'sensor', DOMAIN, component_config, config)
        )
        _LOGGER.info(f"Set up {len(component_config.get('sensor', []))} total RVC MQTT sensors")
    
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up RVC MQTT from a config entry."""
    hass.async_create_task(
        hass.config_entries.async_forward_entry_setup(entry, "sensor")
    )
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_forward_entry_unload(entry, "sensor")
