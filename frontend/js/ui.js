console.log('--- ui.js script loaded ---'); // Top level log

// Import shared data/config
import { deviceNameMapping } from './device_names.js'; // Import the mapping
console.log('UI: Imported deviceNameMapping:', deviceNameMapping); // Log the imported object

// DOM element references - initialized after DOMContentLoaded
let deviceTableBody;
let cardView;
let tableView;
let initialStatusRow;
let connectionStatus;
let connectionStatusText;
let viewToggles;
let parameterHelper;
let parameterSuggestions;

// Helper function to get the display name for a device (uses imported mapping)
function getDeviceDisplayName(deviceId) {
    console.log(`UI: getDeviceDisplayName called with ID: ${deviceId}`); // Log input
    const mappedName = deviceNameMapping[deviceId];
    const displayName = mappedName || deviceId; // Return mapped name or original ID
    console.log(`UI: Mapped name found: ${mappedName}, Returning: ${displayName}`); // Log output
    return displayName;
}

// State Management
let firstMessageReceived = false; // Flag to track if any device message has been received
const deviceStates = new Map(); // Store the latest state for each device

// Initialize all DOM references
function setupUiElements() { // Renamed from initializeDomReferences
    console.log('Running setupUiElements'); // Updated log message
    
    // Get all critical DOM elements
    console.log('Attempting to find deviceTableBody'); // Added diagnostic log
    deviceTableBody = document.getElementById('deviceTableBody');
    cardView = document.getElementById('cardView');
    tableView = document.getElementById('tableView');
    initialStatusRow = deviceTableBody ? deviceTableBody.querySelector('tr') : null;
    connectionStatus = document.getElementById('connectionStatus');
    connectionStatusText = document.getElementById('connectionText');
    viewToggles = document.querySelectorAll('.view-toggle');
    parameterHelper = document.getElementById('parameterHelper');
    parameterSuggestions = document.querySelector('.parameter-suggestions');
    
    // Log status of critical elements
    console.log('Critical DOM elements initialized:', { 
        deviceTableBodyFound: !!deviceTableBody,
        connectionStatusFound: !!connectionStatus,
        connectionStatusTextFound: !!connectionStatusText
    });
    
    // Set up initial connection status
    if (connectionStatus && connectionStatusText) {
        console.log('Setting initial connection status');
        // Set initial status - this ensures we have the right structure
        updateConnectionStatus('connecting', 'Initializing connection...');
    } else {
        console.error('Connection status elements not found during initialization');
    }
}

// Function to initialize UI (event listeners, etc.)
// Removed the DOMContentLoaded listener from here, initialization is triggered from main.js
function initializeUI() {
    // Initialize DOM references first
    setupUiElements();
    
    // Set up view toggles
    viewToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            viewToggles.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            if (view === 'table') {
                tableView.classList.remove('hidden');
                cardView.classList.add('hidden');
            } else {
                tableView.classList.add('hidden');
                cardView.classList.remove('hidden');
            }
        });
    });
    
    // Set up parameter helper behavior for command selection
    const commandSelect = document.getElementById('command');
    if (commandSelect) {
        commandSelect.addEventListener('change', function() {
            updateParameterHelper(this.value);
        });
    }

    // Set up log refresh and export buttons
    const refreshLogBtn = document.getElementById('refreshLog');
    const exportLogBtn = document.getElementById('exportLog');
    
    if (refreshLogBtn) {
        refreshLogBtn.addEventListener('click', fetchAndDisplayLogs);
    }
    
    if (exportLogBtn) {
        exportLogBtn.addEventListener('click', exportLogsToCSV);
    }
}

