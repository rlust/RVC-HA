/**
 * RV-C MQTT Control Application - Setup Test
 * 
 * This script tests that the development environment is properly set up
 * by verifying that all required dependencies can be loaded and basic
 * functionality works.
 */

console.log('Starting setup test...');

// Test that required packages can be loaded
try {
  console.log('Testing express package...');
  const express = require('express');
  console.log('✅ Express loaded successfully');
  
  console.log('Testing mqtt package...');
  const mqtt = require('mqtt');
  console.log('✅ MQTT loaded successfully');
  
  console.log('Testing express-basic-auth package...');
  const basicAuth = require('express-basic-auth');
  console.log('✅ Express Basic Auth loaded successfully');
  
  console.log('Testing sqlite3 package...');
  const sqlite3 = require('sqlite3').verbose();
  console.log('✅ SQLite3 loaded successfully');
  
  console.log('Testing dotenv package...');
  const dotenv = require('dotenv');
  console.log('✅ Dotenv loaded successfully');
  
  // Test basic Express functionality
  console.log('Testing basic Express functionality...');
  const app = express();
  if (typeof app.get === 'function' && typeof app.post === 'function') {
    console.log('✅ Express app created successfully');
  } else {
    throw new Error('Express app does not have expected methods');
  }
  
  // Test basic SQLite functionality
  console.log('Testing basic SQLite functionality...');
  const db = new sqlite3.Database(':memory:');
  db.serialize(() => {
    db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.run('INSERT INTO test (name) VALUES (?)', ['Test Entry']);
    db.get('SELECT * FROM test', (err, row) => {
      if (err) {
        throw err;
      }
      if (row && row.name === 'Test Entry') {
        console.log('✅ SQLite in-memory database working correctly');
      } else {
        throw new Error('SQLite test failed');
      }
      db.close();
    });
  });
  
  console.log('\n🎉 All packages loaded successfully! Development environment is set up correctly.');
  console.log('Task 1.1 (Set Up Development Environment) is complete.');
  
} catch (error) {
  console.error('\n❌ Error during setup test:', error.message);
  console.error('Please check your installation and try again.');
  process.exit(1);
}
