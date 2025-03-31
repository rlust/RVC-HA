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
  
  // Correctly extract deviceId and the nested payload object from the request body
  const { deviceId, payload } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }
  
  // Check for payload and command *inside* the payload object
  if (!payload || !payload.command) {
    return res.status(400).json({ error: 'Missing command in payload' });
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
  
  // Log the command event using the received payload
  // Note: handleCommand expects deviceType *not* to be in the payload it receives
  // Ensure the payload passed to handleCommand doesn't include it if handleCommand adds it.
  // Let's assume handleCommand manages deviceType based on deviceId lookup.
  logEvent(deviceId, deviceState.deviceType, 'command_received', JSON.stringify(payload));
  
  // Process the command using the correctly extracted payload object
  // handleCommand expects a flat structure like { command: "...", param1: ... }
  const result = handleCommand(deviceId, payload);
  
  // Publish the *original* received payload to MQTT 
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
  if (result.success) {
    res.json({ 
        commandId: commandId,
        deviceId: deviceId,
        status: 'success',
        message: result.message || 'Command processed successfully' 
    });
  } else {
    // Use status code 400 for command processing errors (like invalid params)
    // Use status code 500 for unexpected internal server errors
    const statusCode = result.error?.includes('parameter') ? 400 : 500;
    res.status(statusCode).json({ 
        commandId: commandId,
        deviceId: deviceId,
        status: 'error', 
        error: result.error || 'Failed to process command' 
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
