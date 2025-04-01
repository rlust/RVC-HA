/**
 * RV-C MQTT Control Application Logs API
 * Provides HTTP endpoints for accessing event logs and exports
 */
const express = require('express');
const router = express.Router();
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const { Parser } = require('json2csv');

// Basic Auth configuration for logs API
const apiUsers = {
    [process.env.ADMIN_USERNAME || 'admin']: process.env.ADMIN_PASSWORD || 'rvpass'
};
const apiAuth = basicAuth({ users: apiUsers, challenge: true, realm: 'Logs API' });

// Get database connection from app.locals
router.use((req, res, next) => {
  req.db = req.app.locals.db;
  next();
});

// Log debug information on all requests
router.use((req, res, next) => {
  console.log(`[Logs API] ${req.method} ${req.originalUrl}`);
  next();
});

/**
 * GET /api/logs
 * Retrieve logs with optional filters
 */
router.get('/logs', apiAuth, (req, res) => {
  const { db } = req;
  const { 
    deviceId, 
    deviceType, 
    event, 
    startDate, 
    endDate, 
    limit = 100, 
    offset = 0 
  } = req.query;
  
  // Build query with filters
  let query = 'SELECT * FROM logs WHERE 1=1';
  const params = [];
  
  if (deviceId) {
    query += ' AND deviceId = ?';
    params.push(deviceId);
  }
  
  if (deviceType) {
    query += ' AND deviceType = ?';
    params.push(deviceType);
  }
  
  if (event) {
    query += ' AND event = ?';
    params.push(event);
  }
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  // Add order and limits
  query += ' ORDER BY timestamp DESC';
  
  if (limit) {
    query += ' LIMIT ?';
    params.push(parseInt(limit, 10));
  }
  
  if (offset) {
    query += ' OFFSET ?';
    params.push(parseInt(offset, 10));
  }
  
  // Execute query
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error retrieving logs:', err);
      return res.status(500).json({ error: 'Error retrieving logs', details: err.message });
    }
    
    res.json(rows);
  });
});

/**
 * GET /api/export/logs.csv
 * Export logs as CSV
 */
router.get('/export/logs.csv', apiAuth, (req, res) => {
  const { db } = req;
  const { 
    deviceId, 
    deviceType, 
    event, 
    startDate, 
    endDate 
  } = req.query;
  
  // Build query with filters
  let query = 'SELECT * FROM logs WHERE 1=1';
  const params = [];
  
  if (deviceId) {
    query += ' AND deviceId = ?';
    params.push(deviceId);
  }
  
  if (deviceType) {
    query += ' AND deviceType = ?';
    params.push(deviceType);
  }
  
  if (event) {
    query += ' AND event = ?';
    params.push(event);
  }
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  // Order by timestamp
  query += ' ORDER BY timestamp DESC';
  
  // Execute query
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error retrieving logs for export:', err);
      return res.status(500).json({ error: 'Error retrieving logs', details: err.message });
    }
    
    // Transform data for CSV export
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(rows);
    
    // Set headers for file download
    res.header('Content-Type', 'text/csv');
    res.attachment('logs.csv');
    res.send(csv);
  });
});

/**
 * DELETE /api/logs
 * Clear logs with optional filters
 */
router.delete('/logs', apiAuth, (req, res) => {
  const { db } = req;
  const { 
    deviceId, 
    deviceType, 
    event, 
    startDate, 
    endDate 
  } = req.body;
  
  // Build query with filters
  let query = 'DELETE FROM logs WHERE 1=1';
  const params = [];
  
  if (deviceId) {
    query += ' AND deviceId = ?';
    params.push(deviceId);
  }
  
  if (deviceType) {
    query += ' AND deviceType = ?';
    params.push(deviceType);
  }
  
  if (event) {
    query += ' AND event = ?';
    params.push(event);
  }
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  // Execute query
  db.run(query, params, function(err) {
    if (err) {
      console.error('Error clearing logs:', err);
      return res.status(500).json({ error: 'Error clearing logs', details: err.message });
    }
    
    res.json({ 
      success: true, 
      message: `${this.changes} logs deleted`, 
      count: this.changes 
    });
  });
});

module.exports = router;
