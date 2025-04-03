// frontend/js/main.js

// Import necessary functions from modules
import { MQTT_CONFIG } from './config.js'; 
import { 
    updateTable, 
    updateCardView, 
    updateConnectionStatus
} from './ui.js';
import { sendCommand, setMqttClient } from './api.js';

// MQTT configuration
const CLIENT_ID = `rvha_frontend_${Math.random().toString(16).slice(2, 8)}`;
const TOPIC_PREFIX = MQTT_CONFIG.mqttBaseTopic;

// Global MQTT client reference
let mqttClient = null;
let client = null;
let reconnectTimeout = null; // Ensure declared once
let simulationMode = false;

// Rate limiting variables
const UI_UPDATE_INTERVAL_MS = 20; // Target 50 updates per second (1000 / 50)
let lastUiUpdateTime = 0;

// --- Initialization --- 

/**
 * Initialize MQTT connection and reporting
 */
function initializeMqtt() {
    // Check if MQTT client is supported
    if (typeof mqtt === 'undefined') {
        console.error("MQTT client library not loaded. Include mqtt.min.js.");
        updateConnectionStatus('error', 'MQTT Library Error');
        return;
    }

    /* --- TEMPORARILY DISABLED SIMULATION MODE CHECK --- 
    // Determine if running locally (for simulation)
    simulationMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (simulationMode) {
        console.warn("Running in simulation mode. No actual MQTT connection.");
        updateConnectionStatus('simulation', 'Simulation Mode');
        // Simulate some device data after a short delay
        setTimeout(simulateInitialDevices, 1000);
        // Set window.mqttClient to a dummy object for modal commands in simulation
        window.mqttClient = {
            publish: (topic, payload, options, callback) => {
                console.log(`SIMULATION: Publish to ${topic}: ${payload}`);
                // Simulate a dimmer status update after setting brightness
                try {
                    const data = JSON.parse(payload);
                    if (topic.includes('DC_DIMMER_COMMAND_2') && data.command === 0 && data.brightness !== undefined) {
                        const instanceMatch = topic.match(/_(\d+)\/set$/);
                        if (instanceMatch) {
                            const instance = instanceMatch[1];
                            const statusTopic = `RVC/DC_DIMMER_COMMAND_2_${instance}`;
                            const statusPayload = JSON.stringify({ "operating status (brightness)": data.brightness });
                            console.log(`SIMULATION: Simulating status update for ${statusTopic}: ${statusPayload}`);
                            setTimeout(() => handleMqttMessage(statusTopic, statusPayload), 200); // Simulate delay
                        }
                    }
                } catch (e) { console.error("SIMULATION: Error parsing simulated command payload", e); }
                if (callback) callback(); // Call the callback immediately
            },
            // Add dummy subscribe/unsubscribe if needed by other parts, though not strictly required for publish
            subscribe: (topic, options, callback) => { console.log(`SIMULATION: Subscribe to ${topic}`); if(callback) callback(); },
            unsubscribe: (topic, options, callback) => { console.log(`SIMULATION: Unsubscribe from ${topic}`); if(callback) callback(); },
        };
        return; // Don't attempt to connect in simulation mode
    }
    */

    const connectUrl = `ws://${MQTT_CONFIG.mqttBroker}:${MQTT_CONFIG.mqttPort}`;
    console.log(`Attempting to connect to MQTT broker at ${connectUrl}`);
    updateConnectionStatus('connecting', 'Connecting...');

    // Basic MQTT options
    const options = {
        clientId: MQTT_CONFIG.mqttClientId + Math.random().toString(16).substring(2, 8),
        connectTimeout: 4000,
        username: MQTT_CONFIG.mqttUsername,
        password: MQTT_CONFIG.mqttPassword,
        clean: true, // Start with a clean session
        reconnectPeriod: 0 // Disable automatic reconnect, we handle it manually
    };

    try {
        client = mqtt.connect(connectUrl, options); // Assign to the module-scoped client
    } catch (error) { // This catch might not be necessary if mqtt.connect doesn't throw synchronously often
        console.error("MQTT connection failed (initial connect call):", error);
        console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error))); // Log more details
        updateConnectionStatus('error', 'Connection Error');
        scheduleReconnect();
        return;
    }

    // --- MQTT Event Handlers ---

    client.on('connect', function () {
        console.log('MQTT client connected');
        window.mqttClient = client; // Assign to window ONLY after successful connect
        updateConnectionStatus('connected', 'Connected');
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }

        // Subscribe to base topics
        client.subscribe(`${MQTT_CONFIG.mqttBaseTopic}/#`, function (err) {
            if (!err) {
                console.log(`Subscribed to base topic: ${MQTT_CONFIG.mqttBaseTopic}/#`);
            } else {
                console.error(`Failed to subscribe to base topic: ${err}`);
            }
        });

        client.subscribe('RVC/status/server', function (err) {
            if (!err) {
                console.log('Subscribed to RVC/status/server');
            } else {
                console.error('Failed to subscribe to RVC/status/server: ', err);
            }
        });

        // TODO: Add other necessary subscriptions here (e.g., specific device status)
        // Example for dimmer status (if not covered by base topic wildcard)
        // client.subscribe('RVC/DC_DIMMER_COMMAND_2/+/status', function (err) { ... });

    });

    client.on('message', function (topic, message) {
        const messageString = message.toString();
        console.log(`Received message on ${topic}: ${messageString}`);
        handleMqttMessage(topic, messageString);
    });

    client.on('error', function (error) {
        console.error('MQTT client runtime error:', error);
        console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error))); // Log more details
        updateConnectionStatus('error', 'MQTT Error');
        // Don't automatically close here, 'close' event will handle reconnect
    });

    client.on('close', function () {
        console.log('MQTT connection closed.');
        updateConnectionStatus('disconnected', 'Disconnected');
        window.mqttClient = null; // Clear global reference
        if (!simulationMode) {
            scheduleReconnect();
        }
    });

    client.on('offline', function () {
        console.log('MQTT client is offline.');
        updateConnectionStatus('disconnected', 'Client Offline');
        window.mqttClient = null; // Clear global reference
        // Reconnect might be attempted by 'close' event
    });

    client.on('reconnect', function () {
        console.log('MQTT client attempting to reconnect...');
        updateConnectionStatus('connecting', 'Reconnecting...');
    });
}