// Function to format the status payload based on device type
function formatStatus(payload) {
    if (!payload || typeof payload !== 'object') {
        return JSON.stringify(payload); // Fallback for unexpected format
    }
    
    const type = payload.deviceType;
    let statusParts = [];

    switch (type) {
        case 'dimmer':
            if ('state' in payload) {
                statusParts.push(`State: ${payload.state}`);
            }
            if ('brightness' in payload) {
                 statusParts.push(`Brightness: ${payload.brightness}%`);
            }
            // If only brightness is sent, don't assume state is ON
            if (!('state' in payload) && !('brightness' in payload)) {
                statusParts.push('Status pending...');
            }
            break;
        case 'vent':
            if (payload.position !== undefined) {
                statusParts.push(`Position: ${payload.position}%`);
                 statusParts.push(payload.position === 100 ? '(Open)' : payload.position === 0 ? '(Closed)' : '(Partial)');
            }
            break;
        case 'temperatureSensor': // Assuming type name from backend
             if (payload.temperature !== undefined) {
                statusParts.push(`Temp: ${payload.temperature}°`); // Add unit if known
            }
            if (payload.humidity !== undefined) {
                statusParts.push(`Humidity: ${payload.humidity}%`);
            }
            if (payload.calibrationOffset !== undefined) {
                 statusParts.push(`Calib. Offset: ${payload.calibrationOffset}`);
            }
             break;
        case 'hvac':
            if (payload.mode !== undefined) {
                statusParts.push(`Mode: ${payload.mode}`);
            }
             if (payload.fanMode !== undefined) {
                statusParts.push(`Fan: ${payload.fanMode}`);
            }
            if (payload.ambientTemperature !== undefined) {
                statusParts.push(`Ambient: ${payload.ambientTemperature}°`);
            }
            if (payload.coolSetpoint !== undefined) {
                statusParts.push(`Cool Set: ${payload.coolSetpoint}°`);
            }
            if (payload.heatSetpoint !== undefined) {
                statusParts.push(`Heat Set: ${payload.heatSetpoint}°`);
            }
            break;
         case 'waterHeater':
             if (payload.mode !== undefined) {
                statusParts.push(`Mode: ${payload.mode}`);
            }
            if (payload.setPointTemperature !== undefined) {
                statusParts.push(`Set Temp: ${payload.setPointTemperature}°`);
            }
            if (payload.actualTemperature !== undefined) { // Assuming this might be reported
                statusParts.push(`Actual Temp: ${payload.actualTemperature}°`);
            }
             break;
        case 'generator':
            if (payload.status !== undefined) {
                statusParts.push(`Status: ${payload.status}`);
            }
            if (payload.command !== undefined) { // Show last command sent
                statusParts.push(`Last Cmd: ${payload.command}`);
            }
             // Add other relevant generator status fields if available
            if (payload.voltage !== undefined) {
                statusParts.push(`Voltage: ${payload.voltage}V`);
            }
            if (payload.frequency !== undefined) {
                 statusParts.push(`Freq: ${payload.frequency}Hz`);
            }
            break;
        default:
            // Generic fallback: display all key-value pairs except IDs
            for (const [key, value] of Object.entries(payload)) {
                if (key !== 'deviceId' && key !== 'deviceType') {
                    statusParts.push(`${key}: ${JSON.stringify(value)}`);
                }
            }
            break;
    }

    return statusParts.length > 0 ? statusParts.join(', ') : 'Status unavailable';
}

// Function to update the connection status UI
/**
 * Update the connection status display
 * @param {string} status - connected, disconnected, connecting, error, or simulation
 * @param {string} message - Optional message to display
 */
function updateConnectionStatus(status, message = null) {
    const statusIndicator = document.getElementById('connectionIndicator');
    const statusText = document.getElementById('connectionText');
    
    if (!statusIndicator || !statusText) {
        console.error('Connection status elements not found in DOM');
        return;
    }
    
    // Clear previous classes
    statusIndicator.className = 'status-indicator';
    
    // Set appropriate class and text based on status
    switch (status) {
        case 'connected':
            statusIndicator.classList.add('status-connected');
            statusText.textContent = message || 'Connected';
            break;
        case 'connecting':
            statusIndicator.classList.add('status-connecting');
            statusText.textContent = message || 'Connecting...';
            break;
        case 'disconnected':
            statusIndicator.classList.add('status-disconnected');
            statusText.textContent = message || 'Disconnected';
            break;
        case 'error':
            statusIndicator.classList.add('status-error');
            statusText.textContent = message || 'Connection Error';
            console.error('Connection error:', message);
            break;
        case 'simulation':
            statusIndicator.classList.add('status-simulation');
            statusText.textContent = message || 'Simulation Mode';
            console.log('Running in simulation mode');
            break;
        default:
            statusIndicator.classList.add('status-unknown');
            statusText.textContent = message || 'Unknown Status';
    }
}

