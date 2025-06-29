"""
This component allows for YAML configuration of MQTT sensors for RVC devices.
"""
import asyncio
import logging
import os
import yaml

from homeassistant.config_entries import ConfigEntry, SOURCE_IMPORT
from homeassistant.core import HomeAssistant
from homeassistant.helpers.discovery import async_load_platform

DOMAIN = "rvc_mqtt"
_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "climate"]

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the RVC MQTT component from YAML."""
    if DOMAIN in config:
        if not hass.config_entries.async_entries(DOMAIN):
            hass.async_create_task(
                hass.config_entries.flow.async_init(
                    DOMAIN,
                    context={"source": SOURCE_IMPORT},
                    data=config[DOMAIN],
                )
            )
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up RVC MQTT from a config entry."""
    
    # Load sensor configurations asynchronously
    sensor_config = await async_load_rvc_yaml(hass, "rvc_sensors.yaml")
    
    additional_sensor_configs = [
        "circulation_pump_sensors.yaml",
        "thermostat_sensors.yaml"
    ]
    
    for config_file in additional_sensor_configs:
        additional_config = await async_load_rvc_yaml(hass, config_file)
        if additional_config and 'sensor' in additional_config:
            if 'sensor' not in sensor_config:
                sensor_config['sensor'] = []
            sensor_config["sensor"].extend(additional_config["sensor"])

    # Load climate configuration asynchronously
    climate_config = await async_load_rvc_yaml(hass, "climate.yaml")
    
    # Set up sensor platform if there's a configuration
    if sensor_config and sensor_config.get("sensor"):
        _LOGGER.info(f"Setting up {len(sensor_config['sensor'])} RVC MQTT sensors")
        hass.async_create_task(
            async_load_platform(hass, 'sensor', DOMAIN, sensor_config, {})
        )
    
    # Set up climate platform if there's a configuration
    if climate_config and climate_config.get("climate"):
        _LOGGER.info(f"Setting up {len(climate_config['climate'])} RVC MQTT climate controls")
        hass.async_create_task(
            async_load_platform(hass, 'climate', DOMAIN, climate_config, {})
        )

    return True

async def async_load_rvc_yaml(hass: HomeAssistant, filename: str) -> dict:
    """Load a YAML file asynchronously from the custom component's directory."""
    config_path = os.path.join(hass.config.config_dir, "custom_components", DOMAIN, filename)
    
    def load_yaml_sync():
        """Synchronous YAML loading function."""
        if not os.path.exists(config_path):
            _LOGGER.warning(f"Configuration file not found: {config_path}")
            return {}
        try:
            with open(config_path, 'r') as file:
                return yaml.safe_load(file) or {}
        except Exception as e:
            _LOGGER.error(f"Error loading YAML file {config_path}: {e}")
            return {}

    return await hass.async_add_executor_job(load_yaml_sync)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # Unload platforms in parallel
    unload_ok = all(
        await asyncio.gather(
            *[
                hass.config_entries.async_forward_entry_unload(entry, platform)
                for platform in PLATFORMS
            ]
        )
    )
    return unload_ok
