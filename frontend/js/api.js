// This module handles API communications with the backend
import { API_BASE_URL, API_AUTH } from './config.js';

// MQTT client reference (set by main.js)
let mqttClient = null;

// Set the MQTT client reference
export function setMqttClient(client) {
    mqttClient = client;
}

// Function to send commands to devices
export async function sendCommand(deviceId, payload) {
    try {
        // Check if we're using direct MQTT communication
        if (mqttClient && mqttClient.connected) {
            console.log('Sending command via MQTT...');
            const topic = `RVC/commands/${deviceId}`;
            
            // Publish to MQTT broker
            mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
            
            return {
                success: true,
                message: 'Command sent via MQTT'
            };
        }
        
        // Fallback to HTTP API if MQTT is not available
        console.log('Falling back to HTTP API...');
        
        // Using direct URL without API_BASE_URL - Fix for 404 issue
        const commandUrl = 'http://localhost:3003/api/devices/command';
        console.log('Fix applied - Using direct URL for commands:', commandUrl);
        
        const response = await fetch(commandUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${API_AUTH.username}:${API_AUTH.password}`)
            },
            body: JSON.stringify({
                deviceId: deviceId,
                ...payload
            })
        });

        const data = await response.json();
        
        return {
            success: response.ok,
            message: data.message || (response.ok ? 'Command sent successfully' : 'Failed to send command'),
            data: data
        };
    } catch (error) {
        console.error('API error:', error);
        return {
            success: false,
            message: error.message || 'Network error',
            error: error
        };
    }
}

// Function to fetch device states
export async function fetchDeviceStates() {
    try {
        // Using direct URL without API_BASE_URL - Fix for 404 issue
        const devicesUrl = 'http://localhost:3003/api/devices';
        console.log('Fix applied - Using direct URL for devices:', devicesUrl);
        
        const response = await fetch(devicesUrl, {
            headers: {
                'Authorization': 'Basic ' + btoa(`${API_AUTH.username}:${API_AUTH.password}`)
            }
        });

        if (!response.ok) {
            console.error('Devices API response error:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            devices: data
        };
    } catch (error) {
        console.error('Error fetching device states:', error);
        return {
            success: false,
            message: error.message || 'Failed to fetch device states',
            error: error
        };
    }
}

// Check the status of a command
export async function checkCommandStatus(commandId) {
    try {
        // Using direct URL without API_BASE_URL - Fix for 404 issue
        const statusUrl = `http://localhost:3003/api/commands/${commandId}`;
        console.log('Fix applied - Using direct URL for command status:', statusUrl);
        
        const response = await fetch(statusUrl, {
            headers: {
                'Authorization': 'Basic ' + btoa(`${API_AUTH.username}:${API_AUTH.password}`)
            }
        });

        if (!response.ok) {
            console.error('Command status API response error:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            status: data.status,
            data: data
        };
    } catch (error) {
        console.error('Error checking command status:', error);
        return {
            success: false,
            message: error.message || 'Failed to check command status',
            error: error
        };
    }
}

// Fetch configuration options (like available commands for device types)
export async function fetchConfigOptions() {
    try {
        // Using direct URL without API_BASE_URL - Fix for 404 issue
        const configUrl = 'http://localhost:3003/api/config';
        console.log('Fix applied - Using direct URL for config:', configUrl);
        
        const response = await fetch(configUrl, {
            headers: {
                'Authorization': 'Basic ' + btoa(`${API_AUTH.username}:${API_AUTH.password}`)
            }
        });

        if (!response.ok) {
            console.error('Config API response error:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            config: data
        };
    } catch (error) {
        console.error('Error fetching config options:', error);
        return {
            success: false,
            message: error.message || 'Failed to fetch configuration options',
            error: error
        };
    }
}

// Fetch logs
export async function fetchLogs(filters = {}) {
    try {
        // Convert filters to query parameters
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });
        
        const queryString = params.toString() ? `?${params.toString()}` : '';
        
        // Using direct URL without API_BASE_URL - Fix for 404 issue
        const url = 'http://localhost:3003/api/logs' + queryString;
        console.log('Fix applied - Using direct URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': 'Basic ' + btoa(`${API_AUTH.username}:${API_AUTH.password}`)
            }
        });
        
        if (!response.ok) {
            console.error('Logs API response error:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const logs = await response.json();
        return logs;
    } catch (error) {
        console.error('Error fetching logs:', error);
        throw error;
    }
}

// Export logs as CSV
export async function exportLogs(filters = {}) {
    try {
        // Convert filters to query parameters
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });
        
        const queryString = params.toString() ? `?${params.toString()}` : '';
        
        // Using direct URL without API_BASE_URL - Fix for 404 issue
        const url = 'http://localhost:3003/api/export/logs.csv' + queryString;
        console.log('Fix applied - Using direct URL for CSV export:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': 'Basic ' + btoa(`${API_AUTH.username}:${API_AUTH.password}`)
            }
        });
        
        if (!response.ok) {
            console.error('Logs export error:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response.blob();
    } catch (error) {
        console.error('Error exporting logs:', error);
        throw error;
    }
}