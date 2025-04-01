console.log('--- ui.js script loaded ---'); // Top level log

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
    switch (deviceType) {
        case 'dimmer':
            const onBtn = createButton('On', () => quickCommand(deviceId, 'turnOn'));
            const offBtn = createButton('Off', () => quickCommand(deviceId, 'turnOff'));
            btnContainer.appendChild(onBtn);
            btnContainer.appendChild(offBtn);
            break;
        case 'vent':
            const openBtn = createButton('Open', () => quickCommand(deviceId, 'open'));
            const closeBtn = createButton('Close', () => quickCommand(deviceId, 'close'));
            btnContainer.appendChild(openBtn);
            btnContainer.appendChild(closeBtn);
            break;
        // Add other device type specific actions
    }
    
    // Add a generic control button for all devices
    const ctrlBtn = createButton('Control', () => selectDeviceForControl(deviceId));
    ctrlBtn.classList.add('control-btn');
    btnContainer.appendChild(ctrlBtn);
    
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
function selectDeviceForControl(deviceId) {
    document.getElementById('deviceId').value = deviceId;
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
function updateTable(topic, payload) {
    if (!deviceTableBody || !cardView) {
        console.error('UI Error: updateTable - Device table body or card view not found!');
        return;
    }

    const topicParts = topic.split('/');
    
    // Expecting topic format RVC/status/<deviceId>/state
    if (topicParts.length < 4 || topicParts[0] !== 'RVC' || topicParts[1] !== 'status' || topicParts[3] !== 'state') {
        if (topic === 'RVC/status/server') {
            console.log('UI: updateTable - Received server status update:', payload);
            if (payload.state === 'online') {
                updateConnectionStatus('connected', 'Connected to MQTT Server');
            } else {
                updateConnectionStatus('disconnected', 'MQTT Server Offline');
            }
        } else if (topic.startsWith('homeassistant/')) {
            // console.log('UI: updateTable - Ignoring Home Assistant topic:', topic);
        }
        else {
            console.warn('UI: updateTable - Ignoring non-standard topic format:', topic);
        }
        return; 
    }

    const deviceId = topicParts[2];
    const deviceType = payload.deviceType || 'Unknown'; // Get type from payload
        
    // Store the device state
    deviceStates.set(deviceId, payload);

    // Remove initial "Connecting..." or "Waiting..." row on first valid device message
    if (!firstMessageReceived && initialStatusRow) {
        if (initialStatusRow.parentNode === deviceTableBody) {
            console.log('UI: updateTable - Removing initial status row.');
            deviceTableBody.removeChild(initialStatusRow);
        }
        firstMessageReceived = true;
        // Assuming first real message means connection is established
        if (connectionStatusText && connectionStatusText.textContent === 'Simulation Mode') {
            // Don't override simulation status just because a simulated message arrived
        } else {
             updateConnectionStatus('connected', 'Connected to MQTT Server');
        }
    }

    // Update table view
    let row = document.getElementById(`device-${deviceId}`);
    const formattedStatus = formatStatus(payload);

    if (!row) {
        console.log(`UI: updateTable - Creating row for ${deviceId}`);
        // Create new row for table view
        row = deviceTableBody.insertRow();
        row.id = `device-${deviceId}`;
        
        const cellId = row.insertCell(0);
        const cellType = row.insertCell(1);
        const cellStatus = row.insertCell(2);
        const cellActions = row.insertCell(3);
        
        cellId.textContent = deviceId;
        cellType.textContent = deviceType;
        cellStatus.textContent = formattedStatus;
        cellStatus.title = JSON.stringify(payload, null, 2); // Add full payload as tooltip
        
        // Add action buttons
        cellActions.appendChild(createActionButtons(deviceId, deviceType));
        
        // console.log(`UI: Added row for ${deviceId}`); // Redundant log
    } else {
        // Update existing row in table view
        // console.log(`UI: updateTable - Updating row for ${deviceId}`);
        const cellType = row.cells[1];
        const cellStatus = row.cells[2];
        const cellActions = row.cells[3];
        
        if (cellType.textContent !== deviceType && deviceType !== 'Unknown') {
            cellType.textContent = deviceType; // Update type if it changed or became known
        }
        
        cellStatus.textContent = formattedStatus;
        cellStatus.title = JSON.stringify(payload, null, 2); // Update tooltip
        
        // Update action buttons if needed
        if (cellActions.firstChild) {
             // Optimization: only update if type changed?
            cellActions.replaceChild(createActionButtons(deviceId, deviceType), cellActions.firstChild);
        } else {
             cellActions.appendChild(createActionButtons(deviceId, deviceType));
        }
    }

    // Update card view
    updateCardView(deviceId, deviceType, payload, formattedStatus);
}

// Function to update the card view
function updateCardView(deviceId, deviceType, payload, formattedStatus) {
    let card = document.getElementById(`card-${deviceId}`);
        
    if (!card) {
        // Create new card
        card = document.createElement('div');
        card.id = `card-${deviceId}`;
        card.className = 'device-card';
        
        // Create card header
        const cardHeader = document.createElement('div');
        cardHeader.className = 'device-card-header';
        
        const cardTitle = document.createElement('div');
        cardTitle.className = 'device-card-title';
        cardTitle.textContent = deviceId;
        
        const cardType = document.createElement('div');
        cardType.className = 'device-card-type';
        cardType.textContent = deviceType;
        
        cardHeader.appendChild(cardTitle);
        cardHeader.appendChild(cardType);
        
        // Create card status
        const cardStatus = document.createElement('div');
        cardStatus.className = 'device-card-status';
        cardStatus.textContent = formattedStatus;
        
        // Create card actions
        const cardActions = document.createElement('div');
        cardActions.className = 'device-card-actions';
        
        // Add control button
        const controlBtn = document.createElement('button');
        controlBtn.className = 'device-card-button';
        controlBtn.textContent = 'Control Device';
        controlBtn.addEventListener('click', () => selectDeviceForControl(deviceId));
        
        cardActions.appendChild(controlBtn);
        
        // Assemble card
        card.appendChild(cardHeader);
        card.appendChild(cardStatus);
        card.appendChild(cardActions);
        
        // Add to card view
        cardView.appendChild(card);
    } else {
        // Update existing card
        const cardType = card.querySelector('.device-card-type');
        const cardStatus = card.querySelector('.device-card-status');
        
        if (cardType.textContent !== deviceType && deviceType !== 'Unknown') {
            cardType.textContent = deviceType;
        }
        
        cardStatus.textContent = formattedStatus;
    }
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
            cellDevice.textContent = log.deviceId;
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