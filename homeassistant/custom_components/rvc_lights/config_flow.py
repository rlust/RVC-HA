"""Config flow for RVC Lights integration."""
from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
import homeassistant.helpers.config_validation as cv

from .const import DOMAIN, RVC_LIGHTS, CONF_ENABLE_AUTO_DISCOVERY

_LOGGER = logging.getLogger(__name__)

class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for RVC Lights."""

    VERSION = 1

    async def async_step_user(
        self, user_input=None
    ) -> FlowResult:
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            return self.async_create_entry(
                title="RVC Lights", 
                data=user_input
            )

        # Create a list of predefined lights for display
        light_list = "\n".join([f"• {name} (Instance: {instance})" for instance, name in RVC_LIGHTS.items()])
        
        data_schema = vol.Schema({
            vol.Required(CONF_ENABLE_AUTO_DISCOVERY, default=True): bool,
        })
        
        return self.async_show_form(
            step_id="user", 
            data_schema=data_schema, 
            errors=errors,
            description_placeholders={
                "lights": light_list
            }
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Create the options flow."""
        return OptionsFlowHandler(config_entry)


class OptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for RVC Lights."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input=None) -> FlowResult:
        """Handle the initial step."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        options = self.config_entry.options
        enable_auto_discovery = options.get(CONF_ENABLE_AUTO_DISCOVERY, True)

        # Create a list of predefined lights for display
        light_list = "\n".join([f"• {name} (Instance: {instance})" for instance, name in RVC_LIGHTS.items()])
        
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(CONF_ENABLE_AUTO_DISCOVERY, default=enable_auto_discovery): bool,
            }),
            description_placeholders={
                "lights": light_list
            }
        )
