// frontend/js/main.js

// Import necessary functions from modules
import { MQTT_CONFIG, API_BASE_URL, API_AUTH } from './config.js'; 
import { 
    updateTable, 
    updateCardView, 
    updateConnectionStatus, 
    setupUiElements, 
    fetchLogs, 
    exportLogs 
} from './ui.js';
import { sendCommand, setMqttClient } from './api.js';

// MQTT configuration
const CLIENT_ID = `rvha_frontend_${Math.random().toString(16).slice(2, 8)}`;
const TOPIC_PREFIX = 'RVC';

// Global MQTT client reference
let mqttClient = null;
let simulationMode = false;

/**
 * Initialize MQTT connection and reporting
 */
function initializeMqtt() {
    // Start with connecting status
    updateConnectionStatus('connecting', 'Initializing connection...');
    
    // Check if mqtt library is available
    if (typeof window.mqtt === 'undefined') {
        console.error('MQTT library not available');
        updateConnectionStatus('error', 'MQTT library not available');
        enableSimulationMode();
        return;
    }
    
    try {
        // The server has Mosquitto configured but WebSockets might not be accessible
        // We'll try to connect with a quick timeout and fallback to simulation mode
        
        const mqttHost = 'ws://localhost:9001'; // WebSocket protocol
        const options = {
            clientId: `rvc_ha_ui_${Math.random().toString(16).substr(2, 8)}`,
            username: 'admin', // Replace with your MQTT username
            password: 'rvpass', // Replace with your MQTT password
            reconnectPeriod: 5000, // Try reconnecting every 5 seconds
            connectTimeout: 10000, // Connection attempt timeout
        };

        console.log(`MQTT: Attempting to connect to ${mqttHost}`);
        const client = mqtt.connect(mqttHost, options);

        client.on('connect', function () {
            console.log('MQTT: Connected to broker');
            updateConnectionStatus('connected', 'Connected to MQTT Server');
            // Subscribe to relevant topics
            client.subscribe('RVC/status/+/state', function (err) {
                if (!err) {
                    console.log('MQTT: Subscribed to device status topics');
                } else {
                    console.error('MQTT: Subscription error:', err);
                }
            });
            client.subscribe('RVC/status/server', function (err) {
                if (!err) {
                    console.log('MQTT: Subscribed to server status topic');
                } else {
                    console.error('MQTT: Server status subscription error:', err);
                }
            });
        });

        client.on('message', function (topic, message) {
            // message is Buffer, convert to string
            const payloadString = message.toString();
            // console.log(`MQTT: Received message on ${topic}: ${payloadString}`);
            try {
                const payload = JSON.parse(payloadString);
                updateTable(topic, payload); // Update UI table
            } catch (e) {
                console.error(`MQTT: Error parsing JSON message on ${topic}:`, e, payloadString);
            }
        });

        client.on('error', function (error) {
            console.error('MQTT: Connection Error:', error);
            updateConnectionStatus('error', `Error: ${error.message}`);
            // Optionally switch to simulation mode on persistent errors
            // enableSimulationMode(); 
        });

        client.on('reconnect', function () {
            console.log('MQTT: Reconnecting...');
            updateConnectionStatus('reconnecting', 'Reconnecting...');
        });

        client.on('offline', function () {
            console.log('MQTT: Client offline');
            updateConnectionStatus('disconnected', 'Connection Offline');
            // enableSimulationMode(); // Switch to simulation if offline
        });

        client.on('close', function () {
            console.log('MQTT: Connection closed');
            updateConnectionStatus('disconnected', 'Connection Closed');
            // Don't automatically enable simulation on close if user might restart broker
            // Consider adding a button to manually enable simulation? 
            // enableSimulationMode(); 
        });

    } catch (error) {
        console.error('Error creating MQTT client:', error);
        updateConnectionStatus('error', `Error: ${error.message}`);
        enableSimulationMode(); // Fallback to simulation mode
    }
}