// Function to create action buttons for a device
function createActionButtons(deviceId, deviceType) {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'action-buttons';
    
    // Common actions based on device type
    let isHandledByType = false;
    switch (deviceType) {
        case 'dimmer': // Assuming this is a different type
            const onBtn = createButton('On', () => quickCommand(deviceId, 'turnOn'));
            const offBtn = createButton('Off', () => quickCommand(deviceId, 'turnOff'));
            btnContainer.appendChild(onBtn);
            btnContainer.appendChild(offBtn);
            isHandledByType = true;
            break;
        case 'vent':
            const openBtn = createButton('Open', () => quickCommand(deviceId, 'open'));
            const closeBtn = createButton('Close', () => quickCommand(deviceId, 'close'));
            btnContainer.appendChild(openBtn);
            btnContainer.appendChild(closeBtn);
            isHandledByType = true;
            break;
        case 'DC_DIMMER_COMMAND': // Handle our new dimmer type
            const setBrightnessBtn = createButton('Set Brightness', () => selectDeviceForControl(deviceId, deviceType)); // Pass type
            setBrightnessBtn.classList.add('control-btn'); // Use same class for styling?
            btnContainer.appendChild(setBrightnessBtn);
            isHandledByType = true;
            break;
        // Add other device type specific actions
    }
    
    // Add a generic control button ONLY if not handled by type-specific buttons above
    if (!isHandledByType) {
        const ctrlBtn = createButton('Control', () => selectDeviceForControl(deviceId, deviceType)); // Pass type
        ctrlBtn.classList.add('control-btn');
        btnContainer.appendChild(ctrlBtn);
    }
    
    return btnContainer;
}

// Helper function to create a button
function createButton(text, clickHandler) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'device-action-btn';
    btn.addEventListener('click', clickHandler);
    return btn;
}

// Function to handle quick commands (without parameters)
function quickCommand(deviceId, command) {
    // Fill the form with the device ID and command
    document.getElementById('deviceId').value = deviceId;
    document.getElementById('command').value = command;
    document.getElementById('parameters').value = '{}';
    
    // Submit the form programmatically
    const evt = new Event('submit', { bubbles: true, cancelable: true });
    document.getElementById('commandForm').dispatchEvent(evt);
}

// Function to select a device for detailed control
function selectDeviceForControl(deviceId, deviceType) { // Added deviceType parameter
    const commandInput = document.getElementById('command');
    const paramsInput = document.getElementById('parameters');
    
    // Set the device ID regardless of type
    document.getElementById('deviceId').value = deviceId;
    
    // Pre-fill command/params based on type
    if (deviceType === 'DC_DIMMER_COMMAND') {
        commandInput.value = 'set_brightness'; // Suggest a command
        paramsInput.value = '{ "brightness": 0 }'; // Suggest parameters with a default
        updateParameterHelper('set_brightness'); // Trigger helper update
    } else {
        // For other types, maybe clear the command/params or leave as is?
        // Let's clear them for now to avoid confusion.
        commandInput.value = '';
        paramsInput.value = '{}';
        updateParameterHelper(''); // Clear helper
    }
    
    // Scroll to the control form
    document.getElementById('controls').scrollIntoView({ behavior: 'smooth' });
}

// Function to display parameter suggestions based on selected command
function updateParameterHelper(command) {
    if (!parameterHelper || !parameterSuggestions) return;
    
    // Clear previous suggestions
    parameterSuggestions.innerHTML = '';
    
    let suggestionHTML = '';
    let hasParameters = false;
    
    switch(command) {
        case 'setBrightness':
            suggestionHTML = `
                <p>Required parameters:</p>
                <code>{"brightness": 50}</code>
                <p><strong>brightness</strong>: Value between 0-100</p>
            `;
            hasParameters = true;
            break;
        case 'setPosition':
            suggestionHTML = `
                <p>Required parameters:</p>
                <code>{"position": 75}</code>
                <p><strong>position</strong>: Value between 0-100</p>
            `;
            hasParameters = true;
            break;
        // Add more command parameter suggestions
        case 'setMode':
            suggestionHTML = `
                <p>Required parameters for HVAC:</p>
                <code>{"mode": "cool"}</code>
                <p>Options: "off", "cool", "heat", "auto", "fan_only"</p>
                <p>Or for Water Heater:</p>
                <code>{"mode": "electric"}</code>
                <p>Options: "off", "combustion", "electric", "gas_electric", "automatic"</p>
            `;
            hasParameters = true;
            break;
        case 'setCommand':
            suggestionHTML = `
                <p>Required parameters:</p>
                <code>{"command": "start"}</code>
                <p>Options: "stop", "start", "manual_prime", "manual_preheat"</p>
            `;
            hasParameters = true;
            break;
    }
    
    if (hasParameters) {
        parameterSuggestions.innerHTML = suggestionHTML;
        parameterHelper.classList.remove('hidden');
    } else {
        parameterHelper.classList.add('hidden');
    }
}

