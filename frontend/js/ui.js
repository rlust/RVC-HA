import { deviceNameMapping } from './device_names.js';

// Global state for UI elements and device data
let deviceTableBody = null;
let cardView = null;
let tableView = null; // Add reference for tableView container
let connectionStatusText; // Reference to the connection status element
let initialStatusRow; // Reference to the initial "Connecting..." row
let firstMessageReceived = false;
let queuedUpdates = []; // Queue for updates before UI is ready
const deviceStates = new Map(); // Central store for latest device states
const allDevices = new Map(); // Store all device data { deviceId: { payload, deviceType, rowElement, cardElement } }
let currentView = 'table'; // 'table' or 'cards'
let currentFilter = 'all'; // 'all', 'lights', 'status'

// Define device type categories for filtering
const LIGHT_DEVICE_TYPES = [
    'DC_DIMMER_COMMAND', 
    'DC_LOAD_STATUS', 
    'LIGHT_SENSOR_STATUS'
    // Add other light-related types if needed
];

const STATUS_DEVICE_TYPES = [
    'WATERHEATER_STATUS',
    'AIR_CONDITIONER_STATUS',
    'INVERTER_AC_STATUS',
    'INVERTER_DC_STATUS',
    'INVERTER_OPERATING_STATUS',
    'TANK_STATUS',
    'GENERATOR_STATUS',
    'FURNACE_STATUS',
    'DM_1' // Diagnostic Message 1 (often system status)
    // Add other status/sensor types from rvcstates.md or common devices
];

// Helper function to sanitize device IDs for use as CSS selectors
function sanitizeId(id) {
    // Replace characters invalid in CSS IDs (like /, :, .) with underscores
    return id.replace(/[^a-zA-Z0-9\-_]/g, '_');
}

