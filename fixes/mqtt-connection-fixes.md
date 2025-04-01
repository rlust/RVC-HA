# MQTT Connection Issues and Solutions

## Issue Description

The frontend was experiencing issues connecting to the MQTT broker, resulting in:
1. No device status updates being displayed
2. Commands not being sent properly
3. "Not connecting to MQTT server" errors
4. Broken connection status indicators

## Root Causes

1. **WebSocket Connection Issues**: The MQTT broker might not have WebSocket properly enabled or configured on the expected port (9001).
2. **Single Broker URL**: The frontend was only trying to connect to a single broker URL without fallbacks.
3. **Limited Reconnection Logic**: The reconnection logic was not robust enough to handle different failure scenarios.
4. **No Simulation Mode Fallback**: When real connection failed, there was no automatic fallback to simulation mode.

## Solutions Implemented

1. **Multiple Broker URL Options**: Added support for multiple WebSocket URLs to try (ports 9001 and 8083 on both localhost and 127.0.0.1).
2. **Enhanced Connection Status Feedback**: Improved status messages to show which broker is being tried and current reconnection attempt.
3. **Improved Reconnection Logic**: Better handling of connection failures with smart retry logic.
4. **Automatic Simulation Mode**: After exhausting real connection attempts, the system now automatically falls back to simulation mode.
5. **Improved Error Handling**: Added proper error handling for various MQTT connection scenarios.
6. **Verbose Logging**: Added more detailed console logs to help diagnose connection issues.
7. **Connection Testing**: Added a test message publication to verify successful connections.

## Code Changes

### 1. Updated MQTT Connection Configuration
```javascript
// Multiple broker URLs to try
const MQTT_BROKER_OPTIONS = [
    'ws://localhost:9001',   // Primary WebSocket port for Mosquitto
    'ws://localhost:8083',   // Alternative WebSocket port
    'ws://127.0.0.1:9001',   // Local IP alternative
    'ws://127.0.0.1:8083'    // Second local IP alternative
];
```

### 2. Improved Connection Logic
```javascript
function tryNextBrokerUrl() {
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Max reconnect attempts reached. Trying simulation mode...');
        updateConnectionStatus(false, 'Switching to Simulation');
        initSimulationMode();
        return;
    }
    
    // Try the next broker URL
    brokerUrlIndex = (brokerUrlIndex + 1) % MQTT_BROKER_OPTIONS.length;
    console.log(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} - Trying next broker: ${MQTT_BROKER_OPTIONS[brokerUrlIndex]}`);
    updateConnectionStatus(false, `Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    
    setTimeout(initMQTT, RECONNECT_DELAY);
}
```

### 3. Automatic Fallback to Simulation Mode
```javascript
function initSimulationMode() {
    console.log('Starting simulation mode for MQTT');
    mqttClient = initializeMqtt(updateTable, true);
    setMqttClient(mqttClient);
    
    if (mqttClient) {
        updateConnectionStatus(true, 'Connected (Simulation)');
        showAlert('Could not connect to MQTT broker. Running in simulation mode.', 'warning');
    }
}
```

## Future Improvements

1. **Configuration UI**: Add a configuration panel to let users specify their own MQTT broker URLs.
2. **Connection Quality Monitoring**: Implement a heartbeat mechanism to monitor connection quality.
3. **Auto-Recovery**: Periodically attempt to reconnect to a real broker even when in simulation mode.
4. **Offline Mode**: Support offline usage with cached device data when no connection is available.
