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
// SQLite3 is used for logging functionality
const sqlite3 = require('sqlite3').verbose();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[DEBUG] Request received: ${req.method} ${req.path}`);
  next();
});

// Basic authentication
app.use((req, res, next) => {
  // Skip authentication for routes with their own auth
  if (req.path === '/logs' || req.path === '/api/logs') {
    return next();
  }
  
  // Apply basic auth to all other routes
  basicAuth({
    users: { 
      [process.env.ADMIN_USERNAME || 'admin']: process.env.ADMIN_PASSWORD || 'rvpass' 
    },
    challenge: true,
    realm: 'RV-C Control Application'
  })(req, res, next);
});

// Initialize SQLite database for logging
const dbPath = process.env.DB_PATH || path.join(__dirname, 'logs.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
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

// MQTT Client setup
const mqttOptions = {
  clientId: `rv-c-mqtt-control-${Math.random().toString(16).slice(2, 8)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
};

const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mosquitto:1883';
const mqttClient = mqtt.connect(mqttBrokerUrl, mqttOptions);

// MQTT Topics
const RVC_TOPIC_PREFIX = 'RVC/';
const RVC_COMMAND_TOPIC = `${RVC_TOPIC_PREFIX}command`;
const RVC_STATUS_TOPIC = `${RVC_TOPIC_PREFIX}status`;
const RVC_DISCOVERY_TOPIC = `${RVC_TOPIC_PREFIX}discovery`;

// MQTT Connection Events
mqttClient.on('connect', () => {
  console.log(`Connected to MQTT broker at ${mqttBrokerUrl}`);
  
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
      logDeviceEvent(deviceId, deviceType, 'mqtt_state_update', updatedState);
      
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

// Device storage
const devices = new Map();

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
    logDeviceEvent(deviceId, state.deviceType, 'initialized', state);
  }
}

// Logging function to record device events
const logDeviceEvent = (deviceId, deviceType, event, status) => {
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
          
          logDeviceEvent(deviceId, 'dimmer', 'brightness_set', updatedState);
          
          return { success: true, message: `Set brightness to ${parameters.brightness}%` };
        }
      },
      turnOn: {
        parameters: {},
        execute: (deviceId) => {
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'dimmer' };
          const updatedState = { ...currentState, brightness: 100, state: 'ON' };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logDeviceEvent(deviceId, 'dimmer', 'turned_on', updatedState);
          
          return { success: true, message: 'Turned on dimmer' };
        }
      },
      turnOff: {
        parameters: {},
        execute: (deviceId) => {
          const currentState = devices.get(deviceId) || { deviceId, deviceType: 'dimmer' };
          const updatedState = { ...currentState, brightness: 0, state: 'OFF' };
          devices.set(deviceId, updatedState);
          
          // Publish the updated state to MQTT
          const topic = `${RVC_STATUS_TOPIC}/${deviceId}/state`;
          mqttClient.publish(topic, JSON.stringify(updatedState), { retain: true });
          
          logDeviceEvent(deviceId, 'dimmer', 'turned_off', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'vent', 'position_set', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'vent', 'opened', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'vent', 'closed', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'temperatureSensor', 'calibrated', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'hvac', 'mode_set', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'hvac', 'fan_mode_set', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'hvac', 'temperature_set', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'waterHeater', 'mode_set', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'waterHeater', 'temperature_set', updatedState);
          
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
          
          logDeviceEvent(deviceId, 'generator', 'command_set', updatedState);
          
          return { success: true, message: `Set generator command to ${parameters.command}` };
        }
      }
    }
  }
};

// Function to handle device commands
function handleCommand(deviceId, payload) {
  try {
    console.log(`Processing command for device ${deviceId}:`, payload);
    
    // Extract command and parameters
    const { command, ...parameters } = payload;
    
    if (!command) {
      console.error('No command specified in payload');
      return { success: false, error: 'No command specified' };
    }
    
    // Get the device state
    const deviceState = devices.get(deviceId) || {};
    const deviceType = deviceState.deviceType;
    
    if (!deviceType) {
      console.error(`Unknown device type for ${deviceId}`);
      return { success: false, error: 'Unknown device type' };
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

// Routes
app.get('/', (req, res) => {
  res.send('RV-C MQTT Control Application API is running');
});

// GET /devices - List all devices and their states
app.get('/devices', (req, res) => {
  const deviceList = Array.from(devices.values());
  res.json(deviceList);
});

// POST /command - Send a command to a device
app.post('/command', (req, res) => {
  const { deviceId, command, parameters, ...otherParams } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }
  
  if (!command) {
    return res.status(400).json({ error: 'Missing command' });
  }
  
  // Get the device state
  const deviceState = devices.get(deviceId);
  
  if (!deviceState || !deviceState.deviceType) {
    return res.status(404).json({ error: `Unknown device: ${deviceId}` });
  }
  
  // Prepare command payload
  // If parameters object is provided, use it, otherwise use other params directly
  const commandParams = parameters || otherParams;
  
  // Publish command to MQTT
  const topic = `${RVC_COMMAND_TOPIC}/${deviceId}`;
  const payload = { command, ...commandParams };
  
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error('Error publishing command:', err);
      return res.status(500).json({ error: 'Failed to publish command' });
    }
    
    // Process the command directly
    const result = handleCommand(deviceId, payload);
    
    // Return the result
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
  });
});

