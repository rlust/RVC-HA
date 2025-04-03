// RV-C MQTT Control Panel Configuration

// API Configuration
export const API_BASE_URL = 'http://localhost:3003';
export const API_AUTH = {
    username: 'admin',
    password: 'rvpass'
};

// MQTT Configuration
export const MQTT_CONFIG = {
    mqttBroker: '100.110.189.122', 
    mqttPort: 9001,                 
    mqttClientId: 'rvc_ha_ui_',       
    mqttUsername: 'rc',              
    mqttPassword: 'rc',              
    mqttBaseTopic: 'RVC',             
    reconnectDelay: 5000            
};

// UI Configuration
export const UI_CONFIG = {
    REFRESH_INTERVAL: 30000, // 30 seconds
    MAX_LOGS_DISPLAY: 100,
    DEFAULT_VIEW: 'table'  // 'table' or 'card'
};
