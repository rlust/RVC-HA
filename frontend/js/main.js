// frontend/js/main.js

// Import necessary functions from modules
import { MQTT_CONFIG, API_BASE_URL, API_AUTH } from './config.js'; 
import { 
    updateTable, 
    updateCardView, 
    updateConnectionStatus
} from './ui.js';
import { sendCommand, setMqttClient } from './api.js';

// MQTT configuration
const CLIENT_ID = `rvha_frontend_${Math.random().toString(16).slice(2, 8)}`;
const TOPIC_PREFIX = 'RVC';

// Global MQTT client reference
let mqttClient = null;
window.mqttClient = null; // Make client globally accessible
let simulationMode = false;

// Rate limiting variables
const UI_UPDATE_INTERVAL_MS = 1000 / 15; // Approx 15 updates per second
let lastUiUpdateTime = 0;

// --- Initialization --- 

// Function to initialize the application
function initializeApp() {
    console.log('Main: Initializing application after DOM ready...');
    initializeMqtt(); // Attempt MQTT connection
}

// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', initializeApp);

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
        
        const mqttHost = 'ws://100.110.189.122:9001'; // New Host IP
        const options = {
            clientId: `rvc_ha_ui_${Math.random().toString(16).substr(2, 8)}`,
            username: 'rc', // New username
            password: 'rc', // New password
            reconnectPeriod: 5000, // Try reconnecting every 5 seconds
            connectTimeout: 10000, // Connection attempt timeout
        };

        console.log(`MQTT: Attempting to connect to ${mqttHost}`);
        let client = null;
        window.mqttClient = null; // Make client globally accessible
        client = mqtt.connect(mqttHost, options);
        window.mqttClient = client; // Assign to global variable
        mqttClient = client; // Store client instance

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
            // Add subscription for Dimmer Commands
            client.subscribe('RVC/DC_DIMMER_COMMAND_2/+', function (err) {
                if (!err) {
                    console.log('MQTT: Subscribed to dimmer command topics');
                } else {
                    console.error('MQTT: Dimmer subscription error:', err);
                }
            });
            client.subscribe('RVC/DC_DIMMER_STATUS_3/+', function (err) {
                if (!err) {
                    console.log('MQTT: Subscribed to dimmer status topics');
                } else {
                    console.error('MQTT: Dimmer status subscription error:', err);
                }
            });
        });

        const throttle = (func, limit) => {
            let inProgress = false;
            return function(...args) {
                if (!inProgress) {
                    inProgress = true;
                    func(...args);
                    setTimeout(() => {
                        inProgress = false;
                    }, limit);
                }
            }
        };

        client.on('message', throttle((topic, message) => {
            const messageString = message.toString();
            // console.log(`MQTT: Received raw message on ${topic}: ${messageString}`);

            // --- Topic Parsing and Instance Filtering ---
            let instance = null;
            let instanceNum = NaN;
            const topicParts = topic.split('/');

            // Match WATERHEATER_STATUS
            const whMatch = topic.match(/^RVC\/WATERHEATER_STATUS\/(\d+)$/);
            if (whMatch) {
                const instance = whMatch[1];
                const deviceId = `WATERHEATER_STATUS_${instance}`;
                console.log(`MQTT: Processing Water Heater status for ${topic} as DeviceID: ${deviceId}`);
                updateTable(deviceId, messageString); // Use messageString
                return; // Handled
            }

            // Match AIR_CONDITIONER_STATUS
            const acMatch = topic.match(/^RVC\/AIR_CONDITIONER_STATUS\/(\d+)$/);
            if (acMatch) {
                const instance = acMatch[1];
                const deviceId = `AIR_CONDITIONER_STATUS_${instance}`;
                console.log(`MQTT: Processing Air Conditioner status for ${topic} as DeviceID: ${deviceId}`);
                updateTable(deviceId, messageString); // Use messageString
                return; // Handled
            }

            // Handle DC_DIMMER_STATUS_3 and DC_DIMMER_COMMAND_2 messages
            if (topic.startsWith('RVC/DC_DIMMER_STATUS_3/') || topic.startsWith('RVC/DC_DIMMER_COMMAND_2/')) {
                // Extract instance again specifically for dimmers
                const dimmerInstanceMatch = topic.match(/\/(\d+)(\/set)?$/);
                const dimmerInstance = dimmerInstanceMatch ? dimmerInstanceMatch[1] : null;
                if (dimmerInstance) {
                    // Filter dimmer instances
                    const instanceNum = parseInt(dimmerInstance, 10);
                    if (isNaN(instanceNum) || instanceNum < 25 || instanceNum > 60) {
                        console.log(`MQTT: Ignoring dimmer instance ${dimmerInstance} (outside 25-60 range)`);
                        return; // Stop processing this message
                    }
                    // Always use the COMMAND_2 format for the unified device ID
                    const deviceId = `DC_DIMMER_COMMAND_2_${dimmerInstance}`;
                    console.log(`MQTT: Processing dimmer message for ${topic} as DeviceID: ${deviceId}`);
                    updateTable(deviceId, messageString); // Pass unified deviceId and messageString
                    return; // Handled
                }
            }

            // Handle generic RVC/+/+/status messages (if any)
            if (topic.match(/^RVC\/([^\/]+)\/([^\/]+)\/status$/)) {
                const statusMatch = topic.match(/^RVC\/([^\/]+)\/([^\/]+)\/status$/);
                const deviceType = statusMatch[1];
                const statusInstance = statusMatch[2];
                const deviceId = `${deviceType}_${statusInstance}`;
                console.log(`MQTT: Processing generic RVC status for ${topic} as DeviceID: ${deviceId}`);
                updateTable(deviceId, messageString);
                return; // Handled
            }

            // Handle server status
            if (topic === 'RVC/status/server') {
                console.log('MQTT: Received server status update:', messageString);
                try {
                    const serverStatus = JSON.parse(messageString);
                    if (serverStatus && serverStatus.state === 'online') {
                        updateConnectionStatus('connected', 'Connected to MQTT Server');
                    } else {
                        // Handle cases where state is not 'online' or message is invalid JSON
                        updateConnectionStatus('disconnected', 'MQTT Server Status: ' + (serverStatus ? serverStatus.state : 'Unknown/Invalid'));
                    }
                } catch (e) {
                    console.error("MQTT: Failed to parse server status JSON:", e, "Raw message:", messageString);
                    updateConnectionStatus('error', 'Error parsing server status');
                }
                return; // Handled
            }

            // Optional: Log unhandled messages
            if (!deviceId) { // If none of the above matched
                // Ignore homeassistant topics silently if desired
                if (!topic.startsWith('homeassistant/')) {
                    console.log(`MQTT: Unhandled message topic: ${topic}`);
                }
            }
        }, 66)); // Approx 15 updates per second (1000ms / 15)

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