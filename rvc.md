# Product Requirements Document (PRD): RV-C MQTT Control Application with Home Assistant Integration

## 1. Overview

### 1.1 Product Name
RV-C MQTT Control Application with Home Assistant Integration

### 1.2 Purpose
The RV-C MQTT Control Application is a web-based tool designed to monitor and control RV-C devices (dimmers, vents, temperature sensors, HVAC systems) on a CAN bus network in recreational vehicles (RVs). Integrated with Home Assistant, it provides a mobile-friendly interface, real-time data visualization, logging, notifications, and secure access, enhancing RV management through MQTT messaging.

### 1.3 Objectives
- Enable RV owners to control and monitor RV-C devices via a single interface.
- Integrate seamlessly with Home Assistant for automation and notifications.
- Provide a mobile-friendly, visually appealing UI with data insights.
- Ensure secure, easy deployment for a single RV setup.

### 1.4 Target Audience
- RV owners seeking centralized control of RV-C devices.
- Home Assistant users interested in RV automation.

---

## 2. Requirements

### 2.1 Functional Requirements

#### 2.1.1 Device Support and Control
- **Supported Devices**:
  - **Dimmers**: Control brightness (0-100) and power (on/off).
  - **Vents**: Control speed (0-100) and power (on/off).
  - **Temperature Sensors**: Display ambient temperature readings.
  - **HVAC Systems**: Set target temperature and mode (AC/Heat).
- **Control Options**: 
  - Sliders for brightness/speed/setpoint, toggle/select for power/mode.

#### 2.1.2 User Interface
- **Mobile-Friendly Design**: Responsive layout for phone use.
- **Device Dashboard**: Table displaying Device ID, Type, Status, Last Updated.
- **Temperature Graph**: Line chart showing 24-hour temperature trends from sensors.

#### 2.1.3 Home Assistant Integration
- **Device Sync**: Send/receive states for all supported devices.
- **Automations**: Support Home Assistant automations (e.g., “turn on vent if temp > 80°F”).
- **Notifications**: Alert via Home Assistant for:
  - Temperature exceeding 85°F.
  - Device unresponsive for over 60 seconds.

#### 2.1.4 Data Management and Logging
- **Logging**: Store device states for 7 days in SQLite.
- **CSV Export**: Download logs with timestamps and status changes.
- **Spreadsheet Export**: Export current device states to Excel.

#### 2.1.5 Security
- **Authentication**: Basic login (username: `admin`, password: `rvpass`).

#### 2.1.6 Deployment
- **Docker Support**: Deploy backend, MQTT broker, and Home Assistant via Docker Compose.

### 2.2 Non-Functional Requirements
- **Performance**: Real-time updates every 5 seconds for up to 10 devices.
- **Reliability**: Handle MQTT connection drops with reconnection logic.
- **Scalability**: Designed for one RV, extensible via configuration.
- **Usability**: Intuitive controls, no advanced configuration required in-app.

---

## 3. System Architecture

### 3.1 Components
- **Frontend**: Mobile-friendly SPA (HTML/CSS/JS).
- **Backend**: Node.js with Express.js, MQTT, SQLite.
- **MQTT Server**: Mosquitto broker.
- **Home Assistant**: Automation and notification platform.
- **CAN Bus Interface**: CAN-to-MQTT gateway.
- **RV-C Devices**: Dimmers, vents, sensors, HVAC.

### 3.2 Architecture Diagram
---

## 4. Technical Specifications

### 4.1 Backend
- **Stack**: Node.js, Express.js, `mqtt`, `express-basic-auth`, `sqlite3`.
- **MQTT Topics**:
  - RV-C: `rvc/status/<deviceId>`, `rvc/command/<deviceId>`.
  - Home Assistant: `homeassistant/<type>/<deviceId>/{config,state,command}`.
- **Endpoints**:
  - `GET /devices`: List device states (authenticated).
  - `POST /command`: Send RV-C commands (authenticated).
  - `GET /logs`: Export 7-day CSV log.
- **Logging**: SQLite table: `logs (deviceId, type, status, timestamp)`.