// GET /command/:commandId - Check command status
app.get('/command/:commandId', (req, res) => {
  // This endpoint is deprecated in the new implementation
  res.status(410).json({ 
    success: false, 
    error: 'This endpoint is deprecated. Commands are now processed immediately.' 
  });
});

// GET /api/logs - Get logs as JSON
app.get('/api/logs', (req, res) => {
  // Check for basic auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="RV-C MQTT Control Application"');
    return res.status(401).send('Authentication required');
  }
  
  // Decode and verify credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  const validUsername = process.env.ADMIN_USERNAME || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'rvpass';
  
  if (username !== validUsername || password !== validPassword) {
    res.set('WWW-Authenticate', 'Basic realm="RV-C MQTT Control Application"');
    return res.status(401).send('Invalid credentials');
  }
  
  // Get query parameters for filtering
  const { deviceId, deviceType, days = 7, limit = 100 } = req.query;
  
  // Calculate the date for filtering
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - parseInt(days, 10));
  const formattedDate = daysAgo.toISOString().split('T')[0];
  
  // Build the query with optional filters
  let query = `
    SELECT id, deviceId, deviceType, event, status, timestamp
    FROM logs
    WHERE timestamp >= datetime('${formattedDate}')
  `;
  
  const queryParams = [];
  
  // Add filters if provided
  if (deviceId) {
    query += ' AND deviceId = ?';
    queryParams.push(deviceId);
  }
  
  if (deviceType) {
    query += ' AND deviceType = ?';
    queryParams.push(deviceType);
  }
  
  // Add ordering and limit
  query += ' ORDER BY timestamp DESC LIMIT ?';
  queryParams.push(parseInt(limit, 10));
  
  // Execute the query
  db.all(query, queryParams, (err, rows) => {
    if (err) {
      console.error('Error retrieving logs:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve logs' });
    }
    
    // Process the logs to parse JSON status
    const logs = rows.map(row => {
      try {
        if (typeof row.status === 'string') {
          row.status = JSON.parse(row.status);
        }
      } catch (e) {
        // If parsing fails, keep the original string
        console.error('Error parsing status JSON:', e.message);
      }
      
      return row;
    });
    
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  });
});

// GET /logs - Export logs as CSV
app.get('/logs', (req, res) => {
  // Check for basic auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="RV-C MQTT Control Application"');
    return res.status(401).send('Authentication required');
  }
  
  // Decode and verify credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  const validUsername = process.env.ADMIN_USERNAME || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'rvpass';
  
  if (username !== validUsername || password !== validPassword) {
    res.set('WWW-Authenticate', 'Basic realm="RV-C MQTT Control Application"');
    return res.status(401).send('Invalid credentials');
  }
  
  // Get the date 7 days ago (as per PRD requirements)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const formattedDate = sevenDaysAgo.toISOString().split('T')[0];
  
  // Build the query to get logs from the last 7 days
  const query = `
    SELECT id, deviceId, deviceType, event, status, timestamp
    FROM logs
    WHERE timestamp >= datetime('${formattedDate}')
    ORDER BY timestamp DESC
  `;
  
  // Execute the query
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error retrieving logs for CSV export:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve logs for export' });
    }
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rv-c-logs.csv"');
    
    // Write CSV header
    res.write('ID,DeviceID,DeviceType,Event,Status,Timestamp\n');
    
    // Write each row as CSV
    rows.forEach(row => {
      // Format the status as a string, escaping any quotes
      let statusStr = '';
      try {
        // If status is a JSON string, parse it and then stringify it to ensure proper formatting
        if (typeof row.status === 'string') {
          statusStr = JSON.stringify(JSON.parse(row.status)).replace(/"/g, '""');
        } else {
          statusStr = JSON.stringify(row.status).replace(/"/g, '""');
        }
      } catch (e) {
        // If parsing fails, use the original string
        statusStr = row.status.replace(/"/g, '""');
      }
      
      // Write the CSV row
      res.write(`${row.id},"${row.deviceId}","${row.deviceType}","${row.event}","${statusStr}","${row.timestamp}"\n`);
    });
    
    // End the response
    res.end();
  });
});

// Initialize test devices when the server starts
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