// Function to handle incoming MQTT messages and route to UI
function handleMqttMessage(topic, messageString) {
    // Basic validation
    if (!topic || typeof messageString !== 'string') {
        console.warn("handleMqttMessage: Invalid topic or messageString received", topic, messageString);
        return;
    }

    // 1. Parse the payload
    let payload = {};
    try {
        payload = JSON.parse(messageString);
    } catch (e) {
        console.error(`Failed to parse JSON for topic ${topic}:`, messageString, e);
        // Decide how to handle non-JSON or malformed messages
        // Option 1: Treat as simple string status
        payload = { status: messageString }; 
        // Option 2: Ignore
        // return; 
    }

    // 2. Extract Device ID (full topic) and Device Type
    const deviceId = topic;
    let deviceType = 'Unknown'; 
 
    // Refined Topic Parsing Logic
    const parts = topic.split('/');
    if (parts.length >= 3 && parts[0] === 'RVC') {
        // Pattern 1: RVC/TYPE_INSTANCE/INSTANCE_VALUE/... (e.g., RVC/DC_DIMMER_STATUS_3/27)
        const potentialTypeWithInstance = parts[1];
        // Check if parts[1] looks like TYPE_INSTANCE (contains _STATUS_ or _COMMAND_ followed by _DIGIT)
        if ((potentialTypeWithInstance.includes('_STATUS_') || potentialTypeWithInstance.includes('_COMMAND_')) && /_\d+$/.test(potentialTypeWithInstance)) {
            deviceType = potentialTypeWithInstance; // Use the full TYPE_INSTANCE string
        } 
        // Pattern 2: RVC/TYPE/INSTANCE/... (e.g., RVC/AIR_CONDITIONER_STATUS/1)
        else if (!isNaN(parseInt(parts[2], 10))) {
             // Check if parts[1] is just the TYPE part (doesn't contain _DIGIT at the end)
             if (!/_\d+$/.test(parts[1])) { 
                deviceType = `${parts[1]}_${parts[2]}`; // Construct type like WATERHEATER_STATUS_1
             } else {
                 // Fallback if parts[1] looked like TYPE_INSTANCE but didn't match pattern 1
                 deviceType = parts[1];
             }
        } 
        // Fallback: Maybe the second part is just the type (if no instance)
        else {
             deviceType = parts[1]; // e.g., RVC/ATS_STATUS -> ATS_STATUS
        }
    } else if (parts.length === 2 && parts[0] === 'RVC') {
        // Handle simpler topics like RVC/status
        deviceType = parts[1];
    } 
    // Add specific known topic mappings if needed
    else if (topic === 'RVC/status/server') {
        deviceType = 'ServerStatus';
        // Handle server status message specifically if needed
        console.log(`Server Status: ${messageString}`);
        // Potentially update a dedicated status element, not the device table
        // return; // Don't add server status to the device table
    }

    console.log(`[handleMqttMessage] Parsed - ID: ${deviceId}, Type: ${deviceType}, Payload:`, payload); // DEBUG

    // 3. Update UI (send parsed payload and extracted type)
    // Rate limiting check
    const now = Date.now();
    // TEMPORARILY DISABLED Rate Limit Check
    // if (now - lastUiUpdateTime > UI_UPDATE_INTERVAL_MS) {
        updateTable(deviceId, payload, deviceType); // Pass parsed payload and type
        // lastUiUpdateTime = now;
    // } else {
    //     // Optional: Queue update or simply drop it to avoid flooding
    //     console.log(`[Rate Limit] Skipping UI update for ${deviceId}`);
    // }
 }

// Function to schedule reconnection attempts
function scheduleReconnect() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    console.log(`Scheduling reconnect in ${MQTT_CONFIG.reconnectDelay / 1000} seconds...`);
    reconnectTimeout = setTimeout(initializeMqtt, MQTT_CONFIG.reconnectDelay);
}

// --- Simulation Functions --- //

function simulateInitialDevices() {
    console.log("SIMULATION: Simulating initial device discovery.");
    // Simulate a dimmer
    const dimmerTopic1 = 'RVC/DC_DIMMER_COMMAND_2_0';
    const dimmerPayload1 = JSON.stringify({ "operating status (brightness)": 75 });
    handleMqttMessage(dimmerTopic1, dimmerPayload1);
    
    // Simulate another dimmer
    const dimmerTopic2 = 'RVC/DC_DIMMER_COMMAND_2_1';
    const dimmerPayload2 = JSON.stringify({ "operating status (brightness)": 30 });
    handleMqttMessage(dimmerTopic2, dimmerPayload2);

    console.log("SIMULATION: Initial device simulation complete.");
}

// Wait for the DOM to be fully loaded before initializing MQTT
document.addEventListener('DOMContentLoaded', initializeMqtt);

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