// Exported function to update the device table in the UI
// Now accepts deviceId directly from main.js
function updateTable(deviceId, payload) {
    if (!deviceTableBody || !cardView) {
        console.error('UI Error: updateTable - Device table body or card view not found!');
        return;
    }

    // Determine Device Type from the unified deviceId
    let deviceType = 'Unknown';
    let isDimmer = false;
    if (deviceId.startsWith('DC_DIMMER_COMMAND_2_')) {
        deviceType = 'DC_DIMMER'; // Simplified type name
        isDimmer = true;
    } else if (deviceId === 'RVC/status/server') {
        // Handle server status update (moved logic here for clarity)
        console.log('UI: updateTable - Received server status update:', payload);
        if (payload && payload.state === 'online') {
            updateConnectionStatus('connected', 'Connected to MQTT Server');
        } else {
            updateConnectionStatus('disconnected', 'MQTT Server Offline or Initializing');
        }
        return; // Stop processing for server status
    } else {
        // Attempt to parse other RVC device types if needed in the future
        const parts = deviceId.split('_');
        if (parts.length > 1) {
            deviceType = parts[0]; // Crude type extraction, improve if needed
        }
        console.log(`UI: updateTable - Processing non-dimmer device: ${deviceId}, Type: ${deviceType}`);
    }

    // Use the deviceId itself for display name lookup (since it's the unified key)
    const displayNameId = deviceId;

    // Parse payload (minimal parsing, handle potential non-JSON)
    let parsedPayload = payload;
    if (typeof payload === 'string') {
        try {
            parsedPayload = JSON.parse(payload);
        } catch (e) {
            parsedPayload = { rawValue: payload };
        }
    } else if (typeof payload !== 'object' || payload === null) {
        parsedPayload = { rawValue: String(payload) }; // Ensure it's an object
    }

    // Store the latest state
    deviceStates.set(deviceId, parsedPayload);

    // --- UI Update Logic (Table & Card) ---

    // Remove initial "Connecting..." row
    if (!firstMessageReceived && initialStatusRow) {
        if (initialStatusRow.parentNode === deviceTableBody) {
            deviceTableBody.removeChild(initialStatusRow);
        }
        firstMessageReceived = true;
        // Set status to connected unless in Simulation mode
        if (connectionStatusText && connectionStatusText.textContent !== 'Simulation Mode') {
             updateConnectionStatus('connected', 'Connected to MQTT Server');
        }
    }

    // Format status based on type and payload
    let formattedStatus = '';
    if (isDimmer) {
        const brightness = parsedPayload && parsedPayload.hasOwnProperty("operating status (brightness)")
                            ? String(parsedPayload["operating status (brightness)"]) + '%'
                            : (parsedPayload && parsedPayload.rawValue !== undefined ? String(parsedPayload.rawValue) : 'N/A');
        formattedStatus = `Brightness: ${brightness}`;
    } else {
        // Generic status formatting
        formattedStatus = formatStatus(parsedPayload); // Use existing helper
    }

    const statusTooltip = JSON.stringify(parsedPayload, null, 2); // Full payload for tooltip

    // Find or create table row
    let row = document.getElementById(`device-${deviceId}`);
    if (!row) {
        // Create new row
        row = deviceTableBody.insertRow();
        row.id = `device-${deviceId}`;

        const cellId = row.insertCell(0);
        const cellType = row.insertCell(1);
        const cellStatus = row.insertCell(2);
        const cellActions = row.insertCell(3);

        cellId.textContent = getDeviceDisplayName(displayNameId);
        cellType.textContent = deviceType;
        cellStatus.textContent = formattedStatus;
        cellStatus.title = statusTooltip;
        cellActions.appendChild(createActionButtons(deviceId, deviceType)); // Pass unified ID and type
    } else {
        // Update existing row
        const cellType = row.cells[1];
        const cellStatus = row.cells[2];
        const cellActions = row.cells[3];

        if (cellType.textContent !== deviceType) cellType.textContent = deviceType;
        cellStatus.textContent = formattedStatus;
        cellStatus.title = statusTooltip;

        // Update action buttons if needed (e.g., if type changed)
        cellActions.replaceChild(createActionButtons(deviceId, deviceType), cellActions.firstChild);
    }

    // Update card view - Pass unified ID, payload, and derived type
    updateCardView(deviceId, parsedPayload, deviceType);
}

