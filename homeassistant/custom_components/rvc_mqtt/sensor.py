"""
Support for RVC MQTT sensors.
For more details about this platform, please refer to the documentation at
https://github.com/username/rvc-ha
"""
import logging
import json
from datetime import timedelta
from typing import Any, Dict, List, Optional, Union

from homeassistant.helpers.event import async_track_point_in_time
import homeassistant.util.dt as dt_util

import voluptuous as vol

from homeassistant.components import mqtt
from homeassistant.components.mqtt.sensor import MqttSensor
from homeassistant.components.sensor import (
    PLATFORM_SCHEMA,
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.const import (
    CONF_DEVICE,
    CONF_FORCE_UPDATE,
    CONF_ICON,
    CONF_NAME,
    CONF_UNIQUE_ID,
    CONF_UNIT_OF_MEASUREMENT,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType

from . import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Configuration validation schemas
MQTT_SENSOR_SCHEMA = vol.Schema(
    {
        vol.Required("platform"): cv.string,
        vol.Required("state_topic"): cv.string,
        vol.Required("name"): cv.string,
        vol.Required("unique_id"): cv.string,
        vol.Optional("device_class"): cv.string,
        vol.Optional("state_class"): cv.string,
        vol.Optional("unit_of_measurement"): cv.string,
        vol.Optional("value_template"): cv.template,
        vol.Optional("icon"): cv.icon,
        vol.Optional("qos", default=0): vol.All(vol.Coerce(int), vol.In([0, 1, 2])),
        vol.Optional("expire_after"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("force_update", default=False): cv.boolean,
        vol.Optional("availability_topic"): cv.string,
        vol.Optional("payload_available", default="online"): cv.string,
        vol.Optional("payload_not_available", default="offline"): cv.string,
        vol.Optional("device"): vol.Schema(
            {
                vol.Optional("identifiers"): vol.All(cv.ensure_list, [cv.string]),
                vol.Optional("name"): cv.string,
                vol.Optional("manufacturer"): cv.string,
                vol.Optional("model"): cv.string,
            }
        ),
    }
)

PLATFORM_SCHEMA = vol.Schema(
    {
        vol.Required("sensor"): vol.All(cv.ensure_list, [MQTT_SENSOR_SCHEMA]),
    },
    extra=vol.ALLOW_EXTRA,
)

async def async_setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    async_add_entities: AddEntitiesCallback,
    discovery_info: Optional[DiscoveryInfoType] = None,
) -> None:
    """Set up the RVC MQTT sensors from configuration.yaml."""
    _LOGGER.info(f"Setting up RVC MQTT sensors")
    
    sensors = []
    
    # If we have discovery info, use it (from the __init__.py)
    if discovery_info is not None and "sensor" in discovery_info:
        conf = discovery_info.get("sensor", [])
        _LOGGER.info(f"Setting up {len(conf)} sensors from discovery info")
    else:
        # Otherwise try to get it from config
        conf = config.get("sensor", [])
        _LOGGER.info(f"Setting up {len(conf)} sensors from config")
    
    for sensor_conf in conf:
        _LOGGER.info(f"Setting up sensor: {sensor_conf.get(CONF_NAME)}")
        # Extract configuration
        unique_id = sensor_conf.get(CONF_UNIQUE_ID)
        name = sensor_conf.get(CONF_NAME)
        state_topic = sensor_conf.get("state_topic")
        device_class = sensor_conf.get("device_class")
        state_class = sensor_conf.get("state_class")
        unit = sensor_conf.get(CONF_UNIT_OF_MEASUREMENT)
        icon = sensor_conf.get(CONF_ICON)
        force_update = sensor_conf.get(CONF_FORCE_UPDATE, False)
        qos = sensor_conf.get("qos", 0)
        expire_after = sensor_conf.get("expire_after")
        
        # Process value template
        value_template = sensor_conf.get("value_template")
        if value_template is not None:
            if isinstance(value_template, str):
                # Convert string to Template object
                try:
                    value_template = cv.template(value_template)
                    value_template.hass = hass
                except Exception as e:
                    _LOGGER.error(f"Error creating template from string for {name}: {e}")
            else:
                # It should already be a Template object
                try:
                    value_template.hass = hass
                except AttributeError:
                    _LOGGER.warning(f"Could not set hass on template for {name}")
        
        # Availability settings
        availability_topic = sensor_conf.get("availability_topic")
        payload_available = sensor_conf.get("payload_available", "online")
        payload_not_available = sensor_conf.get("payload_not_available", "offline")
        
        # Device info
        device_info = None
        if CONF_DEVICE in sensor_conf:
            device_conf = sensor_conf.get(CONF_DEVICE)
            device_info = {
                "identifiers": device_conf.get("identifiers", []),
                "name": device_conf.get("name", ""),
                "manufacturer": device_conf.get("manufacturer", ""),
                "model": device_conf.get("model", ""),
            }
        
        # Create the MQTT sensor
        sensor = RvcMqttSensor(
            hass=hass,
            name=name,
            state_topic=state_topic,
            device_class=device_class,
            state_class=state_class,
            unit_of_measurement=unit,
            value_template=value_template,
            force_update=force_update,
            qos=qos,
            expire_after=expire_after,
            availability_topic=availability_topic,
            payload_available=payload_available,
            payload_not_available=payload_not_available,
            unique_id=unique_id,
            device_info=device_info,
            icon=icon
        )
        
        sensors.append(sensor)
    
    if sensors:
        async_add_entities(sensors)

async def async_setup_entry(
    hass: HomeAssistant,
    config_entry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensors from a config entry."""
    # This would be used for UI configuration if implemented
    pass

class RvcMqttSensor(SensorEntity):
    """Implementation of a RVC MQTT sensor."""

    def __init__(
        self,
        hass,
        name,
        state_topic,
        device_class=None,
        state_class=None,
        unit_of_measurement=None,
        value_template=None,
        force_update=False,
        qos=0,
        expire_after=None,
        availability_topic=None,
        payload_available="online",
        payload_not_available="offline",
        unique_id=None,
        device_info=None,
        icon=None
    ):
        """Initialize the sensor."""
        self.hass = hass
        self._attr_name = name
        self._attr_unique_id = unique_id
        self._state = None
        self._attr_icon = icon
        self._attr_force_update = force_update
        
        # Set up device class if specified
        if device_class:
            try:
                self._attr_device_class = SensorDeviceClass(device_class)
            except ValueError:
                self._attr_device_class = None
        
        # Set up state class if specified
        if state_class:
            try:
                self._attr_state_class = SensorStateClass(state_class)
            except ValueError:
                self._attr_state_class = None
        
        # Set unit of measurement
        self._attr_native_unit_of_measurement = unit_of_measurement
        
        # Set up template
        self._template = value_template
        
        # Set up availability
        self._attr_available = True
        self._availability_topic = availability_topic
        self._payload_available = payload_available
        self._payload_not_available = payload_not_available
        
        # Set up device info
        if device_info:
            self._attr_device_info = {
                "identifiers": {(DOMAIN, identifier) for identifier in device_info.get("identifiers", [])},
                "name": device_info.get("name", ""),
                "manufacturer": device_info.get("manufacturer", ""),
                "model": device_info.get("model", ""),
            }
        
        # MQTT subscription setup
        self._qos = qos
        self._expire_after = expire_after
        self._expiration_trigger = None
        self._topic = state_topic
        self._attr_should_poll = False
        
        # Subscribe to state topic
        self._mqtt_subscription = None

    async def async_added_to_hass(self):
        """Subscribe to MQTT events."""
        
        @callback
        def message_received(msg):
            """Handle received MQTT message."""
            try:
                payload = msg.payload
                _LOGGER.debug(f"Received MQTT message on {self._topic}: {payload}")
                
                # Try to process the payload
                if self._template:
                    try:
                        # Use async_render to account for potential complex templates
                        rendered_value = self._template.async_render_with_possible_json_value(
                            payload, ""
                        )
                        _LOGGER.debug(f"Template rendered value for {self._attr_name}: {rendered_value}")
                        
                        # Only update state if the template rendered to a non-empty value
                        if rendered_value not in (None, "", "None"):
                            self._state = rendered_value
                    except Exception as template_error:
                        _LOGGER.error(f"Error rendering template for {self._attr_name}: {template_error}")
                else:
                    # If there's no template, try to handle different payload types appropriately
                    try:
                        # Try to parse as JSON if it's a valid JSON string
                        payload_dict = json.loads(payload)
                        # If it's a dictionary, we can't use it directly as a state
                        if isinstance(payload_dict, dict):
                            _LOGGER.warning(
                                f"Received JSON object for {self._attr_name} but no template to extract a value"
                            )
                        else:
                            self._state = payload_dict
                    except (json.JSONDecodeError, ValueError):
                        # Not JSON or not valid JSON, use as a string
                        self._state = payload
                
                # Reset availability if we received a message
                self._attr_available = True
                
                # Set up expiration if configured
                if self._expire_after:
                    if self._expiration_trigger:
                        self._expiration_trigger()
                    self._expiration_trigger = async_track_point_in_time(
                        self.hass,
                        self._value_expires,
                        dt_util.utcnow() + timedelta(seconds=self._expire_after),
                    )
                
                self.async_write_ha_state()
            except Exception as e:
                _LOGGER.error(f"Error processing MQTT message: {e}")
        
        self._mqtt_subscription = await mqtt.async_subscribe(
            self.hass, self._topic, message_received, self._qos
        )
        
        # Set up availability subscription if configured
        if self._availability_topic:
            
            @callback
            def availability_message_received(msg):
                """Handle availability MQTT messages."""
                if msg.payload == self._payload_available:
                    self._attr_available = True
                elif msg.payload == self._payload_not_available:
                    self._attr_available = False
                self.async_write_ha_state()
            
            await mqtt.async_subscribe(
                self.hass, self._availability_topic, availability_message_received, self._qos
            )
    
    async def async_will_remove_from_hass(self):
        """Unsubscribe when removed."""
        if self._mqtt_subscription:
            self._mqtt_subscription()
            self._mqtt_subscription = None
        
        if self._expiration_trigger:
            self._expiration_trigger()
            self._expiration_trigger = None
    
    @callback
    def _value_expires(self, _):
        """Expire the value and make entity unavailable."""
        self._expiration_trigger = None
        self._attr_available = False
        self.async_write_ha_state()
    
    @property
    def native_value(self):
        """Return the state of the entity."""
        return self._state
