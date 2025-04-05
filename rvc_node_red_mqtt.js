/**
 * RVC Node-RED MQTT Command Sender
 * 
 * This script sends commands to Node-RED via a dedicated MQTT topic
 */

const mqtt = require('mqtt');

// Configuration - adjust these values as needed
const config = {
  broker: 'mqtt://100.110.189.122:1883',
  noderedTopic: 'node-red/rvc/commands',
  clientId: 'rvc-node-red-client-' + Math.random().toString(16).substring(2, 8),
  username: 'rc',
  password: 'rc'
};

// Connect to MQTT broker
const client = mqtt.connect(config.broker, {
  clientId: config.clientId,
  username: config.username,
  password: config.password
});

// Set up connection event handlers
client.on('connect', () => {
  console.log('Connected to MQTT broker');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node rvc_node_red_mqtt.js INSTANCE COMMAND [BRIGHTNESS]');
    console.log('  INSTANCE: Light instance number (e.g., 46)');
    console.log('  COMMAND: on, off, or dim');
    console.log('  BRIGHTNESS: Brightness level (0-100), required for "on" and "dim"');
    client.end();
    return;
  }
  
  const instance = args[0];
  const command = args[1].toLowerCase();
  const brightness = args[2] ? parseInt(args[2], 10) : (command === 'on' ? 100 : 0);
  
  // Send the command to Node-RED
  sendCommandToNodeRed(instance, command, brightness);
});

client.on('error', (error) => {
  console.error('MQTT Error:', error);
  client.end();
});

/**
 * Send command to Node-RED via MQTT
 * @param {string} instance - The RVC light instance number
 * @param {string} command - Command: 'on', 'off', 'dim'
 * @param {number} brightness - Brightness level (0-100)
 */
function sendCommandToNodeRed(instance, command, brightness = 0) {
  // Map string commands to numeric command codes
  const commandCodes = {
    'on': 2,
    'off': 3,
    'dim': 19
  };
  
  // Get the command code or use the command directly if it's already a number
  const cmdCode = isNaN(command) ? (commandCodes[command] || 2) : command;
  
  // Format the payload as simple space-separated values: "instance command brightness"
  const payload = `${instance} ${cmdCode} ${brightness}`;
  
  // Publish to the Node-RED topic
  client.publish(config.noderedTopic, payload, {}, (error) => {
    if (error) {
      console.error('Error publishing message:', error);
    } else {
      console.log(`Command sent successfully to ${config.noderedTopic}`);
      console.log(`Payload: ${JSON.stringify(payload)}`);
    }
    
    // Close the connection after sending the command
    setTimeout(() => {
      client.end();
      console.log('MQTT connection closed');
    }, 1000);
  });
}
