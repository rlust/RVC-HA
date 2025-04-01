// frontend/js/mqtt.js

// This file provides MQTT initialization functions with simulation capability for testing

// Export function to initialize MQTT client with simulation option
export function initializeMqtt(updateCallback, simulationMode = false) {
    console.log('Initializing MQTT client, simulation mode:', simulationMode);
    
    // If simulation mode is enabled, create a simulated MQTT client
    if (simulationMode) {
        return createSimulatedMqttClient(updateCallback);
    }
    
    // If we're not in simulation mode, this file doesn't actually create the MQTT client
    // The connection is handled directly in main.js
    console.warn('Not using simulation mode - MQTT connection should be handled by main.js');
    return null;
}

// Create a simulated MQTT client for testing UI without an actual MQTT broker
function createSimulatedMqttClient(updateCallback) {
    console.log('Creating simulated MQTT client');
    
    // Mock MQTT client with basic methods
    const mockClient = {
        connected: true,
        
        // Mock subscribe method
        subscribe: function(topic) {
            console.log(`[SIMULATED] Subscribed to ${topic}`);
            return this;
        },
        
        // Mock publish method
        publish: function(topic, message, options) {
            console.log(`[SIMULATED] Published to ${topic}:`, message);
            
            // If this is a command, simulate a state update after a short delay
            if (topic.startsWith('RVC/command/') || topic.startsWith('RVC/commands/')) {
                const deviceId = topic.split('/')[2];
                simulateStateUpdate(deviceId, JSON.parse(message), updateCallback);
            }
            
            return this;
        },
        
        // Mock event registration
        on: function(event, callback) {
            if (event === 'connect') {
                // Immediately trigger connect callback
                setTimeout(() => callback(), 100);
            }
            return this;
        },
        
        // Mock end method
        end: function(force, options, callback) {
            console.log('[SIMULATED] MQTT connection ended');
            this.connected = false;
            if (callback) callback();
            return this;
        }
    };
    
    // Start sending simulated device updates
    startSimulation(updateCallback);
    
    return mockClient;
}

// Simulate device state updates for testing the UI
function startSimulation(updateCallback) {
    console.log('[SIMULATED] Starting device simulation');
    
    // Sample devices to simulate
    const devices = [
        { id: 'dimmer1', type: 'dimmer', initialState: { state: 'OFF', brightness: 0 } },
        { id: 'dimmer2', type: 'dimmer', initialState: { state: 'ON', brightness: 75 } },
        { id: 'vent1', type: 'vent', initialState: { position: 0 } },
        { id: 'vent2', type: 'vent', initialState: { position: 50 } },
        { id: 'tempSensor1', type: 'temperatureSensor', initialState: { temperature: 22.5, humidity: 45 } },
        { id: 'hvac1', type: 'hvac', initialState: { mode: 'cool', fanMode: 'auto', ambientTemperature: 24, coolSetpoint: 21 } },
        { id: 'waterHeater1', type: 'waterHeater', initialState: { mode: 'electric', setPointTemperature: 50, actualTemperature: 48 } },
        { id: 'generator1', type: 'generator', initialState: { status: 'stopped' } }
    ];
    
    // Initial server status update
    setTimeout(() => {
        updateCallback('RVC/status/server', { state: 'online' });
    }, 500);
    
    // Send initial state for each device
    devices.forEach(device => {
        setTimeout(() => {
            const topic = `RVC/status/${device.id}/state`;
            const payload = {
                ...device.initialState,
                deviceId: device.id,
                deviceType: device.type
            };
            
            updateCallback(topic, payload);
        }, 1000 + Math.random() * 1000); // Stagger updates
    });
    
    // Simulate random updates every 10-30 seconds
    setInterval(() => {
        // Select a random device to update
        const device = devices[Math.floor(Math.random() * devices.length)];
        const topic = `RVC/status/${device.id}/state`;
        
        // Create a random update based on device type
        let payload = {
            deviceId: device.id,
            deviceType: device.type
        };
        
        switch (device.type) {
            case 'dimmer':
                if (Math.random() > 0.5) {
                    payload.state = Math.random() > 0.5 ? 'ON' : 'OFF';
                }
                if (payload.state === 'ON') {
                    payload.brightness = Math.floor(Math.random() * 100);
                } else {
                    payload.brightness = 0;
                }
                break;
                
            case 'vent':
                payload.position = Math.floor(Math.random() * 100);
                break;
                
            case 'temperatureSensor':
                payload.temperature = Math.floor(Math.random() * 10) + 20; // 20-30°C
                payload.humidity = Math.floor(Math.random() * 50) + 30; // 30-80%
                break;
                
            case 'hvac':
                const modes = ['off', 'cool', 'heat', 'auto', 'fan_only'];
                payload.mode = modes[Math.floor(Math.random() * modes.length)];
                payload.ambientTemperature = Math.floor(Math.random() * 10) + 20; // 20-30°C
                break;
                
            case 'waterHeater':
                const waterModes = ['off', 'combustion', 'electric', 'gas_electric'];
                payload.mode = waterModes[Math.floor(Math.random() * waterModes.length)];
                payload.actualTemperature = Math.floor(Math.random() * 20) + 40; // 40-60°C
                break;
                
            case 'generator':
                payload.status = Math.random() > 0.7 ? 'running' : 'stopped';
                break;
        }
        
        // Send the update
        updateCallback(topic, payload);
        
    }, 10000 + Math.random() * 20000); // Random interval between 10-30 seconds
}

