"""Config flow for RVC MQTT integration."""
from homeassistant import config_entries

DOMAIN = "rvc_mqtt"

class RvcMqttConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for RVC MQTT."""

    VERSION = 1

    async def async_step_import(self, import_config):
        """Handle import from configuration.yaml."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        return self.async_create_entry(title="RVC MQTT (YAML)", data=import_config)
