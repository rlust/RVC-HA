import { deviceNameMapping } from './device_names.js';

// Global state for UI elements and device data
let deviceTableBody;
let cardView;
let connectionStatusText; // Reference to the connection status element
let initialStatusRow; // Reference to the initial "Connecting..." row
let firstMessageReceived = false;
let queuedUpdates = []; // Queue for updates before UI is ready
const deviceStates = new Map(); // Central store for latest device states

// Exported function to update the device table in the UI
// Now accepts deviceId directly from main.js
export function updateTable(deviceId, payload) {
    // If UI elements aren't ready yet, queue the update
    if (!deviceTableBody || !cardView || !document.body.contains(deviceTableBody)) {
        console.log(`UI: updateTable - Queueing update for ${deviceId} as UI not fully ready.`);
        queuedUpdates.push({ deviceId, payload });
        return;
    }

    // Determine Device Type from the unified deviceId
    let deviceType = 'Unknown';
    if (deviceId.startsWith('DC_DIMMER_COMMAND_2_')) {
        deviceType = 'DC_DIMMER';
    } else if (deviceId.startsWith('WATERHEATER_STATUS_')) {
        deviceType = 'WATERHEATER';
    } else if (deviceId.startsWith('AIR_CONDITIONER_STATUS_')) {
        deviceType = 'HVAC';
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

    // Use the deviceId itself for display name lookup and state storage
    const lookupId = deviceId;

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
    deviceStates.set(lookupId, parsedPayload);

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

    let row = document.getElementById(`device-${lookupId}`);
    if (!row) {
        // Create new row
        row = deviceTableBody.insertRow();
        row.id = `device-${lookupId}`;

        const cellId = row.insertCell(0);
        const cellType = row.insertCell(1);
        const cellStatus = row.insertCell(2);
        const cellActions = row.insertCell(3);

        cellId.textContent = deviceNameMapping[lookupId] || lookupId; // Use lookupId as fallback
        cellType.textContent = deviceType;
        cellStatus.textContent = formattedStatus;
        cellStatus.title = statusTooltip;
        cellActions.appendChild(createActionButtons(lookupId, deviceType)); // Pass lookup ID and type
    } else {
        // Update existing row
        const cellType = row.cells[1];
        const cellStatus = row.cells[2];
        const cellActions = row.cells[3];

        if (cellType.textContent !== deviceType) cellType.textContent = deviceType;
        cellStatus.textContent = formattedStatus;
        cellStatus.title = statusTooltip;

        // Update action buttons if needed (e.g., if type changed)
        cellActions.replaceChild(createActionButtons(lookupId, deviceType), cellActions.firstChild);
    }

    // Update card view - Pass unified ID, payload, and derived type
    updateCardView(lookupId, parsedPayload, deviceType);
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
    if (!cardView || !document.body.contains(cardView)) return; // Exit if container is missing or not attached

    const displayName = deviceNameMapping[deviceId] || deviceId; // Use deviceId as fallback

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

// Function to format status (fallback for unknown types)
function formatStatus(payload) {
    if (typeof payload === 'object' && payload !== null) {
        return JSON.stringify(payload);
    } else if (payload !== undefined && payload !== null) {
        return String(payload);
    } else {
        return 'N/A';
    }
}

// Helper function to create action buttons
function createActionButtons(deviceId, deviceType) {
    const container = document.createElement('div');
    container.className = 'action-buttons';

    // Always add a refresh button (optional, could publish a request)
    // const refreshButton = document.createElement('button');
    // refreshButton.textContent = 'Refresh';
    // refreshButton.onclick = () => publishCommand(deviceId, { action: 'query_state' });
    // container.appendChild(refreshButton);

    // Add type-specific controls
    if (deviceType === 'DC_DIMMER') {
        const setBrightnessButton = document.createElement('button');
        setBrightnessButton.textContent = 'Set Brightness';
        setBrightnessButton.onclick = () => selectDeviceForControl(deviceId, 'DC_DIMMER_COMMAND'); // Match type expected by modal
        container.appendChild(setBrightnessButton);
    }
    // Add buttons for other device types here (e.g., HVAC mode set)

    return container;
}

// Function called when a device control button is clicked
// Updated to handle specific device types
function selectDeviceForControl(deviceId, deviceType) {
    const displayName = deviceNameMapping[deviceId] || deviceId;
    console.log(`UI: Selecting device for control: ${deviceId} (${displayName}), Type: ${deviceType}`);

    if (deviceType === 'DC_DIMMER_COMMAND') { // Check for the command type
        openControlModal(deviceId, displayName);
    } else {
        console.warn(`UI: No specific control UI defined for device type: ${deviceType}`);
        // Optionally show a generic control modal or info
    }
}

// Helper function to escape HTML characters for tooltips/attributes
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

 // --- Modal Dialog Logic ---
const modal = document.getElementById('deviceControlModal');
const modalTitle = document.getElementById('modalDeviceName');
const modalDeviceId = document.getElementById('modalDeviceId');
const brightnessSlider = document.getElementById('brightnessSlider');
const brightnessValueSpan = document.getElementById('brightnessValue');

function openControlModal(deviceId, displayName) {
    if (!modal || !modalTitle || !modalDeviceId || !brightnessSlider || !brightnessValueSpan) {
        console.error("Modal elements not found!");
        return;
    }
    modalTitle.textContent = displayName;
    modalDeviceId.value = deviceId; // Store the full device ID
    
    // Fetch current brightness from deviceStates if available
    const currentState = deviceStates.get(deviceId);
    const currentBrightness = currentState?.["operating status (brightness)"] ?? 50; // Default to 50% if unknown
    brightnessSlider.value = currentBrightness;
    brightnessValueSpan.textContent = `${currentBrightness}%`;

    modal.classList.remove('hidden');
}

function closeControlModal() {
    if (modal) {
        modal.classList.add('hidden');
    }
}

function sendDimmerCommand(commandCode) {
    if (!window.mqttClient) {
        console.error("MQTT client not available for sending command.");
        return;
    }
    if (!modalDeviceId || !brightnessSlider) {
        console.error("Cannot send command: Modal elements missing.");
        return;
    }

    const deviceId = modalDeviceId.value; // e.g., DC_DIMMER_COMMAND_2_0
    const instanceMatch = deviceId.match(/_(\d+)$/);
    if (!instanceMatch) {
        console.error(`Could not extract instance from deviceId: ${deviceId}`);
        return;
    }
    const instance = instanceMatch[1];
    const topic = `RVC/DC_DIMMER_COMMAND_2/${instance}/set`; // Construct topic

    let payload = { command: commandCode, instance: parseInt(instance, 10) };

    if (commandCode === 'SET_BRIGHTNESS') {
        payload.brightness = parseInt(brightnessSlider.value, 10);
    }

    console.log(`UI: Publishing to ${topic}:`, JSON.stringify(payload));
    window.mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
            console.error('Publish error:', err);
        } else {
            console.log('Dimmer command published successfully');
            // Optionally close modal after successful command
            // closeControlModal(); 
        }
    });
}


