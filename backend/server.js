/**
 * RV-C MQTT Control Application with Home Assistant Integration
 * Main server file
 */

require('dotenv').config();
const express = require('express');
const mqtt = require('mqtt');
const basicAuth = require('express-basic-auth');
// SQLite3 will be implemented in a future task
// const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic authentication
app.use(basicAuth({
  users: { 
    [process.env.ADMIN_USERNAME || 'admin']: process.env.ADMIN_PASSWORD || 'rvpass' 
  },
  challenge: true,
  realm: 'RV-C Control Application'
}));

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
  try {
    console.log(`Received message on topic ${topic}: ${message.toString()}`);
    
    // Handle different topic messages
    if (topic.startsWith(RVC_COMMAND_TOPIC)) {
      handleCommand(topic, message);
    } else if (topic === 'homeassistant/status') {
      if (message.toString() === 'online') {
        // Home Assistant came online, republish discovery information
        publishDiscoveryInformation();
      }
    }
  } catch (error) {
    console.error('Error processing MQTT message:', error);
  }
});

// Device storage
const devices = new Map();

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
          
          return { success: true, message: `Set generator command to ${parameters.command}` };
        }
      }
    }
  }
};

// Command parser function
function parseCommand(commandData) {
  // Validate required fields
  if (!commandData.deviceId) {
    return { success: false, error: 'Missing deviceId' };
  }
  
  if (!commandData.deviceType) {
    return { success: false, error: 'Missing deviceType' };
  }
  
  if (!commandData.command) {
    return { success: false, error: 'Missing command' };
  }
  
  // Check if device type is supported
  if (!deviceTypes[commandData.deviceType]) {
    return { success: false, error: `Unsupported device type: ${commandData.deviceType}` };
  }
  
  // Check if command is supported for this device type
  const deviceType = deviceTypes[commandData.deviceType];
  if (!deviceType.commands[commandData.command]) {
    return { success: false, error: `Unsupported command for device type ${commandData.deviceType}: ${commandData.command}` };
  }
  
  // Validate command parameters
  const command = deviceType.commands[commandData.command];
  const parameters = commandData.parameters || {};
  
  for (const [paramName, paramConfig] of Object.entries(command.parameters)) {
    // Check required parameters
    if (paramConfig.required && parameters[paramName] === undefined) {
      return { success: false, error: `Missing required parameter: ${paramName}` };
    }
    
    // Skip validation for optional parameters that aren't provided
    if (parameters[paramName] === undefined) {
      continue;
    }
    
    // Validate parameter type
    if (paramConfig.type === 'number' && typeof parameters[paramName] !== 'number') {
      return { success: false, error: `Parameter ${paramName} must be a number` };
    }
    
    if (paramConfig.type === 'string' && typeof parameters[paramName] !== 'string') {
      return { success: false, error: `Parameter ${paramName} must be a string` };
    }
    
    // Validate parameter range for numbers
    if (paramConfig.type === 'number') {
      if (paramConfig.min !== undefined && parameters[paramName] < paramConfig.min) {
        return { success: false, error: `Parameter ${paramName} must be at least ${paramConfig.min}` };
      }
      
      if (paramConfig.max !== undefined && parameters[paramName] > paramConfig.max) {
        return { success: false, error: `Parameter ${paramName} must be at most ${paramConfig.max}` };
      }
    }
    
    // Validate enum values for strings
    if (paramConfig.type === 'string' && paramConfig.enum) {
      if (!paramConfig.enum.includes(parameters[paramName])) {
        return { success: false, error: `Parameter ${paramName} must be one of: ${paramConfig.enum.join(', ')}` };
      }
    }
  }
  
  return { success: true, command };
}

