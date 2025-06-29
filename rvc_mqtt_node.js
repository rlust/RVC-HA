/**
 * RVC MQTT Command Sender
 * 
 * This script sends commands to RVC lights via MQTT
 */

const mqtt = require('mqtt');

// Configuration - adjust these values as needed
const config = {
  broker: 'mqtt://100.110.189.122:1883',
  clientId: 'rvc-mqtt-client-' + Math.random().toString(16).substring(2, 8),
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
    console.log('Usage: node rvc_mqtt_node.js INSTANCE COMMAND [BRIGHTNESS]');
    console.log('  INSTANCE: Light instance number (e.g., 46)');
    console.log('  COMMAND: on, off, or dim');
    console.log('  BRIGHTNESS: Brightness level (0-100), required for "on" and "dim"');
    client.end();
    return;
  }
  
  const instance = args[0];
  const command = args[1].toLowerCase();
  const brightness = args[2] ? parseInt(args[2], 10) : (command === 'on' ? 100 : 0);
  
  // Send the command
  sendRvcCommand(instance, command, brightness);
});

client.on('error', (error) => {
  console.error('MQTT Error:', error);
  client.end();
});

/**
 * Send RVC dimmer command
 * @param {string} instance - The instance number
 * @param {string} command - Command: 'on', 'off', 'dim'
 * @param {number} brightness - Brightness level (0-100)
 */
function sendRvcCommand(instance, command, brightness = 0) {
  // Map command strings to command codes
  const commandCodes = { 
    'dim': 19,   // Using ramp up for dim
    'on': 19,    // Using ramp up for on
    'off': 3
  };
  
  const cmdCode = commandCodes[command] || commandCodes.on;
  
  // Format the payload based on your RVC protocol
  const payload = JSON.stringify({
    command: cmdCode,
    "command definition": command === 'off' ? "off" : "ramp up",
    instance: parseInt(instance),
    "desired level": command === 'off' ? 0 : brightness,
    "delay/duration": 255
  });
  
  // Publish to the topic
  const topic = `RVC/DC_DIMMER_COMMAND_2/${instance}`;
  client.publish(topic, payload, {}, (error) => {
    if (error) {
      console.error('Error publishing message:', error);
    } else {
      console.log(`Command sent successfully to ${topic}`);
      console.log(`Payload: ${payload}`);
    }
    
    // Close the connection after sending the command
    setTimeout(() => {
      client.end();
      console.log('MQTT connection closed');
    }, 1000);
  });
}