// Event Listeners (ensure these run after DOM is loaded)
document.addEventListener('DOMContentLoaded', () => {
    // Re-select elements here to ensure they exist
    deviceTableBody = document.getElementById('deviceTableBody');
    cardView = document.getElementById('cardView');
    connectionStatusText = document.getElementById('connectionStatusText'); // Assign here
    initialStatusRow = document.getElementById('initialStatusRow');

    if (!deviceTableBody) console.error("UI: deviceTableBody not found on DOMContentLoaded!");
    if (!cardView) console.error("UI: cardView not found on DOMContentLoaded!");
    if (!connectionStatusText) console.error("UI: connectionStatusText not found on DOMContentLoaded!");
    if (!initialStatusRow) console.error("UI: initialStatusRow not found on DOMContentLoaded!");

    const localModal = document.getElementById('deviceControlModal');
    const localBrightnessSlider = document.getElementById('brightnessSlider');
    const localBrightnessValueSpan = document.getElementById('brightnessValue');

    if (localModal) {
        const closeButton = localModal.querySelector('.close-button');
        if (closeButton) {
            closeButton.onclick = closeControlModal;
        }
        window.onclick = (event) => {
            if (event.target == localModal) {
                closeControlModal();
            }
        };
    }

    if (localBrightnessSlider && localBrightnessValueSpan) {
        localBrightnessSlider.oninput = function() {
            localBrightnessValueSpan.textContent = `${this.value}%`;
        }
    } else {
        console.warn("Brightness slider or value span not found on DOMContentLoaded");
    }

    // Add event listeners for modal command buttons
    const setBrightnessBtn = document.getElementById('setBrightnessBtn');
    const rampUpBtn = document.getElementById('rampUpBtn');
    const rampDownBtn = document.getElementById('rampDownBtn');
    const toggleBtn = document.getElementById('toggleBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (setBrightnessBtn) setBrightnessBtn.onclick = () => sendDimmerCommand('SET_BRIGHTNESS');
    if (rampUpBtn) rampUpBtn.onclick = () => sendDimmerCommand('RAMP_UP');
    if (rampDownBtn) rampDownBtn.onclick = () => sendDimmerCommand('RAMP_DOWN');
    if (toggleBtn) toggleBtn.onclick = () => sendDimmerCommand('TOGGLE');
    if (stopBtn) stopBtn.onclick = () => sendDimmerCommand('STOP_RAMP');

});

// Make necessary functions globally available if called directly from HTML onclick
// Consider refactoring to use event listeners attached in JS instead
window.selectDeviceForControl = selectDeviceForControl;
window.closeControlModal = closeControlModal;
window.sendDimmerCommand = sendDimmerCommand;