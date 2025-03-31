/**
 * RV-C MQTT Control Application with Home Assistant Integration
 * Main server file
 */

require('dotenv').config();
const express = require('express');
const mqtt = require('mqtt');
const basicAuth = require('express-basic-auth');
const sqlite3 = require('sqlite3').verbose();
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

// Function to handle RV-C commands
function handleCommand(topic, message) {
  try {
    const command = JSON.parse(message.toString());
    console.log('Processing command:', command);
    
    // Store the command in the device map
    if (command.deviceId) {
      if (!devices.has(command.deviceId)) {
        devices.set(command.deviceId, {
          id: command.deviceId,
          name: command.deviceName || `Device ${command.deviceId}`,
          type: command.deviceType || 'unknown',
          lastSeen: new Date().toISOString(),
          state: {}
        });
      }
      
      // Update device state
      const device = devices.get(command.deviceId);
      device.lastSeen = new Date().toISOString();
      
      // Update the state based on the command and parameters
      if (command.command && command.parameters) {
        device.state[command.command] = command.parameters;
      }
      
      // Publish updated device state
      mqttClient.publish(`${RVC_STATUS_TOPIC}/${command.deviceId}`, JSON.stringify(device));
      
      // TODO: Execute the actual command on the RV-C device
      // This will be implemented in Task 1.4
    }
  } catch (error) {
    console.error('Error handling command:', error);
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

// Device storage
const devices = new Map();

// SQLite Database setup - will be configured in Task 1.5
// const db = new sqlite3.Database(':memory:');

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
    const { deviceId, command, parameters } = req.body;
    
    if (!deviceId || !command) {
      return res.status(400).json({ error: 'Missing required fields: deviceId and command' });
    }
    
    // Publish command to MQTT
    const commandTopic = `${RVC_COMMAND_TOPIC}/${deviceId}`;
    const payload = {
      deviceId,
      command,
      parameters: parameters || {},
      timestamp: new Date().toISOString()
    };
    
    mqttClient.publish(commandTopic, JSON.stringify(payload));
    
    res.status(202).json({ 
      message: 'Command sent successfully',
      commandId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
    });
  } catch (error) {
    console.error('Error sending command:', error);
    res.status(500).json({ error: 'Failed to send command' });
  }
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
