/**
 * RV-C MQTT Control Application Device API
 * Provides HTTP endpoints for device interaction and MQTT integration
 */
const express = require('express');
const router = express.Router();
const basicAuth = require('express-basic-auth');

// Command status tracking
const commandHistory = new Map();

// Basic Auth configuration for device API
const apiUsers = {
    [process.env.ADMIN_USERNAME || 'admin']: process.env.ADMIN_PASSWORD || 'rvpass'
};
const apiAuth = basicAuth({ users: apiUsers, challenge: true, realm: 'Device API' });

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

/**
 * GET /api/devices
 * List all devices and their states
 */
router.get('/devices', apiAuth, (req, res) => {
  const { devices } = req;
  const deviceList = Array.from(devices.values());
  res.json(deviceList);
});

/**
 * GET /api/devices/:deviceId
 * Get status of a specific device
 */
router.get('/devices/:deviceId', apiAuth, (req, res) => {
  const { devices } = req;
  const { deviceId } = req.params;
  
  const deviceState = devices.get(deviceId);
  
  if (!deviceState) {
    return res.status(404).json({ error: `Device not found: ${deviceId}` });
  }
  
  res.json(deviceState);
});

/**
 * POST /api/devices/:deviceId/command
 * Send a command to a specific device with validations
 */
router.post('/devices/:deviceId/command', apiAuth, (req, res) => {
  const { devices, mqttClient, handleCommand, logEvent, RVC_COMMAND_TOPIC } = req;
  const { deviceId } = req.params;
  const payload = req.body;
  
  if (!payload || !payload.command) {
    return res.status(400).json({ error: 'Missing command in payload' });
  }
  
  // Get the device state
  const deviceState = devices.get(deviceId);
  
  if (!deviceState) {
    return res.status(404).json({ error: `Unknown device: ${deviceId}` });
  }

  if (!deviceState.deviceType) {
    console.error(`[ERROR /api/devices/${deviceId}/command] Device found but has no deviceType in its state!`);
    return res.status(400).json({ error: `Device ${deviceId} has no deviceType defined` });
  }
  
  // Log the command event
  logEvent(deviceId, deviceState.deviceType, 'command_received', JSON.stringify(payload));
  
  // Process the command
  const result = handleCommand(deviceId, payload);
  
  // Generate a unique command ID
  const commandId = `cmd_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  
  // Store command history for status tracking
  commandHistory.set(commandId, {
    deviceId,
    command: payload.command,
    parameters: payload,
    status: result.success ? 'success' : 'error',
    result,
    timestamp: new Date()
  });
  
  // Clean up old command history (keep last 100 commands)
  if (commandHistory.size > 100) {
    const oldestKeys = Array.from(commandHistory.keys()).slice(0, commandHistory.size - 100);
    oldestKeys.forEach(key => commandHistory.delete(key));
  }
  
  // Publish the command to MQTT
  if (mqttClient && mqttClient.connected) {
    const topic = `${RVC_COMMAND_TOPIC}/${deviceId}`;
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error('Error publishing command to MQTT:', err);
      }
    });
  } else {
    console.warn(`[WARN /api/devices/${deviceId}/command] MQTT client not connected, command not published.`);
  }
  
  // Return the result
  if (result.success) {
    res.json({ 
      commandId,
      deviceId,
      status: 'success',
      message: result.message || 'Command processed successfully' 
    });
  } else {
    const statusCode = result.error?.includes('parameter') ? 400 : 500;
    res.status(statusCode).json({ 
      commandId,
      deviceId,
      status: 'error', 
      error: result.error || 'Failed to process command' 
    });
  }
});

/**
 * GET /api/commands/:commandId
 * Check status of a previously sent command
 */
router.get('/commands/:commandId', apiAuth, (req, res) => {
  const { commandId } = req.params;
  
  const commandData = commandHistory.get(commandId);
  
  if (!commandData) {
    return res.status(404).json({ error: `Command not found: ${commandId}` });
  }
  
  res.json({
    commandId,
    deviceId: commandData.deviceId,
    command: commandData.command,
    status: commandData.status,
    timestamp: commandData.timestamp,
    result: commandData.result
  });
});

/**
 * POST /api/command
 * Legacy endpoint for command sending (maintains backward compatibility)
 */
router.post('/command', apiAuth, (req, res) => {
  const { deviceId, payload } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }
  
  if (!payload || !payload.command) {
    return res.status(400).json({ error: 'Missing command in payload' });
  }
  
  // Forward to the new endpoint by creating a new request
  req.params = { deviceId };
  req.body = payload;
  
  // Call the handler directly
  router.handle(req, res, () => {
    // This is the next function, which we don't need in this case
  });
});

module.exports = router;
