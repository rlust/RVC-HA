# RV-C MQTT Control Application with Home Assistant Integration

## Overview

The RV-C MQTT Control Application is a web-based tool designed to monitor and control RV-C devices (dimmers, vents, temperature sensors, HVAC systems) on a CAN bus network in recreational vehicles (RVs). Integrated with Home Assistant, it provides a mobile-friendly interface, real-time data visualization, logging, notifications, and secure access, enhancing RV management through MQTT messaging.

### Objectives

- Enable RV owners to control and monitor RV-C devices via a single interface
- Integrate seamlessly with Home Assistant for automation and notifications
- Provide a mobile-friendly, visually appealing UI with data insights
- Ensure secure, easy deployment for a single RV setup

### Target Audience

- RV owners seeking centralized control of RV-C devices
- Home Assistant users interested in RV automation

## Features

### Device Support and Control

- **Supported Devices**:
  - **Dimmers**: Control brightness (0-100) and power (on/off)
  - **Vents**: Control speed (0-100) and power (on/off)
  - **Temperature Sensors**: Display ambient temperature readings
  - **HVAC Systems**: Set target temperature and mode (AC/Heat)
- **Control Options**:
  - Sliders for brightness/speed/setpoint, toggle/select for power/mode

### User Interface

- Mobile-friendly responsive design
- Device dashboard with status information
- Temperature graph showing 24-hour trends

### Home Assistant Integration

- Device state synchronization
- Support for Home Assistant automations
- Notifications for temperature thresholds and device status

### Data Management

- 7-day logging in SQLite
- CSV export functionality
- Spreadsheet export for current device states

## System Architecture

### Components

- **Frontend**: Mobile-friendly SPA (HTML/CSS/JS)
- **Backend**: Node.js with Express.js, MQTT, SQLite
- **MQTT Server**: Mosquitto broker
- **Home Assistant**: Automation and notification platform
- **CAN Bus Interface**: CAN-to-MQTT gateway
- **RV-C Devices**: Dimmers, vents, sensors, HVAC

## Technical Specifications

### Backend

- **Stack**: Node.js, Express.js, `mqtt`, `express-basic-auth`, `sqlite3`
- **MQTT Topics**:
  - RV-C: `rvc/status/<deviceId>`, `rvc/command/<deviceId>`
  - Home Assistant: `homeassistant/<type>/<deviceId>/{config,state,command}`
- **Endpoints**:
  - `GET /devices`: List device states (authenticated)
  - `POST /command`: Send RV-C commands (authenticated)
  - `GET /logs`: Export 7-day CSV log

### Frontend

- **Stack**: HTML/CSS/JS, `Paho MQTT`, `Chart.js`, `SheetJS`
- **Features**:
  - Responsive table and controls
  - Temperature line chart (24-hour window)
  - Excel export (`RV_C_Device_Status.xlsx`)

### Deployment

- **Docker Compose**:
  - Mosquitto: Ports 1883, 9001
  - Backend: Port 3000
  - Home Assistant: Port 8123

## Getting Started

### Prerequisites

- RV with CAN bus
- CAN-to-MQTT gateway (e.g., Raspberry Pi with RV-C proxy)
- Docker and Docker Compose

### Deployment Steps

1. Configure CAN-to-MQTT gateway
2. Create `docker-compose.yml` and `mosquitto.conf`
3. Build and run containers (`docker-compose up --build`)
4. Open `index.html` in a browser with updated URLs

## Future Enhancements

- Multi-RV support via unique MQTT topics
- Cloud hosting for remote access
- Integration with weather APIs for external context

## License

This project is licensed under the terms of the included LICENSE file.
