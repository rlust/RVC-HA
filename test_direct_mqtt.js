// Test script to monitor RVC MQTT topics and send direct commands
const mqtt = require('mqtt');

const MQTT_BROKER = 'mqtt://100.110.189.122:1883';
const MQTT_OPTIONS = {
  username: 'rc',
  password: 'rc'
};

// Connect to MQTT broker
const client = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

// Instance to test (Sink Light = 46)
const instance = 46;

// MQTT topics
const commandTopic = `RVC/DC_DIMMER_COMMAND_2/${instance}`;
const statusTopic = `RVC/DC_DIMMER_STATUS_3/${instance}`;

// Track the current state
let currentState = null;

client.on('connect', function () {
  console.log('Connected to MQTT broker');
  
  // Subscribe to status topic
  client.subscribe(statusTopic, function (err) {
    if (err) {
      console.error('Error subscribing to status topic:', err);
      return;
    }
    console.log(`Subscribed to ${statusTopic}`);
    
    // Send test command after brief delay to ensure subscription is active
    setTimeout(() => {
      // Turn ON command
      const onCommand = {
        command: 2,
        "command definition": "on",
        instance: instance,
        "desired level": 100,
        "delay/duration": 255
      };
      
      console.log(`Sending ON command to ${commandTopic}`);
      client.publish(commandTopic, JSON.stringify(onCommand));
      
      // Schedule OFF command after 3 seconds
      setTimeout(() => {
        const offCommand = {
          command: 3,
          "command definition": "off",
          instance: instance,
          "desired level": 0,
          "delay/duration": 255
        };
        
        console.log(`Sending OFF command to ${commandTopic}`);
        client.publish(commandTopic, JSON.stringify(offCommand));
        
        // Exit after another 3 seconds
        setTimeout(() => {
          console.log('Test complete. Disconnecting...');
          client.end();
          process.exit(0);
        }, 3000);
      }, 3000);
    }, 1000);
  });
});

client.on('message', function (topic, message) {
  try {
    const data = JSON.parse(message.toString());
    currentState = data;
    console.log(`Status update from ${topic}:`);
    console.log(`- Operating status (brightness): ${data['operating status (brightness)']}`);
    console.log(`- Light is ${data['operating status (brightness)'] > 0 ? 'ON' : 'OFF'}`);
  } catch (err) {
    console.error('Error parsing message:', err);
  }
});

client.on('error', function (err) {
  console.error('MQTT error:', err);
});