// Function to update the card view
// Simplified signature: accepts unified deviceId, payload, and deviceType
function updateCardView(deviceId, payload, deviceType) {
    if (!cardView) return; // Exit if container is missing

    const displayName = getDeviceDisplayName(deviceId); // Get name using unified ID
    const isDimmer = deviceType === 'DC_DIMMER';

    // Format status based on type and payload (similar to updateTable)
    let formattedStatus = '';
    if (isDimmer) {
        const brightness = payload && payload.hasOwnProperty("operating status (brightness)")
                            ? String(payload["operating status (brightness)"]) + '%'
                            : (payload && payload.rawValue !== undefined ? String(payload.rawValue) : 'N/A');
        formattedStatus = `Brightness: ${brightness}`;
    } else {
        formattedStatus = formatStatus(payload); // Use existing helper
    }
    const statusTooltip = JSON.stringify(payload, null, 2); // Full payload for tooltip

    let card = document.getElementById(`card-${deviceId}`);
    if (!card) {
        // --- Create new card --- 
        card = document.createElement('div');
        card.id = `card-${deviceId}`;
        card.className = 'device-card';

        card.innerHTML = `
            <div class="device-card-header">
                <div class="device-card-title">${displayName}</div>
                <div class="device-card-type">${deviceType}</div>
            </div>
            <div class="device-card-status" title="${escapeHtml(statusTooltip)}">${formattedStatus}</div>
            <div class="device-card-actions"></div>
        `;
        
        const cardActions = card.querySelector('.device-card-actions');
        cardActions.appendChild(createActionButtons(deviceId, deviceType)); // Use unified ID and type
        
        cardView.appendChild(card);
    } else {
        // --- Update existing card --- 
        const cardTitle = card.querySelector('.device-card-title');
        const cardType = card.querySelector('.device-card-type');
        const cardStatusElement = card.querySelector('.device-card-status');
        const cardActions = card.querySelector('.device-card-actions');

        if (cardTitle) cardTitle.textContent = displayName;
        if (cardType && cardType.textContent !== deviceType) cardType.textContent = deviceType;
        if (cardStatusElement) {
            cardStatusElement.textContent = formattedStatus;
            cardStatusElement.title = statusTooltip;
        }
        // Recreate/update action buttons
        if (cardActions) {
            cardActions.replaceChild(createActionButtons(deviceId, deviceType), cardActions.firstChild);
        }
    }
}