/**
 * Set up topic subscriptions (for when connection works)
 */
function setupSubscriptions() {
    if (!mqttClient) return;
    
    mqttClient.subscribe(`${TOPIC_PREFIX}/status/#`, function(err) {
        if (err) {
            console.error('Error subscribing to topics:', err);
        } else {
            console.log('Subscribed to device status topics');
        }
    });
}

/**
 * Enable simulation mode with realistic data
 */
function enableSimulationMode() {
    if (simulationMode) {
        return; // Prevent multiple activations
    }
    
    console.log('Activating simulation mode');
    simulationMode = true;
    updateConnectionStatus('simulation', 'Simulation Mode');
    
    // Generate realistic device data
    setTimeout(generateSimulatedData, 1000);
    
    // Set up periodic data updates
    setInterval(generateSimulatedData, 15000);
}

/**
 * Generate simulated device data for testing
 */
function generateSimulatedData() {
    // Simulate various devices
    updateTable('RVC/status/dimmer1/state', {
        deviceType: 'dimmer',
        name: 'Main Cabin Light',
        state: 'on',
        brightness: Math.floor(Math.random() * 30) + 70 // 70-100%
    });
    
    updateTable('RVC/status/thermo1/state', {
        deviceType: 'thermostat',
        name: 'Climate Control',
        state: 'on',
        temperature: Math.floor(Math.random() * 6) + 68, // 68-74 F
        mode: 'heat'
    });
    
    updateTable('RVC/status/vent1/state', {
        deviceType: 'vent',
        name: 'Bathroom Vent',
        state: 'open',
        position: Math.floor(Math.random() * 40) + 30 // 30-70%
    });
    
    console.log('Updated simulated device data');
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing application');
    
    // Explicitly initialize UI DOM references now that DOM is ready
    setupUiElements();
    
    // Set up command button handlers
    document.querySelectorAll('[data-command]').forEach(button => {
        button.addEventListener('click', handleCommandButton);
    });
    
    // Initialize MQTT or simulation mode
    initializeMqtt();
    
    // Fetch initial logs
    setTimeout(fetchLogs, 1500);
});

// Handle command button clicks
function handleCommandButton(event) {
    const button = event.currentTarget;
    const deviceId = button.getAttribute('data-device-id');
    const command = button.getAttribute('data-command');
    const deviceType = button.getAttribute('data-device-type');
    
    // Get additional parameters if needed
    const params = {};
    
    if (command === 'setBrightness' || command === 'setPosition') {
        // For sliders or range inputs
        const input = document.querySelector(`#${deviceId}-${command.toLowerCase()}`);
        if (input) {
            params.value = parseInt(input.value, 10);
        }
    }
    
    if (command === 'setTemperature') {
        const input = document.querySelector(`#${deviceId}-temperature`);
        if (input) {
            params.temperature = parseFloat(input.value);
        }
    }
    
    if (command === 'setMode') {
        const select = document.querySelector(`#${deviceId}-mode`);
        if (select) {
            params.mode = select.value;
        }
    }
    
    // Prepare payload
    const payload = {
        command,
        deviceType,
        ...params
    };
    
    console.log(`Sending command to ${deviceId}:`, payload);
    
    if (simulationMode) {
        console.log(`Simulating command: ${command} for ${deviceId}`);
        showStatusMessage(`Command ${command} processed in simulation mode`, 'success');
        return;
    }
    
    // Send command via API
    sendCommand(deviceId, payload)
        .then(response => {
            console.log('Command response:', response);
            showStatusMessage(`Command ${command} sent to ${deviceId}`, 'success');
        })
        .catch(error => {
            console.error('Error sending command:', error);
            showStatusMessage(`Error: ${error.message || 'Connection failed'}`, 'error');
        });
}

// Show status message
function showStatusMessage(message, type = 'info') {
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        
        // Clear after a few seconds
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'status-message';
        }, type === 'error' ? 5000 : 3000);
    }
}