// Exported function to update the device table in the UI
// Now accepts deviceId directly from main.js
export function updateTable(deviceId, payload, deviceType) {
    console.log(`[updateTable] Entered - ID: ${deviceId}, Type: ${deviceType}, Payload:`, payload); // DEBUG
    // If UI elements aren't ready yet, queue the update
    if (!deviceTableBody || !cardView || !document.body.contains(deviceTableBody)) {
        console.log(`UI: updateTable - Queueing update for ${deviceId} as UI not fully ready.`);
        queuedUpdates.push({ deviceId, payload });
        return;
    }

    // Get the friendly name using the passed deviceType
    const friendlyName = getFriendlyName(deviceId, deviceType);

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

    // Store the latest state using the consistent lookupId
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
    switch (deviceType) {
        case 'DC_DIMMER':
            const brightness = parsedPayload?.["operating status (brightness)"]
                ? String(parsedPayload["operating status (brightness)"]) + '%'
                : (parsedPayload?.rawValue !== undefined ? String(parsedPayload.rawValue) : 'N/A');
            formattedStatus = `Brightness: ${brightness}`;
            break;
        case 'WATERHEATER':
            const tempF = parsedPayload?.['water temperature F'] ?? 'N/A';
            formattedStatus = `Temp: ${tempF}°F`;
            break;
        case 'HVAC':
            const mode = parsedPayload?.['operating mode definition'] ?? 'N/A';
            const fan = parsedPayload?.['fan speed'] ?? 'N/A';
            formattedStatus = `Mode: ${mode}, Fan: ${fan}%`;
            break;
        default:
            formattedStatus = formatStatus(parsedPayload); // Fallback
    }

    const statusTooltip = JSON.stringify(parsedPayload, null, 2); // Full payload for tooltip

    const sanitizedDeviceId = sanitizeId(deviceId);
    const rowId = `row-${sanitizedDeviceId}`; // ID for the table row
    let row = document.getElementById(rowId);
    if (!row) {
        // Create new row
        row = deviceTableBody.insertRow();
        row.id = rowId;

        const cellId = row.insertCell(0);
        const cellType = row.insertCell(1);
        const cellStatus = row.insertCell(2);
        const cellActions = row.insertCell(3);

        cellId.textContent = friendlyName;
        cellId.title = deviceId; // Show full ID on hover
        cellType.textContent = deviceType;
        cellStatus.textContent = formattedStatus;
        cellStatus.title = statusTooltip;
        cellActions.appendChild(createActionButtons(deviceId, deviceType)); // Pass lookup ID and type
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

    // Apply filter visibility
    row.style.display = matchesFilter(deviceId, deviceType) ? '' : 'none';
}

// Function to update connection status display
export function updateConnectionStatus(status, message) {
    // Only attempt to update if the element has been found (after DOMContentLoaded)
    if (connectionStatusText) {
        connectionStatusText.textContent = message;
        connectionStatusText.className = `status-${status}`; // Assuming CSS classes like .status-connected, .status-disconnected
        console.log(`UI: Connection status updated - ${status}: ${message}`);
    } else {
        console.error('UI: updateConnectionStatus - connectionStatusText element not found!');
    }
}

// Function to update the card view
// Simplified signature: accepts unified deviceId, payload, and deviceType
export function updateCardView(deviceId, payload, deviceType) {
    if (!cardView || !document.body.contains(cardView)) return; // Exit if container is missing

    // Always store the latest data (if not already done by updateTable)
    if (!allDevices.has(deviceId)) {
        allDevices.set(deviceId, { payload, deviceType });
    }

    const friendlyName = getFriendlyName(deviceId, deviceType); // Pass type
    const sanitizedDeviceId = sanitizeId(deviceId);
    const cardId = `card-${sanitizedDeviceId}`; // Use sanitized ID
    let card = document.getElementById(cardId);
    const isNew = !card;
    const nameElement = isNew ? null : cardView.querySelector(`#${cardId} .device-name`); // Select within existing card

    // Format status based on type and payload (similar to updateTable)
    let formattedStatus = '';
    switch (deviceType) {
        case 'DC_DIMMER':
            const brightness = payload?.["operating status (brightness)"]
                ? String(payload["operating status (brightness)"]) + '%'
                : (payload?.rawValue !== undefined ? String(payload.rawValue) : 'N/A');
            formattedStatus = `Brightness: ${brightness}`;
            break;
        case 'WATERHEATER':
            const tempF = payload?.['water temperature F'] ?? 'N/A';
            formattedStatus = `Temp: ${tempF}°F`;
            break;
        case 'HVAC':
            const mode = payload?.['operating mode definition'] ?? 'N/A';
            const fan = payload?.['fan speed'] ?? 'N/A';
            formattedStatus = `Mode: ${mode}, Fan: ${fan}%`;
            break;
        default:
            formattedStatus = formatStatus(payload); // Fallback
    }
    const statusTooltip = JSON.stringify(payload, null, 2); // Full payload for tooltip

    if (isNew) {
        // Create card if it doesn't exist
        card = document.createElement('div');
        card.id = cardId;
        card.className = 'device-card';

        card.innerHTML = `
            <div class="device-card-header">
                <div class="device-card-title">${friendlyName}</div>
                <div class="device-card-type">${deviceType}</div>
            </div>
            <div class="device-card-status" title="${escapeHtml(statusTooltip)}">${formattedStatus}</div>
            <div class="device-card-actions"></div>
        `;
        
        const cardActions = card.querySelector('.device-card-actions');
        const buttons = createActionButtons(deviceId, deviceType); // Regenerate
        if (buttons) { // Only append if buttons were created
             cardActions.appendChild(buttons);
        } else {
            cardActions.textContent = 'No actions available.'; // Placeholder
        }
        
        cardView.appendChild(card);
        // Add the card element reference to our global store
        if (allDevices.has(deviceId)) { // Ensure device exists in map
            allDevices.get(deviceId).cardElement = card;
        }
    } else {
        // Update existing card content
        const cardTitle = card.querySelector('.device-card-title');
        const cardType = card.querySelector('.device-card-type');
        const statusElement = card.querySelector('.device-card-status');
        const actionsContainer = card.querySelector('.device-card-actions');

        if (cardTitle.textContent !== friendlyName) cardTitle.textContent = friendlyName;
        if (cardType.textContent !== deviceType) cardType.textContent = deviceType;
        statusElement.textContent = formattedStatus;
        statusElement.title = escapeHtml(statusTooltip);

        // Update/recreate action buttons if necessary (e.g., if type changed or actions depend on status)
        actionsContainer.innerHTML = ''; // Clear existing buttons
        const buttons = createActionButtons(deviceId, deviceType); // Regenerate
        if (buttons) { // Only append if buttons were created
             actionsContainer.appendChild(buttons);
        } else {
            actionsContainer.textContent = 'No actions available.'; // Placeholder
        }
    }

    // Hide or show card based on the current filter
    card.style.display = matchesFilter(deviceId, deviceType) ? '' : 'none';
}

// Function to get the friendly name
function getFriendlyName(deviceId, deviceType) { // Pass deviceType for context
    console.log(`[getFriendlyName] Input - deviceId: ${deviceId}, deviceType: ${deviceType}`); // DEBUG
    
    // Attempt to construct the key format used in device_names.js (e.g., DC_DIMMER_COMMAND_2_27)
    // This assumes the instance number is the link.
    const parts = deviceId.split('/');
    const instanceStr = parts.pop(); // Get the last part (instance number)
    let key = null;

    // Try constructing the key ONLY if it looks like a dimmer status/command
    if (deviceType && (deviceType.startsWith('DC_DIMMER_COMMAND') || deviceType.startsWith('DC_DIMMER_STATUS'))) {
        // Use the known command base key format from device_names.js
        key = `DC_DIMMER_COMMAND_2_${instanceStr}`;
        console.log(`[getFriendlyName] Constructed Key: ${key}`); // DEBUG
    }

    const directName = deviceNameMapping[deviceId];
    const keyName = key ? deviceNameMapping[key] : undefined;

    console.log(`[getFriendlyName] Lookups - Direct: '${directName}', Key-Based: '${keyName}'`); // DEBUG

    const result = directName || keyName || deviceId; // Prioritize direct, then key, fallback to ID
    console.log(`[getFriendlyName] Result: '${result}'`); // DEBUG
    return result;
}

// Function to create action buttons based on device type
function createActionButtons(deviceId, deviceType) {
    const container = document.createElement('div');
    container.dataset.deviceId = deviceId; // Store for potential updates
    container.dataset.deviceType = deviceType;

    // Add buttons based on deviceType
    if (deviceType === 'DC_DIMMER') { // Use the derived type
        const button = document.createElement('button');
        button.textContent = 'Set Brightness';
        button.onclick = () => selectDeviceForControl(deviceId, 'DC_DIMMER_COMMAND'); // Match type used in modal logic
        container.appendChild(button);
    } else if (deviceType === 'HVAC') {
        // Add HVAC control buttons if needed
    } else if (deviceType === 'WATERHEATER') {
        // Add Water Heater control buttons if needed
    } else {
        // Default or no actions
        // container.textContent = 'No actions available';
    }
    return container || null; // Return null if no buttons were added
}

// Function called when clicking a control button on a device
// Updated to handle different device types - currently only Dimmer modal
export function selectDeviceForControl(deviceId, deviceType) {
    console.log(`UI: Selecting device for control: ID=${deviceId}, Type=${deviceType}`);
    const displayName = deviceNameMapping[deviceId] || deviceId; // Get friendly name

    // Open specific control UI based on type
    if (deviceType === 'DC_DIMMER_COMMAND') { 
        openControlModal(deviceId, displayName);
    } else {
        // Handle other device types here if needed in the future
        alert(`Controls for device type ${deviceType} (ID: ${deviceId}) are not yet implemented.`);
    }
}

// --- Modal Functions --- //

let deviceControlModal;
let modalDeviceIdInput;
let modalDeviceNameElement;
let brightnessSlider;
let brightnessValueSpan;

// Function to open the dimmer control modal
export function openControlModal(deviceId, displayName) {
    if (!deviceControlModal) {
        console.error('UI: Dimmer control modal not found!');
        return;
    }
    console.log(`UI: Opening modal for ${displayName} (${deviceId})`);
    modalDeviceNameElement.textContent = displayName;
    modalDeviceIdInput.value = deviceId; // Store the device ID
    // TODO: Optionally fetch current brightness state and set slider
    brightnessSlider.value = 50; // Default to 50%
    brightnessValueSpan.textContent = '50';
    deviceControlModal.classList.remove('hidden');
}

// Function to close the dimmer control modal
export function closeControlModal() {
    if (!deviceControlModal) return;
    deviceControlModal.classList.add('hidden');
}

// Function to send dimmer command via MQTT
export function sendDimmerCommand(commandCode) {
    if (!modalDeviceIdInput || !window.mqttClient) {
        console.error('UI: Cannot send command - Modal elements or MQTT client missing.');
        return;
    }
    
    const deviceId = modalDeviceIdInput.value; // e.g., DC_DIMMER_COMMAND_2_25
    const brightness = brightnessSlider.value;
    
    // Extract instance from the deviceId
    const instanceMatch = deviceId.match(/_(\d+)$/);
    if (!instanceMatch) {
        console.error(`UI: Could not extract instance from deviceId: ${deviceId}`);
        return;
    }
    const instance = instanceMatch[1];
    
    const topic = `RVC/DC_DIMMER_COMMAND_2/${instance}/set`;
    
    let payload = {
        command: commandCode
        // Optionally add duration/delay based on commandCode if needed
    };

    // Add brightness only if the command requires it (e.g., Set Brightness = 0)
    if (commandCode === 0) { 
        payload.brightness = parseInt(brightness, 10);
    }

    const payloadString = JSON.stringify(payload);

    console.log(`[sendDimmerCommand] Target Device ID (from modal): ${deviceId}`);
    console.log(`[sendDimmerCommand] Instance Extracted: ${instance}`);
    console.log(`[sendDimmerCommand] Publishing to Topic: ${topic}`);
    console.log(`[sendDimmerCommand] Publishing Payload: ${payloadString}`);

    console.log(`Sending MQTT Command - Topic: ${topic}, Payload: ${payloadString}`);
 
    // Publish the command
    window.mqttClient.publish(topic, payloadString, { qos: 1 }, (err) => {
        if (err) {
            console.error('UI: MQTT publish error:', err);
            // Optionally display error to user
        } else {
            console.log('UI: Dimmer command published successfully.');
            // Optionally give user feedback
            // Maybe close modal after certain commands?
            // closeControlModal(); 
        }
    });
}

// --- Utility Functions --- //

// Helper function to escape HTML characters for setting tooltips safely
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// Function to format status (fallback for unknown types)
function formatStatus(payload) {
    if (typeof payload === 'object' && payload !== null) {
        if (payload.rawValue !== undefined) {
            return String(payload.rawValue);
        } 
        // Simple formatting for objects: list key-value pairs
        // return Object.entries(payload).map(([key, value]) => `${key}: ${value}`).join(', ');
        return "State updated" // Generic message
    } else {
        return String(payload); // Convert non-objects/null to string
    }
}

// Function to switch between table and card views
function switchView(view) {
    currentView = view;
    if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
    if (cardView) cardView.style.display = view === 'cards' ? 'block' : 'none';
    applyFilter(currentFilter); // Re-apply filter to the newly visible view if elements exist
}

// Function to apply filter
function applyFilter(filterType) {
    currentFilter = filterType;
    console.log(`UI: Applying filter: ${currentFilter}`);

    // Iterate through table rows
    document.querySelectorAll('#deviceTableBody tr').forEach(row => {
        const deviceId = row.id.replace('row-', '');
        const deviceData = allDevices.get(deviceId);
        row.style.display = deviceData && matchesFilter(deviceId, deviceData.deviceType) ? '' : 'none';
    });

    // Iterate through device cards
    document.querySelectorAll('#cardView .device-card').forEach(card => {
        const deviceId = card.id.replace('card-', '');
        const deviceData = allDevices.get(deviceId);
        card.style.display = deviceData && matchesFilter(deviceId, deviceData.deviceType) ? '' : 'none';
    });
}

// Function to check if a device matches the current filter
function matchesFilter(deviceId, deviceType) {
    const prefix = 'RVC/DC_DIMMER_STATUS_3/';
    const match = deviceId.startsWith(prefix);
    if (!match) return false; // Not a dimmer status topic

    const instanceStr = deviceId.substring(prefix.length);
    const instance = parseInt(instanceStr, 10);
    const isLight = !isNaN(instance) && instance >= 25 && instance <= 60;

    console.log(`[matchesFilter-TEMP] ID: ${deviceId}, IsDimmer: ${match}, Instance: ${instance}, IsLight: ${isLight}`); // DEBUG

    return isLight;
}

// --- Initialization on DOMContentLoaded --- //

document.addEventListener('DOMContentLoaded', () => {
    console.log('UI: DOM fully loaded and parsed');
    
    // Cache essential UI elements
    deviceTableBody = document.getElementById('deviceTableBody');
    cardView = document.getElementById('cardView');
    tableView = document.getElementById('tableView'); // Get the table container
    connectionStatusText = document.getElementById('connectionStatusText');
    initialStatusRow = document.getElementById('initialStatusRow');
    deviceControlModal = document.getElementById('deviceControlModal');
    modalDeviceIdInput = document.getElementById('modalDeviceId');
    modalDeviceNameElement = document.getElementById('modalDeviceName');
    brightnessSlider = document.getElementById('brightnessSlider');
    brightnessValueSpan = document.getElementById('brightnessValue');

    // Validate that crucial elements exist
    if (!deviceTableBody) {
        console.error("UI Error: Element with ID 'deviceTableBody' not found.");
    }
    if (!cardView) {
        console.error("UI Error: Element with ID 'cardView' not found.");
    }
    if (!tableView) {
        console.error("UI Error: Element with ID 'tableView' not found.");
    }
    if (!connectionStatusText) {
        console.error("UI Error: Element with ID 'connectionStatusText' not found.");
    }
    if (!initialStatusRow) {
        console.warn("UI Init: initialStatusRow not found (maybe removed early?)");
    }
    if (!deviceControlModal) {
        console.error("UI Error: Element with ID 'deviceControlModal' not found.");
    }

    // Event Listeners for Toggles
    document.querySelectorAll('.view-toggle').forEach(button => {
        button.addEventListener('click', (event) => switchView(event.target.dataset.view));
    });

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', (event) => applyFilter(event.target.id.replace('filter', '').replace('Btn', '').toLowerCase()));
    });

    // Initial setup
    if (tableView && cardView) { // Only switch view if elements exist
        switchView('table'); // Default to table view
    }
    updateConnectionStatus('initializing');
    applyFilter(currentFilter); // Apply default filter initially

    // Start the status update interval
    if (!statusUpdateTimeout) {
        statusUpdateTimeout = setInterval(checkMqttConnection, 3000); // Check every 3 seconds
    }

    console.log("UI: Initialization complete.");
});