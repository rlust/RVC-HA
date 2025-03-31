/**
 * RV-C MQTT Control Application API Routes (Logging)
 */
const express = require('express');
const router = express.Router();
const basicAuth = require('express-basic-auth');
const Papa = require('papaparse');

// Basic Auth configuration specific to these routes
const apiUsers = {
    [process.env.ADMIN_USERNAME || 'admin']: process.env.ADMIN_PASSWORD || 'rvpass'
};
const apiAuth = basicAuth({ users: apiUsers, challenge: true, realm: 'API Logs' });

// Middleware to attach dependencies from app.locals
router.use((req, res, next) => {
  req.db = req.app.locals.db;
  req.logEvent = req.app.locals.logEvent;
  next();
});

// GET /api/logs - Get logs as JSON
router.get('/logs', apiAuth, (req, res) => {
  const { db } = req; // Get db from request object
  const { limit = 100, offset = 0, deviceId, deviceType, eventType } = req.query;
  
  let query = 'SELECT * FROM logs';
  const params = [];
  const conditions = [];

  if (deviceId) {
    conditions.push('device_id = ?');
    params.push(deviceId);
  }
  if (deviceType) {
    conditions.push('device_type = ?');
    params.push(deviceType);
  }
  if (eventType) {
    conditions.push('event_type = ?');
    params.push(eventType);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10) || 100);
  params.push(parseInt(offset, 10) || 0);

  console.log('[DEBUG /api/logs] Query:', query, params);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching logs:', err.message);
      // Log this error event itself
      if (req.logEvent) req.logEvent('api_server', 'system', 'log_fetch_error', `Error: ${err.message}`);
      return res.status(500).json({ error: 'Failed to fetch logs' });
    }
    res.json(rows);
  });
});

// GET /logs - Export logs as CSV
router.get('/export/logs.csv', apiAuth, (req, res) => {
  const { db } = req;
  // Fetch all logs for CSV export (consider performance for very large logs)
  const query = 'SELECT * FROM logs ORDER BY timestamp DESC';
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching logs for CSV export:', err.message);
       if (req.logEvent) req.logEvent('api_server', 'system', 'log_export_error', `Error: ${err.message}`);
      return res.status(500).send('Error fetching logs for export');
    }

    if (!rows || rows.length === 0) {
      return res.status(404).send('No logs found to export');
    }
    
    try {
      // Convert JSON to CSV using papaparse
      const csv = Papa.unparse(rows);
      
      // Set headers for CSV download
      res.header('Content-Type', 'text/csv');
      res.attachment('logs.csv');
      res.send(csv);
      if (req.logEvent) req.logEvent('api_server', 'system', 'log_export_success', `Exported ${rows.length} log entries`);

    } catch (parseError) {
        console.error('Error converting logs to CSV:', parseError.message);
        if (req.logEvent) req.logEvent('api_server', 'system', 'log_export_parse_error', `Error: ${parseError.message}`);
        res.status(500).send('Error converting logs to CSV');
    }
  });
});

module.exports = router;