// Execute command function
function executeCommand(commandData) {
  const parseResult = parseCommand(commandData);
  
  if (!parseResult.success) {
    return parseResult;
  }
  
  try {
    // Execute the command
    const result = parseResult.command.execute(commandData.deviceId, commandData.parameters || {});
    
    // Generate a command ID for tracking
    const commandId = Date.now().toString();
    
    // Store command result (in a real implementation, this would be in a database)
    const commandResults = {
      ...result,
      commandId,
      deviceId: commandData.deviceId,
      deviceType: commandData.deviceType,
      command: commandData.command,
      parameters: commandData.parameters || {},
      timestamp: new Date().toISOString()
    };
    
    return { success: true, commandId, ...result };
  } catch (error) {
    console.error('Error executing command:', error);
    return { success: false, error: 'Command execution failed' };
  }
}

// Function to handle RV-C commands
function handleCommand(topic, message) {
  try {
    const commandData = JSON.parse(message.toString());
    console.log('Processing command:', commandData);
    
    // Parse and validate the command
    const parseResult = parseCommand(commandData);
    
    if (!parseResult.success) {
      return parseResult;
    }
    
    // Execute the command
    const result = executeCommand(commandData);
    
    // Publish command response
    mqttClient.publish(`${RVC_STATUS_TOPIC}/${parseResult.command.deviceId}/response`, JSON.stringify({
      success: result.success,
      commandId: result.commandId,
      result: result,
      timestamp: new Date().toISOString()
    }));
    
    return result;
  } catch (error) {
    console.error('Error handling command:', error);
    
    // Publish error response if deviceId is available
    if (message && typeof message.toString === 'function') {
      try {
        const commandData = JSON.parse(message.toString());
        if (commandData.deviceId) {
          mqttClient.publish(`${RVC_STATUS_TOPIC}/${commandData.deviceId}/response`, JSON.stringify({
            success: false,
            commandId: commandData.commandId || Date.now().toString(),
            error: error.message,
            timestamp: new Date().toISOString()
          }));
        }
      } catch (parseError) {
        console.error('Error parsing command message for error response:', parseError);
      }
    }
    
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Function to publish discovery information for Home Assistant
function publishDiscoveryInformation() {
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

// POST /command - Send commands to RV-C devices
app.post('/command', (req, res) => {
  try {
    const { deviceId, deviceType, command, parameters } = req.body;
    
    if (!deviceId || !command) {
      return res.status(400).json({ error: 'Missing required fields: deviceId and command' });
    }
    
    // Create command data
    const commandData = {
      deviceId,
      deviceType,
      command,
      parameters: parameters || {},
      commandId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString()
    };
    
    try {
      // Parse and validate the command locally before publishing
      const parseResult = parseCommand(commandData);
      
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error });
      }
      
      // Publish command to MQTT
      const commandTopic = `${RVC_COMMAND_TOPIC}/${deviceId}`;
      mqttClient.publish(commandTopic, JSON.stringify(commandData));
      
      res.status(202).json({ 
        message: 'Command sent successfully',
        commandId: commandData.commandId
      });
    } catch (validationError) {
      res.status(400).json({ 
        error: validationError.message,
        commandId: commandData.commandId
      });
    }
  } catch (error) {
    console.error('Error sending command:', error);
    res.status(500).json({ error: 'Failed to send command' });
  }
});

// GET /command/:commandId - Check command status
app.get('/command/:commandId', (req, res) => {
  // In a real implementation, we would check a command status database
  // For now, we'll return a simulated response
  const { commandId } = req.params;
  
  if (!commandId) {
    return res.status(400).json({ error: 'Missing commandId parameter' });
  }
  
  // Simulate a random command status (success/failure)
  const success = Math.random() > 0.1; // 90% success rate
  
  res.json({
    commandId,
    status: success ? 'completed' : 'failed',
    timestamp: new Date().toISOString(),
    message: success ? 'Command executed successfully' : 'Command execution failed'
  });
});

// GET /logs - Export logs as CSV
app.get('/logs', (req, res) => {
  // Will be implemented in Task 1.5
  res.status(501).json({ message: 'Not implemented yet' });
});

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