### 4.2 Frontend
- **Stack**: HTML/CSS/JS, `Paho MQTT`, `Chart.js`, `SheetJS`.
- **Features**:
  - Responsive table and controls.
  - Temperature line chart (24-hour window).
  - Excel export (`RV_C_Device_Status.xlsx`).
- **Styling**: Light blue background (`#e6f2ff`), dark blue headers (`#336699`), hover effects.

### 4.3 Home Assistant Integration
- **MQTT Discovery**: Auto-register devices (light, fan, sensor, climate).
- **Automations**: User-defined in Home Assistant (e.g., vent on at 80°F).
- **Notifications**: Published to `homeassistant/notify`.

### 4.4 Deployment
- **Docker Compose**:
  - Mosquitto: Ports 1883, 9001.
  - Backend: Port 3000.
  - Home Assistant: Port 8123.

---

## 5. User Stories

1. **As an RV owner**, I want to control my dimmers, vents, and HVAC from my phone, so I can adjust settings on the go.
2. **As a user**, I want to see temperature trends, so I can monitor RV climate conditions.
3. **As a Home Assistant user**, I want automations like vent activation at 80°F, so my RV stays comfortable automatically.
4. **As an RV owner**, I want logs and exports, so I can troubleshoot issues over a week.
5. **As a security-conscious user**, I want a login, so only I can access my RV controls.

---

## 6. Acceptance Criteria

- **Device Control**: Users can adjust dimmers, vents, and HVAC via sliders and toggles; changes reflect in Home Assistant.
- **UI**: App is usable on mobile (600px width); temperature graph updates in real-time.
- **Home Assistant**: Devices appear in Home Assistant; notifications trigger at 85°F or 60s unresponsiveness.
- **Logging**: CSV export contains 7 days of data with timestamps.
- **Security**: Access requires correct username/password.
- **Deployment**: Docker Compose launches all components successfully.

---

## 7. Implementation Plan

### 7.1 Milestones
1. **Backend Setup**: Implement MQTT, device support, logging, and authentication (1 week).
2. **Frontend Development**: Build mobile UI, controls, and graph (1 week).
3. **Home Assistant Integration**: Configure MQTT Discovery and notifications (3 days).
4. **Testing**: Verify functionality, responsiveness, and deployment (2 days).
5. **Deployment**: Package in Docker Compose (1 day).

### 7.2 Dependencies
- **Hardware**: RV with CAN bus, CAN-to-MQTT gateway.
- **Software**: Docker, Node.js, Mosquitto, Home Assistant.

### 7.3 Deployment Steps
1. Configure CAN-to-MQTT gateway.
2. Create `docker-compose.yml` and `mosquitto.conf`.
3. Build and run containers (`docker-compose up --build`).
4. Open `index.html` in a browser with updated URLs.

---

## 8. Risks and Mitigation

- **Risk**: CAN bus compatibility issues.  
  - **Mitigation**: Test with common RV-C devices; use configurable gateway scripts.
- **Risk**: MQTT connection drops.  
  - **Mitigation**: Add reconnection logic in backend.
- **Risk**: Mobile UI usability issues.  
  - **Mitigation**: Test on multiple screen sizes; refine CSS.

---

## 9. Future Enhancements
- Multi-RV support via unique MQTT topics.
- Cloud hosting for remote access.
- Integration with weather APIs for external context.

---

## 10. Appendix

### 10.1 Sample MQTT Payloads
- **Dimmer State**: `{"type": "DC_DIMMER", "brightness": 50, "on": true}`
- **HVAC Command**: `{"setpoint": 68, "mode": "cool"}`
- **Notification**: `{"message": "Temperature exceeds 85°F: 87"}`

### 10.2 Docker Compose Example
```yaml
version: '3'
services:
  mosquitto:
    image: eclipse-mosquitto
    ports:
      - "1883:1883"
      - "9001:9001"
  backend:
    build: .
    ports:
      - "3000:3000"
  homeassistant:
    image: homeassistant/home-assistant
    ports:
      - "8123:8123"