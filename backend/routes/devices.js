/**
 * RV-C MQTT Control Application Device Routes
 */
const express = require('express');
const router = express.Router();

// Middleware to attach dependencies from app.locals
router.use((req, res, next) => {
  req.devices = req.app.locals.devices;
  req.mqttClient = req.app.locals.mqttClient;
  req.handleCommand = req.app.locals.handleCommand;
  req.logEvent = req.app.locals.logEvent;
  req.RVC_COMMAND_TOPIC = req.app.locals.RVC_COMMAND_TOPIC;
  req.RVC_STATUS_TOPIC = req.app.locals.RVC_STATUS_TOPIC;
  next();
});

// GET /devices - List all devices and their states
router.get('/devices', (req, res) => {
  const { devices } = req;
  const deviceList = Array.from(devices.values());
  res.json(deviceList);
});

// POST /command - Send a command to a device
router.post('/command', (req, res) => {
  const { devices, mqttClient, handleCommand, logEvent, RVC_COMMAND_TOPIC } = req;
  
  const { deviceId, command, parameters, ...otherParams } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }
  
  if (!command) {
    return res.status(400).json({ error: 'Missing command' });
  }
  
  // Get the device state
  const deviceState = devices.get(deviceId);
  
  if (!deviceState) {
    return res.status(404).json({ error: `Unknown device: ${deviceId}` });
  }

  if (!deviceState.deviceType) {
    console.error(`[ERROR /command] Device ${deviceId} found but has no deviceType in its state!`);
    return res.status(400).json({ error: `Device ${deviceId} has no deviceType defined` });
  }
  
  // Prepare command payload
  const commandParams = parameters || otherParams;
  
  // Create the payload
  const payload = { 
    command, 
    deviceType: deviceState.deviceType,
    ...commandParams 
  };

  // Log the command event
  logEvent(deviceId, deviceState.deviceType, 'command', JSON.stringify(payload));
  
  // Process the command directly using the function from app context
  const result = handleCommand(deviceId, payload);
  
  // Publish command to MQTT after processing (if MQTT client is available)
  if (mqttClient && mqttClient.connected) {
      const topic = `${RVC_COMMAND_TOPIC}/${deviceId}`;
      mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
          console.error('Error publishing command to MQTT:', err);
        }
      });
  } else {
      console.warn('[WARN /command] MQTT client not connected, command not published.');
  }
  
  // Generate a unique command ID for response consistency
  const commandId = `cmd_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  
  // Return the result in the expected format
  if (result && result.success) {
    res.json({ 
      success: true, 
      message: "Command sent successfully", 
      commandId: commandId,
      result: result.message // Contains the message from handleCommand
    });
  } else if (result && result.error) {
    res.status(400).json({ 
      success: false,
      error: result.error, // Contains the error from handleCommand
      commandId: commandId
    });
  } else {
    // Should ideally not happen if handleCommand always returns success/error
    res.status(500).json({ 
      success: false,
      error: 'Unknown error processing command in route handler',
      commandId: commandId
    });
  }
});

// GET /command/:commandId - Check command status (deprecated)
// Keeping it for now but marking as deprecated
router.get('/command/:commandId', (req, res) => {
  res.status(410).json({ 
    success: false, 
    error: 'This endpoint is deprecated. Commands are processed immediately.' 
  });
});

// GET / - Root path for this router (optional, could be removed if not needed)
// Note: This will be mounted at the root ('/') in server.js
router.get('/', (req, res) => {
  res.send('RV-C MQTT Control Application Device API is running');
});

module.exports = router;