// Helper to escape HTML for tooltips/attributes
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        unsafe = JSON.stringify(unsafe); // Ensure it's a string
    }
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// Fetch logs from the server
async function fetchAndDisplayLogs() {
    const logTableBody = document.getElementById('logTableBody');
    if (!logTableBody) return;
    
    try {
        // Show loading indicator
        logTableBody.innerHTML = '<tr><td colspan="4"><div class="loading-spinner"></div> Loading logs...</td></tr>';
        
        // Debug log to show API URL being used
        console.log('Attempting to fetch logs from:', `${API_BASE_URL}/api/logs`);
        
        const logs = await fetchLogs();
        
        // Clear loading message
        logTableBody.innerHTML = '';
        
        if (logs.length === 0) {
            logTableBody.innerHTML = '<tr><td colspan="4"><em>No logs found</em></td></tr>';
            return;
        }
        
        // Add logs to table
        logs.forEach(log => {
            const row = logTableBody.insertRow();
            
            const cellTimestamp = row.insertCell(0);
            const cellDevice = row.insertCell(1);
            const cellEvent = row.insertCell(2);
            const cellDetails = row.insertCell(3);
            
            const date = new Date(log.timestamp);
            cellTimestamp.textContent = date.toLocaleString();
            cellDevice.textContent = getDeviceDisplayName(log.deviceId); // Use display name
            cellEvent.textContent = log.event;
            
            try {
                const details = JSON.parse(log.status);
                cellDetails.textContent = JSON.stringify(details, null, 2);
            } catch (e) {
                cellDetails.textContent = log.status || '-';
            }
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        logTableBody.innerHTML = `<tr><td colspan="4">Error loading logs: ${error.message}</td></tr>`;
    }
}

// Export logs as CSV
async function exportLogsToCSV() {
    try {
        const blob = await exportLogs();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'rvc_logs.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting logs:', error);
        alert(`Error exporting logs: ${error.message}`);
    }
}

// ==================================================================================
// Device Control Modal Logic
// ==================================================================================

const deviceControlModal = document.getElementById('deviceControlModal');
const modalDeviceName = document.getElementById('modalDeviceName');
const modalDeviceIdInput = document.getElementById('modalDeviceId');
const brightnessSlider = document.getElementById('brightnessSlider');
const brightnessValueSpan = document.getElementById('brightnessValue');

// Update brightness value display when slider changes
if (brightnessSlider) {
    brightnessSlider.oninput = function() {
        brightnessValueSpan.textContent = this.value;
    }
}

// Function to open the modal and populate it with device info
function openControlModal(deviceId, displayName) {
    console.log(`UI: Opening control modal for ${deviceId} (${displayName})`);
    if (!deviceControlModal) {
        console.error("UI Error: Device control modal element not found!");
        return;
    }
    modalDeviceName.textContent = displayName; // Use the friendly name
    modalDeviceIdInput.value = deviceId; // Store the *actual* device ID (e.g., DC_DIMMER_COMMAND_2_50)
    
    // TODO: Optionally fetch current brightness from deviceStates and set slider initial value?
    // const currentState = deviceStates.get(deviceId);
    // if (currentState && currentState.hasOwnProperty('desired level')) {
    //    brightnessSlider.value = currentState['desired level'];
    //    brightnessValueSpan.textContent = currentState['desired level'];
    // } else {
    //    brightnessSlider.value = 50; // Default if state unknown
    //    brightnessValueSpan.textContent = 50;
    // }

    deviceControlModal.classList.remove('hidden');
}

// Function to close the modal
function closeControlModal() {
    if (deviceControlModal) {
        deviceControlModal.classList.add('hidden');
    }
}

// Function to send a dimmer command via MQTT
function sendDimmerCommand(commandCode) {
    const deviceId = modalDeviceIdInput.value;
    if (!deviceId) {
        console.error("UI Error: No device ID selected in modal.");
        return;
    }

    // Extract instance number from the deviceId (e.g., "DC_DIMMER_COMMAND_2_50" -> 50)
    const match = deviceId.match(/_(\d+)$/); 
    if (!match || !match[1]) {
        console.error(`UI Error: Could not extract instance number from deviceId: ${deviceId}`);
        return;
    }
    const instance = parseInt(match[1], 10);

    // Construct the payload based on the command code
    const payload = { 
        command: commandCode,
        instance: instance
    };

    // Add brightness if command is Set Level (0)
    if (commandCode === 0 && brightnessSlider) { 
        payload.brightness = parseInt(brightnessSlider.value, 10);
    }
    
    // Add time parameter if needed for future commands (e.g., 1, 2, 3)
    // if ([1, 2, 3].includes(commandCode)) { payload.time = /* get time value */; }

    // Construct the MQTT topic (assuming a control topic structure)
    // IMPORTANT: Adjust this topic if your backend expects something different!
    const topic = `RVC/DC_DIMMER_COMMAND_2/${instance}/set`; 

    console.log(`UI: Sending command to ${topic} with payload:`, JSON.stringify(payload));
    
    // Publish using the globally available MQTT client from main.js
    if (window.mqttClient && window.mqttClient.connected) {
        window.mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
            if (err) {
                console.error('UI Error: Failed to publish MQTT command:', err);
                // TODO: Show user feedback
            } else {
                console.log(`UI: Command ${commandCode} published successfully for ${deviceId}`);
                // Optionally close modal after sending? Or keep it open?
                // closeControlModal(); 
            }
        });
    } else {
        console.error('UI Error: MQTT client not connected or not available.');
        // TODO: Show user feedback
    }
}

// Remove DOMContentLoaded listener - initialization handled by main.js
// document.addEventListener('DOMContentLoaded', initializeUI);

// Restore export block
export { 
    setupUiElements, // Export renamed function
    updateTable,
    updateCardView,
    updateConnectionStatus,
    fetchAndDisplayLogs as fetchLogs, // Export local function
    exportLogsToCSV as exportLogs // Export local function
};