// Simulate a state update in response to a command
function simulateStateUpdate(deviceId, commandPayload, updateCallback) {
    setTimeout(() => {
        const topic = `RVC/status/${deviceId}/state`;
        let payload = {
            deviceId: deviceId,
            ...commandPayload // Include the command to indicate it was processed
        };
        
        // Add specific responses based on the command
        const command = commandPayload.command;
        
        // Get device type based on deviceId pattern
        let deviceType = 'unknown';
        if (deviceId.startsWith('dimmer')) {
            deviceType = 'dimmer';
        } else if (deviceId.startsWith('vent')) {
            deviceType = 'vent';
        } else if (deviceId.startsWith('tempSensor')) {
            deviceType = 'temperatureSensor';
        } else if (deviceId.startsWith('hvac')) {
            deviceType = 'hvac';
        } else if (deviceId.startsWith('waterHeater')) {
            deviceType = 'waterHeater';
        } else if (deviceId.startsWith('generator')) {
            deviceType = 'generator';
        }
        
        payload.deviceType = deviceType;
        
        // Update payload based on command and device type
        switch (command) {
            case 'turnOn':
                if (deviceType === 'dimmer') {
                    payload.state = 'ON';
                    payload.brightness = 100;
                }
                break;
                
            case 'turnOff':
                if (deviceType === 'dimmer') {
                    payload.state = 'OFF';
                    payload.brightness = 0;
                }
                break;
                
            case 'setBrightness':
                if (deviceType === 'dimmer') {
                    payload.state = payload.brightness > 0 ? 'ON' : 'OFF';
                }
                break;
                
            case 'open':
                if (deviceType === 'vent') {
                    payload.position = 100;
                }
                break;
                
            case 'close':
                if (deviceType === 'vent') {
                    payload.position = 0;
                }
                break;
                
            case 'setPosition':
                // No additional updates needed
                break;
                
            case 'setMode':
                // Handle both HVAC and water heater mode changes
                break;
                
            case 'setCommand':
                if (deviceType === 'generator') {
                    if (payload.command === 'start') {
                        payload.status = 'running';
                    } else if (payload.command === 'stop') {
                        payload.status = 'stopped';
                    }
                }
                break;
        }
        
        // Send the simulated state update
        updateCallback(topic, payload);
        
    }, 500 + Math.random() * 1000); // Random delay between 0.5-1.5 seconds
}