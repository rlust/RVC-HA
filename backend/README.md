# RV-C MQTT Control Application Backend

This is the backend server for the RV-C MQTT Control Application with Home Assistant Integration.

## Setup

1. Copy `.env.example` to `.env` and update the values as needed:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

   For development with auto-restart:

   ```bash
   npm run dev
   ```

## Dependencies

- Express.js: Web server framework
- MQTT: For communication with RV-C devices and Home Assistant
- SQLite3: For data logging and persistence
- Express Basic Auth: For simple authentication

## API Endpoints

- `GET /devices`: List all devices and their current states
- `POST /command`: Send commands to RV-C devices
- `GET /logs`: Export device logs as CSV

## Docker Deployment

The application can be deployed using Docker Compose. See the main project README for deployment instructions.
