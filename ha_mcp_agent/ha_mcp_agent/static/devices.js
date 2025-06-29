// static/devices.js

async function fetchDevices() {
  const res = await fetch('/api/devices/');
  if (!res.ok) throw new Error('Failed to fetch devices');
  return await res.json();
}

function renderDeviceList(devices) {
  const list = document.getElementById('deviceList');
  list.innerHTML = '';
  // Group devices by type
  const grouped = devices.reduce((acc, d) => {
    acc[d.type] = acc[d.type] || [];
    acc[d.type].push(d);
    return acc;
  }, {});
  Object.entries(grouped).forEach(([type, devs]) => {
    const section = document.createElement('div');
    section.className = 'mb-8';
    section.innerHTML = `<div class="text-xl font-bold mb-3 text-${type === 'light' ? 'yellow' : type === 'switch' ? 'blue' : 'purple'}-600 capitalize pl-1">${type}s</div>`;
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 gap-6';
    devs.forEach(device => {
      const card = document.createElement('div');
      card.className = `rounded-xl shadow-lg p-4 flex flex-col gap-2 border-2 ${type === 'light' ? 'border-yellow-300 bg-yellow-50/70' : type === 'switch' ? 'border-blue-300 bg-blue-50/70' : 'border-purple-300 bg-purple-50/70'}`;
      card.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="font-bold text-lg text-${type === 'light' ? 'yellow' : type === 'switch' ? 'blue' : 'purple'}-700">${device.name}</span>
          <span class="ml-auto text-xs text-gray-400">${device.device_id}</span>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm">State: <span id="state-${device.device_id}" class="font-mono">${device.state}</span></span>
          ${renderDeviceControls(device)}
        </div>
        <div class="flex flex-wrap gap-2 text-xs mt-2">
          <span class="bg-gray-200 rounded px-2 py-0.5 text-gray-600">${device.capabilities.join(', ')}</span>
          <span class="bg-gray-100 rounded px-2 py-0.5 text-gray-400">${device.type}</span>
        </div>
      `;
      grid.appendChild(card);
    });
    section.appendChild(grid);
    list.appendChild(section);
  });
}

function renderDeviceControls(device) {
  if (device.type === 'light') {
    const isOn = device.state === 'on';
    let slider = '';
    if (device.capabilities.includes('brightness')) {
      slider = `<input type="range" min="1" max="255" value="${device.state === 'on' && device.brightness != null ? device.brightness : 128}"
        class="slider accent-yellow-500 mx-2" style="width:100px;" 
        oninput="updateBrightnessLabel('${device.device_id}', this.value)" 
        onchange="setBrightness('${device.device_id}', this.value)">
        <span id="brightness-label-${device.device_id}" class="text-xs text-yellow-600">${device.state === 'on' && device.brightness != null ? device.brightness : 128}</span>`;
    }
    return `
      <button onclick="toggleDevice('${device.device_id}', 'light', ${isOn})" class="rounded bg-yellow-500 text-white px-3 py-1 text-xs font-semibold hover:bg-yellow-600 transition">${isOn ? 'Turn Off' : 'Turn On'}</button>
      ${slider}
    `;
  }
  if (device.type === 'switch') {
    const isOn = device.state === 'on';
    return `<button onclick="toggleDevice('${device.device_id}', 'switch', ${isOn})" class="rounded bg-blue-500 text-white px-3 py-1 text-xs font-semibold hover:bg-blue-700 transition">${isOn ? 'Turn Off' : 'Turn On'}</button>`;
  }
  return '';
}

window.updateBrightnessLabel = function(deviceId, value) {
  document.getElementById(`brightness-label-${deviceId}`).textContent = value;
}

window.setBrightness = async function(deviceId, value) {
  const command = {
    domain: 'light',
    service: 'turn_on',
    entity_id: deviceId,
    service_data: { brightness: parseInt(value) }
  };
  await fetch('/api/devices/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  await refreshDeviceStates();
}

async function toggleDevice(deviceId, type, isOn) {
  const command = {
    domain: type,
    service: isOn ? 'turn_off' : 'turn_on',
    entity_id: deviceId
  };
  await fetch('/api/devices/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command)
  });
  await refreshDeviceStates();
}

async function refreshDeviceStates() {
  const devices = await fetchDevices();
  devices.forEach(device => {
    const stateEl = document.getElementById(`state-${device.device_id}`);
    if (stateEl) stateEl.textContent = device.state;
  });
}

async function loadDeviceList() {
  try {
    const devices = await fetchDevices();
    renderDeviceList(devices);
  } catch (e) {
    document.getElementById('deviceList').innerHTML = '<div class="text-red-500">Failed to load devices</div>';
  }
}

// Poll every 5s for live updates
setInterval(refreshDeviceStates, 5000);

document.addEventListener('DOMContentLoaded', loadDeviceList);
