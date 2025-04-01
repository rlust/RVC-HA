// RV-C MQTT Control Panel Configuration

// API Configuration
export const API_BASE_URL = 'http://localhost:3003';
export const API_AUTH = {
    username: 'admin',
    password: 'rvpass'
};

// MQTT Configuration
export const MQTT_CONFIG = {
    BROKER_OPTIONS: [
        'ws://localhost:9001',   // Primary WebSocket port for Mosquitto
        'ws://localhost:8083',   // Alternative WebSocket port
        'ws://127.0.0.1:9001',   // Local IP alternative
        'ws://127.0.0.1:8083'    // Second local IP alternative
    ],
    TOPIC_PREFIX: 'RVC',
    CLIENT_ID_PREFIX: 'rvha_frontend_'
};

// UI Configuration
export const UI_CONFIG = {
    REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_LOGS_DISPLAY: 100,
    DEFAULT_VIEW: 'table'  // 'table' or 'card'
};
