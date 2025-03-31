/**
 * RV-C MQTT Control Application with Home Assistant Integration
 * Main server file
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, '.env') 
    : (fs.existsSync(path.join(__dirname, '.env.local')) 
        ? path.join(__dirname, '.env.local') 
        : path.join(__dirname, '.env'))
});
const express = require('express');
const mqtt = require('mqtt');
const basicAuth = require('express-basic-auth');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors'); // Require the cors package

// SQLite3 is used for logging functionality

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors()); // Apply CORS middleware globally

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load environment variables
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'logs.db');
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';

// Initialize SQLite database for logging
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    logEvent('database', 'system', 'db_error', `Error opening: ${err.message}`);
  } else {
    console.log('Connected to the SQLite database');
    
    // Create logs table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceId TEXT NOT NULL,
        deviceType TEXT NOT NULL,
        event TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating logs table:', err.message);
      } else {
        console.log('Logs table ready');
      }
    });
  }
});

// Device storage
const devices = new Map();

// MQTT Client setup
const mqttOptions = {
  clientId: `rv-c-mqtt-control-${Math.random().toString(16).slice(2, 8)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
};

const mqttClient = mqtt.connect(MQTT_BROKER, mqttOptions);

// MQTT Topics
const RVC_TOPIC_PREFIX = 'RVC/';
const RVC_COMMAND_TOPIC = `${RVC_TOPIC_PREFIX}command`;
const RVC_STATUS_TOPIC = `${RVC_TOPIC_PREFIX}status`;
const RVC_DISCOVERY_TOPIC = `${RVC_TOPIC_PREFIX}discovery`;

// Function to handle device commands
function handleCommand(deviceId, payload) {
  try {
    console.log(`Processing command for device ${deviceId}:`, payload);
    
    // Extract command, deviceType, and parameters
    const { command, deviceType: payloadDeviceType, ...parameters } = payload;
    
    if (!command) {
      console.error('No command specified in payload');
      return { success: false, error: 'No command specified' };
    }
    
    // Get the device state
    const deviceState = devices.get(deviceId) || {};
    
    // Use deviceType from payload if provided, otherwise from device state
    const deviceType = payloadDeviceType || deviceState.deviceType;
    
    if (!deviceType) {
      console.error(`Missing deviceType for ${deviceId}`);
      return { success: false, error: 'Missing deviceType' };
    }
    
    // Check if the device type is supported
    if (!deviceTypes[deviceType]) {
      console.error(`Unsupported device type: ${deviceType}`);
      return { success: false, error: `Unsupported device type: ${deviceType}` };
    }
    
    // Check if the command is supported for this device type
    if (!deviceTypes[deviceType].commands[command]) {
      console.error(`Unsupported command ${command} for device type ${deviceType}`);
      return { success: false, error: `Unsupported command: ${command}` };
    }
    
    // Validate command parameters
    const commandDef = deviceTypes[deviceType].commands[command];
    const validationResult = validateParameters(parameters, commandDef.parameters);
    
    if (!validationResult.valid) {
      console.error(`Parameter validation failed: ${validationResult.error}`);
      return { success: false, error: validationResult.error };
    }
    
    // Execute the command
    const result = commandDef.execute(deviceId, parameters);
    
    return result;
  } catch (error) {
    console.error('Error handling command:', error);
    return { success: false, error: error.message };
  }
}

// Function to validate command parameters
function validateParameters(parameters, parameterDefinitions) {
  for (const [paramName, paramConfig] of Object.entries(parameterDefinitions)) {
    // Check required parameters
    if (paramConfig.required && parameters[paramName] === undefined) {
      return { valid: false, error: `Missing required parameter: ${paramName}` };
    }
    
    // Skip validation for optional parameters that aren't provided
    if (parameters[paramName] === undefined) {
      continue;
    }
    
    // Validate parameter type
    if (paramConfig.type === 'number' && typeof parameters[paramName] !== 'number') {
      return { valid: false, error: `Parameter ${paramName} must be a number` };
    }
    
    if (paramConfig.type === 'string' && typeof parameters[paramName] !== 'string') {
      return { valid: false, error: `Parameter ${paramName} must be a string` };
    }
    
    // Validate parameter range for numbers
    if (paramConfig.type === 'number') {
      if (paramConfig.min !== undefined && parameters[paramName] < paramConfig.min) {
        return { valid: false, error: `Parameter ${paramName} must be at least ${paramConfig.min}` };
      }
      
      if (paramConfig.max !== undefined && parameters[paramName] > paramConfig.max) {
        return { valid: false, error: `Parameter ${paramName} must be at most ${paramConfig.max}` };
      }
    }
    
    // Validate enum values for strings
    if (paramConfig.type === 'string' && paramConfig.enum) {
      if (!paramConfig.enum.includes(parameters[paramName])) {
        return { valid: false, error: `Parameter ${paramName} must be one of: ${paramConfig.enum.join(', ')}` };
      }
    }
  }
  
  return { valid: true };
}

// Function to publish discovery information for Home Assistant
function publishDiscoveryInfo() {
  console.log('Publishing discovery information for Home Assistant');
  
  // Publish discovery information for each device
  devices.forEach((device, deviceId) => {
    const discoveryTopic = `homeassistant/sensor/${deviceId}/config`;
    const discoveryPayload = {
      name: device.name,
      unique_id: deviceId,
      state_topic: `${RVC_STATUS_TOPIC}/${deviceId}`,
      command_topic: `${RVC_COMMAND_TOPIC}/${deviceId}`,
      device: {
        identifiers: [deviceId],
        name: device.name,
        model: device.type,
        manufacturer: 'RV-C',
        sw_version: '1.0.0'
      }
    };
    
    mqttClient.publish(discoveryTopic, JSON.stringify(discoveryPayload), { retain: true });
  });
}

// Define supported device types and their commands
const deviceTypes = {
  dimmer: {
    commands: {
      setBrightness: {
        parameters: {
          brightness: { type: 'number', min: 0, max: 100, required: true }
        },
        execute: (deviceId, parameters) => {
          // In a real implementation, this would send the command to the RV-C device
          // For now, we'll just update the device state
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'dimmer' };
          const updatedState = { ...currentState, brightness: parameters.brightness };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'dimmer', 'brightness_set', updatedState);
          
          return { success: true, message: `Set brightness to ${parameters.brightness}%` };
        }
      },
      turnOn: {
        parameters: {
          instance: { type: 'number', required: false },
          delay: { type: 'number', min: 0, max: 255, required: false }
        },
        execute: (deviceId, parameters = {}) => {
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'dimmer' };
          
          // Create RV-C specific command data based on the protocol
          const rvcCommand = {
            command: 2, // 2 = on delay
            command_definition: "on delay",
            data: "2EFFC802FF00FFFF", // Example from provided data
            delay_duration: parameters.delay || 255,
            desired_level: 100,
            dgn: "1FEDB",
            group: "11111111",
            instance: parameters.instance || 46, // Default to 46 if not specified
            interlock: "00",
            interlock_definition: "no interlock active",
            name: "DC_DIMMER_COMMAND_2",
            timestamp: new Date().getTime() / 1000
          };
          
          // Update the device state
          const updatedState = { 
            ...currentState, 
            brightness: 100, 
            state: 'ON',
            rvc_data: rvcCommand // Store the RV-C specific data
          };
          
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          // Also publish to the RV-C specific topic format
          const rvcTopic = `RVC/DC_DIMMER_COMMAND_2/${rvcCommand.instance}`;
          mqttClient.publish(rvcTopic, JSON.stringify(rvcCommand), { retain: true });
          
          logEvent(deviceId, 'dimmer', 'turned_on', JSON.stringify(updatedState));
          
          return { success: true, message: 'Turned on dimmer' };
        }
      },
      turnOff: {
        parameters: {
          instance: { type: 'number', required: false }
        },
        execute: (deviceId, parameters = {}) => {
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'dimmer' };
          
          // Create RV-C specific command data based on the protocol
          const rvcCommand = {
            command: 3, // 3 = off
            command_definition: "off",
            data: "2EFFC803FF00FFFF", // Example from provided data
            delay_duration: 255,
            desired_level: 0,
            dgn: "1FEDB",
            group: "11111111",
            instance: parameters.instance || 46, // Default to 46 if not specified
            interlock: "00",
            interlock_definition: "no interlock active",
            name: "DC_DIMMER_COMMAND_2",
            timestamp: new Date().getTime() / 1000
          };
          
          // Update the device state
          const updatedState = { 
            ...currentState, 
            brightness: 0, 
            state: 'OFF',
            rvc_data: rvcCommand // Store the RV-C specific data
          };
          
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          // Also publish to the RV-C specific topic format
          const rvcTopic = `RVC/DC_DIMMER_COMMAND_2/${rvcCommand.instance}`;
          mqttClient.publish(rvcTopic, JSON.stringify(rvcCommand), { retain: true });
          
          logEvent(deviceId, 'dimmer', 'turned_off', JSON.stringify(updatedState));
          
          return { success: true, message: 'Turned off dimmer' };
        }
      }
    }
  },
  vent: {
    commands: {
      setPosition: {
        parameters: {
          position: { type: 'number', min: 0, max: 100, required: true }
        },
        execute: (deviceId, parameters) => {
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'vent' };
          const updatedState = { ...currentState, position: parameters.position };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'vent', 'position_set', updatedState);
          
          return { success: true, message: `Set vent position to ${parameters.position}%` };
        }
      },
      open: {
        parameters: {},
        execute: (deviceId) => {
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'vent' };
          const updatedState = { ...currentState, position: 100, state: 'OPEN' };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'vent', 'opened', updatedState);
          
          return { success: true, message: 'Opened vent' };
        }
      },
      close: {
        parameters: {},
        execute: (deviceId) => {
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'vent' };
          const updatedState = { ...currentState, position: 0, state: 'CLOSED' };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'vent', 'closed', updatedState);
          
          return { success: true, message: 'Closed vent' };
        }
      }
    }
  },
  temperatureSensor: {
    commands: {
      // Temperature sensors typically don't have commands, they only report state
      // But we could add calibration or other configuration commands if needed
      calibrate: {
        parameters: {
          offset: { type: 'number', required: true }
        },
        execute: (deviceId, parameters) => {
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'temperatureSensor' };
          const updatedState = { ...currentState, calibrationOffset: parameters.offset };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'temperatureSensor', 'calibrated', updatedState);
          
          return { success: true, message: `Set calibration offset to ${parameters.offset}` };
        }
      }
    }
  },
  hvac: {
    commands: {
      setMode: {
        parameters: {
          mode: { 
            type: 'string', 
            enum: ['off', 'cool', 'heat', 'auto', 'fan_only'], 
            required: true 
          }
        },
        execute: (deviceId, parameters) => {
          // Based on THERMOSTAT_STATUS_1 in the RV-C API YAML
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'hvac' };
          const updatedState = { ...currentState, mode: parameters.mode };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'hvac', 'mode_set', updatedState);
          
          return { success: true, message: `Set HVAC mode to ${parameters.mode}` };
        }
      },
      setFanMode: {
        parameters: {
          fanMode: { 
            type: 'string', 
            enum: ['auto', 'on'], 
            required: true 
          }
        },
        execute: (deviceId, parameters) => {
          // Based on THERMOSTAT_STATUS_1 in the RV-C API YAML
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'hvac' };
          const updatedState = { ...currentState, fanMode: parameters.fanMode };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'hvac', 'fan_mode_set', updatedState);
          
          return { success: true, message: `Set fan mode to ${parameters.fanMode}` };
        }
      },
      setTemperature: {
        parameters: {
          temperature: { type: 'number', required: true },
          mode: { type: 'string', enum: ['heat', 'cool'], required: true }
        },
        execute: (deviceId, parameters) => {
          // Based on THERMOSTAT_STATUS_1 in the RV-C API YAML
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'hvac' };
          const updatedState = { ...currentState };
          
          if (parameters.mode === 'heat') {
            updatedState.heatSetpoint = parameters.temperature;
          } else if (parameters.mode === 'cool') {
            updatedState.coolSetpoint = parameters.temperature;
          }
          
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'hvac', 'temperature_set', updatedState);
          
          return { success: true, message: `Set ${parameters.mode} temperature to ${parameters.temperature}°C` };
        }
      }
    }
  },
  waterHeater: {
    commands: {
      setMode: {
        parameters: {
          mode: { 
            type: 'string', 
            enum: ['off', 'combustion', 'electric', 'gas_electric', 'automatic'], 
            required: true 
          }
        },
        execute: (deviceId, parameters) => {
          // Based on WATERHEATER_STATUS in the RV-C API YAML
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'waterHeater' };
          const updatedState = { ...currentState, mode: parameters.mode };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'waterHeater', 'mode_set', updatedState);
          
          return { success: true, message: `Set water heater mode to ${parameters.mode}` };
        }
      },
      setTemperature: {
        parameters: {
          temperature: { type: 'number', min: 0, max: 80, required: true }
        },
        execute: (deviceId, parameters) => {
          // Based on WATERHEATER_STATUS in the RV-C API YAML
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'waterHeater' };
          const updatedState = { ...currentState, setPointTemperature: parameters.temperature };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'waterHeater', 'temperature_set', updatedState);
          
          return { success: true, message: `Set water heater temperature to ${parameters.temperature}°C` };
        }
      }
    }
  },
  generator: {
    commands: {
      setCommand: {
        parameters: {
          command: { 
            type: 'string', 
            enum: ['stop', 'start', 'manual_prime', 'manual_preheat'], 
            required: true 
          }
        },
        execute: (deviceId, parameters) => {
          // Based on GENERATOR_COMMAND in the RV-C API YAML
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'generator' };
          const updatedState = { ...currentState, command: parameters.command };
          
          // Update status based on command
          if (parameters.command === 'start') {
            updatedState.status = 'running';
          } else if (parameters.command === 'stop') {
            updatedState.status = 'stopped';
          }
          
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logEvent(deviceId, 'generator', 'command_set', updatedState);
          
          return { success: true, message: `Set generator command to ${parameters.command}` };
        }
      }
    }
  }
};

// Function to log events
function logEvent(deviceId, deviceType, event, status) {
  if (!db) {
    console.error('Database not initialized, cannot log event');
    return;
  }
  
  const stmt = db.prepare(`
    INSERT INTO logs (deviceId, deviceType, event, status, timestamp)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  
  stmt.run(deviceId, deviceType, event, JSON.stringify(status), (err) => {
    if (err) {
      console.error('Error logging device event:', err.message);
    } else {
      console.log(`Logged event for ${deviceId}: ${event}`);
    }
  });
  
  stmt.finalize();
};

// Attach dependencies to app.locals *after* they are initialized
app.locals.db = db;
app.locals.devices = devices;
app.locals.mqttClient = mqttClient;
app.locals.handleCommand = handleCommand;
app.locals.logEvent = logEvent;
app.locals.RVC_COMMAND_TOPIC = RVC_COMMAND_TOPIC;
app.locals.RVC_STATUS_TOPIC = RVC_STATUS_TOPIC;

// Basic authentication middleware (applied globally *before* non-API routes)
app.use((req, res, next) => {
  // Apply basic auth globally EXCEPT for paths starting with /api
  // API routes handle their own auth internally using apiAuth
  if (req.path.startsWith('/api')) {
    return next(); // Skip global auth for API routes
  }
  
  // Apply auth to other routes like /command, /devices, /
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'rvpass';
  const auth = basicAuth({
    users: { [adminUsername]: adminPassword },
    challenge: true,
    realm: 'RV-C Control Application'
  });
  auth(req, res, next);
});

// Import and use route modules *after* initialization and middleware
const apiRoutes = require('./routes/api'); 
const deviceRoutes = require('./routes/devices');

app.use('/api', apiRoutes); // Mount API routes under /api
app.use('/', deviceRoutes);  // Mount device routes under /

// MQTT Connection Events
mqttClient.on('connect', () => {
  console.log(`Connected to MQTT broker at ${MQTT_BROKER}`);
  
  // Subscribe to RV-C topics
  mqttClient.subscribe([
    `${RVC_TOPIC_PREFIX}#`,
    'homeassistant/status'
  ], (err) => {
    if (!err) {
      console.log('Subscribed to RV-C topics');
      // Publish online status
      mqttClient.publish(`${RVC_STATUS_TOPIC}/server`, JSON.stringify({
        state: 'online',
        timestamp: new Date().toISOString()
      }));
    } else {
      console.error('Error subscribing to topics:', err);
    }
  });
});

mqttClient.on('error', (err) => {
  console.error('MQTT connection error:', err);
});

mqttClient.on('reconnect', () => {
  console.log('Attempting to reconnect to MQTT broker...');
});

mqttClient.on('message', (topic, message) => {
  console.log(`Message received on topic ${topic}: ${message.toString()}`);
  
  try {
    // Parse the message
    const payload = JSON.parse(message.toString());
    
    // Handle different topic types
    if (topic.startsWith(RVC_COMMAND_TOPIC)) {
      // Handle commands
      const deviceId = topic.split('/')[1];
      handleCommand(deviceId, payload);
    } else if (topic.startsWith(RVC_STATUS_TOPIC) && topic.endsWith('/state')) {
      // Handle device status updates
      const deviceId = topic.split('/')[1];
      
      // Update device state in memory
      const currentState = devices.get(deviceId) || {};
      const updatedState = { ...currentState, ...payload };
      devices.set(deviceId, updatedState);
      
      // Log the device state update from MQTT
      const deviceType = updatedState.deviceType || 'unknown';
      logEvent(deviceId, deviceType, 'mqtt_state_update', updatedState);
      
      console.log(`Updated state for ${deviceId}:`, updatedState);
    } else if (topic === 'homeassistant/status') {
      // Handle Home Assistant status changes
      if (payload === 'online') {
        console.log('Home Assistant is online, publishing discovery information');
        publishDiscoveryInfo();
      }
    }
  } catch (error) {
    console.error('Error handling MQTT message:', error);
  }
});

// Initialize test devices
function initializeTestDevices() {
  // Add test devices
  devices.set('dimmer1', { deviceId: 'dimmer1', deviceType: 'dimmer', brightness: 75 });
  devices.set('vent1', { deviceId: 'vent1', deviceType: 'vent', position: 75 });
  devices.set('hvac1', { deviceId: 'hvac1', deviceType: 'hvac', mode: 'cool' });
  devices.set('waterHeater1', { deviceId: 'waterHeater1', deviceType: 'waterHeater', mode: 'electric' });
  devices.set('generator1', { deviceId: 'generator1', deviceType: 'generator', command: 'start', status: 'running' });
  
  // Log the initialization
  console.log('Test devices initialized:');
  console.log(Array.from(devices.entries()));
  
  // Publish initial device states to MQTT
  for (const [deviceId, state] of devices.entries()) {
    const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
    mqttClient.publish(topic, JSON.stringify(state), { retain: true });
    
    // Log the device initialization
    logEvent(deviceId, state.deviceType, 'initialized', state);
  }
}

initializeTestDevices();

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('RV-C MQTT Control Application is starting up...');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  
  // Publish offline status
  mqttClient.publish(`${RVC_STATUS_TOPIC}/server`, JSON.stringify({
    state: 'offline',
    timestamp: new Date().toISOString()
  }), { retain: true }, () => {
    // End MQTT connection
    mqttClient.end(true, () => {
      console.log('MQTT connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  
  // Publish offline status
  mqttClient.publish(`${RVC_STATUS_TOPIC}/server`, JSON.stringify({
    state: 'offline',
    timestamp: new Date().toISOString()
  }), { retain: true }, () => {
    // End MQTT connection
    mqttClient.end(true, () => {
      console.log('MQTT connection closed');
      process.exit(0);
    });
  });
});
