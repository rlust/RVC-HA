"""Config flow for RV-C integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.data_entry_flow import FlowResult
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = vol.Schema({
    vol.Required("mqtt_topic_prefix", default="RVC"): cv.string,
})

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the RV-C component."""
    if DOMAIN not in config:
        return True

    hass.async_create_task(
        hass.config_entries.flow.async_init(
            DOMAIN,
            context={"source": config_entries.SOURCE_IMPORT},
            data=config[DOMAIN],
        )
    )

    return True

class RVCConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for RV-C."""

    VERSION = 1

    async def async_step_import(self, import_config: dict[str, Any]) -> FlowResult:
        """Import configuration from YAML."""
        return self.async_create_entry(
            title="RV-C (YAML)",
            data=import_config,
        )

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        if user_input is None:
            return self.async_show_form(
                step_id="user",
                data_schema=CONFIG_SCHEMA,
            )

        # Only allow a single instance
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_instance()

        return self.async_create_entry(
            title="RV-C",
            data=user_input,
        )
