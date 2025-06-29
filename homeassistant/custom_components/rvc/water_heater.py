"""RV-C Water Heater Platform."""
from __future__ import annotations

import json
import logging
from typing import Any

from homeassistant.components.water_heater import (
    WaterHeaterEntity,
    WaterHeaterEntityFeature,
)
from homeassistant.components.mqtt import async_publish
from homeassistant.const import (
    ATTR_TEMPERATURE,
    TEMP_CELSIUS,
    TEMP_FAHRENHEIT,
    STATE_OFF,
    STATE_ON,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.config_entries import ConfigEntry
from homeassistant.components import mqtt

from .const import (
    DOMAIN,
    WATERHEATER_STATUS_TOPIC,
    ATTR_INSTANCE,
    ATTR_WATER_TEMP,
    ATTR_WATER_TEMP_F,
)

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up RV-C water heater from config entry."""
    
    # Subscribe to discovery topic
    @callback
    def async_device_message_received(msg):
        """Handle new MQTT messages."""
        try:
            data = json.loads(msg.payload)
            instance = data.get(ATTR_INSTANCE)
            
            if instance is not None:
                entity_id = f"water_heater_{instance}"
                if entity_id not in discovered_devices:
                    discovered_devices.add(entity_id)
                    async_add_entities([RVCWaterHeater(hass, data)])
                    
        except ValueError:
            _LOGGER.warning("Invalid JSON payload received")

    discovered_devices = set()
    
    await mqtt.async_subscribe(
        hass, f"{WATERHEATER_STATUS_TOPIC}/+", async_device_message_received, 0
    )

class RVCWaterHeater(WaterHeaterEntity):
    """Representation of an RV-C Water Heater."""

    def __init__(self, hass: HomeAssistant, config: dict) -> None:
        """Initialize the water heater."""
        self.hass = hass
        self._instance = config[ATTR_INSTANCE]
        self._name = f"Water Heater {self._instance}"
        self._unique_id = f"rvc_water_heater_{self._instance}"
        self._topic = f"{WATERHEATER_STATUS_TOPIC}/{self._instance}"
        self._attr_temperature_unit = TEMP_FAHRENHEIT
        self._attr_supported_features = WaterHeaterEntityFeature.TARGET_TEMPERATURE
        self._attr_min_temp = 32
        self._attr_max_temp = 180
        self._attr_target_temperature = 120
        self._attr_current_temperature = None
        self._state = STATE_OFF
        self._attr_available = False
        self._update_from_data(config)

    @property
    def name(self) -> str:
        """Return the name of the water heater."""
        return self._name

    @property
    def unique_id(self) -> str:
        """Return a unique ID."""
        return self._unique_id

    @property
    def state(self) -> str:
        """Return the current state."""
        return self._state

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
        if ATTR_WATER_TEMP_F in data:
            self._attr_current_temperature = float(data[ATTR_WATER_TEMP_F])
            self._attr_available = True
            
        burner_status = data.get("burner_status")
        operating_modes = data.get("operating_modes")
        
        if burner_status == "00" and operating_modes == "0":
            self._state = STATE_OFF
        else:
            self._state = STATE_ON

    async def async_set_temperature(self, **kwargs: Any) -> None:
        """Set new target temperature."""
        temperature = kwargs.get(ATTR_TEMPERATURE)
        if temperature is None:
            return

        # Publish the temperature setting command to MQTT
        await async_publish(
            self.hass,
            f"RVC/WATERHEATER_COMMAND/{self._instance}/set",
            json.dumps({"temperature": temperature}),
        )
        self._attr_target_temperature = temperature
