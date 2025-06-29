"""RV-C Climate Platform."""
from __future__ import annotations

import json
import logging
from typing import Any

from homeassistant.components.climate import (
    ClimateEntity,
    ClimateEntityFeature,
    HVACMode,
    HVACAction,
)
from homeassistant.components.mqtt import async_publish
from homeassistant.const import (
    ATTR_TEMPERATURE,
    TEMP_CELSIUS,
    TEMP_FAHRENHEIT,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.config_entries import ConfigEntry
from homeassistant.components import mqtt

from .const import (
    DOMAIN,
    AC_STATUS_TOPIC,
    ATTR_INSTANCE,
    ATTR_AC_MODE,
    ATTR_AC_FAN_SPEED,
    ATTR_AC_OUTPUT,
)

_LOGGER = logging.getLogger(__name__)

# Map RV-C modes to Home Assistant modes
HVAC_MODES = {
    "0": HVACMode.OFF,
    "1": HVACMode.AUTO,  # manual mode maps to auto
    "2": HVACMode.COOL,
    "3": HVACMode.HEAT,
}

async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up RV-C climate from config entry."""
    
    @callback
    def async_device_message_received(msg):
        """Handle new MQTT messages."""
        try:
            data = json.loads(msg.payload)
            instance = data.get(ATTR_INSTANCE)
            
            if instance is not None:
                entity_id = f"climate_{instance}"
                if entity_id not in discovered_devices:
                    discovered_devices.add(entity_id)
                    async_add_entities([RVCClimate(hass, data)])
                    
        except ValueError:
            _LOGGER.warning("Invalid JSON payload received")

    discovered_devices = set()
    
    await mqtt.async_subscribe(
        hass, f"{AC_STATUS_TOPIC}/+", async_device_message_received, 0
    )

class RVCClimate(ClimateEntity):
    """Representation of an RV-C Climate device."""

    def __init__(self, hass: HomeAssistant, config: dict) -> None:
        """Initialize the climate device."""
        self.hass = hass
        self._instance = config[ATTR_INSTANCE]
        self._name = f"HVAC {self._instance}"
        self._unique_id = f"rvc_climate_{self._instance}"
        self._topic = f"{AC_STATUS_TOPIC}/{self._instance}"
        
        self._attr_temperature_unit = TEMP_FAHRENHEIT
        self._attr_supported_features = (
            ClimateEntityFeature.TARGET_TEMPERATURE |
            ClimateEntityFeature.FAN_MODE
        )
        self._attr_hvac_modes = list(HVAC_MODES.values())
        self._attr_fan_modes = ["auto", "low", "medium", "high"]
        self._attr_min_temp = 60
        self._attr_max_temp = 90
        self._attr_target_temperature = 72
        self._attr_current_temperature = None
        self._attr_fan_mode = "auto"
        self._attr_hvac_mode = HVACMode.OFF
        self._attr_available = False
        self._update_from_data(config)

    @property
    def name(self) -> str:
        """Return the name of the climate device."""
        return self._name

    @property
    def unique_id(self) -> str:
        """Return a unique ID."""
        return self._unique_id

    async def async_added_to_hass(self) -> None:
        """Subscribe to MQTT events."""
        @callback
        def message_received(msg):
            """Handle new MQTT messages."""
            try:
                data = json.loads(msg.payload)
                self._update_from_data(data)
                self.async_write_ha_state()
            except ValueError:
                _LOGGER.warning("Invalid JSON payload received")

        await mqtt.async_subscribe(
            self.hass, self._topic, message_received, 0
        )

    @callback
    def _update_from_data(self, data: dict[str, Any]) -> None:
        """Update the entity from the MQTT data."""
        self._attr_available = True
        
        # Update mode
        mode = data.get(ATTR_AC_MODE, "0")
        self._attr_hvac_mode = HVAC_MODES.get(mode, HVACMode.OFF)
        
        # Update fan speed
        fan_speed = int(data.get(ATTR_AC_FAN_SPEED, 0))
        if fan_speed == 0:
            self._attr_fan_mode = "auto"
        elif fan_speed < 33:
            self._attr_fan_mode = "low"
        elif fan_speed < 66:
            self._attr_fan_mode = "medium"
        else:
            self._attr_fan_mode = "high"

    async def async_set_temperature(self, **kwargs: Any) -> None:
        """Set new target temperature."""
        temperature = kwargs.get(ATTR_TEMPERATURE)
        if temperature is None:
            return

        await async_publish(
            self.hass,
            f"RVC/AIR_CONDITIONER_COMMAND/{self._instance}/set",
            json.dumps({"temperature": temperature}),
        )
        self._attr_target_temperature = temperature

    async def async_set_fan_mode(self, fan_mode: str) -> None:
        """Set new fan mode."""
        fan_speed = {
            "auto": 0,
            "low": 33,
            "medium": 66,
            "high": 100,
        }.get(fan_mode, 0)

        await async_publish(
            self.hass,
            f"RVC/AIR_CONDITIONER_COMMAND/{self._instance}/set",
            json.dumps({"fan_speed": fan_speed}),
        )
        self._attr_fan_mode = fan_mode

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        """Set new operation mode."""
        mode = next((k for k, v in HVAC_MODES.items() if v == hvac_mode), "0")
        
        await async_publish(
            self.hass,
            f"RVC/AIR_CONDITIONER_COMMAND/{self._instance}/set",
            json.dumps({"mode": mode}),
        )
        self._attr_hvac_mode = hvac_mode
