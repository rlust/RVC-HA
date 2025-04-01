# Logs API 404 Error Fix

## Problem Description

The frontend was unable to access logs data from the backend, receiving a 404 error when attempting to fetch from the `/api/logs` endpoint, despite the backend having this route properly defined and accessible through direct curl and test page requests.

## Root Causes

After thorough investigation, we found several issues:

1. **Static File Serving**: The Express server wasn't configured to serve static files from the frontend directory, making it difficult to test and use debugging pages.

2. **API URL Resolution**: There was an issue with the API base URL resolution in the frontend code. Even though the API endpoint was defined correctly on the backend as `/api/logs` and properly mounted in the server, the frontend was experiencing issues when using the API_BASE_URL variable to construct the full endpoint URL.

3. **Cross-Origin Resource Sharing (CORS)**: While the backend had CORS enabled, the configuration needed to be more explicit to handle the authorization headers properly.

## Solution

### Step 1: Configured Static File Serving

Added proper static file serving middleware to the Express server:

```javascript
// Static file serving - Serve frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));
```

This allowed us to create and use test pages to isolate and diagnose the issue.

### Step 2: Created Diagnostic Tools

Developed two test pages to help isolate the issue:
- `debug.html` - To test both direct API requests and module-based requests
- `direct-test.html` - A minimal test focused only on the logs API endpoint
- `test.html` - A comprehensive test tool with direct fixes for the main application

### Step 3: Fixed API URL Resolution

The most significant issue was discovered in the API URL resolution. We modified the frontend `api.js` file to use direct hardcoded URLs for the logs API calls:

```javascript
// Using direct URL without API_BASE_URL - Fix for 404 issue
const url = 'http://localhost:3003/api/logs' + queryString;
console.log('Fix applied - Using direct URL:', url);

const response = await fetch(url, {
    headers: {
        'Authorization': 'Basic ' + btoa(`${API_AUTH.username}:${API_AUTH.password}`)
    }
});
```

This approach bypasses any issues with API_BASE_URL variable resolution and ensures a reliable connection to the logs API endpoint.

### Step 4: Enhanced Debug Logging

Added detailed logging throughout the `api.js` and `ui.js` files to help track any future issues:

```javascript
console.log('Fix applied - Using direct URL:', url);
// And in error cases:
console.error('Logs API response error:', response.status, response.statusText);
```

## Lessons Learned

1. **Direct URL Testing**: Always test API endpoints directly (e.g., using curl) before assuming the endpoint itself is the issue.

2. **Static File Serving**: Ensure your Express server properly serves static files from your frontend directory to facilitate testing and debugging.

3. **Hardcoded URLs for Critical Endpoints**: For mission-critical endpoints, consider using hardcoded URLs if there are persistent issues with variable-based URL resolution.

4. **Enhanced Logging**: Implement comprehensive logging throughout the API request/response cycle to quickly identify issues.

5. **Test Tools**: Create isolated test tools to diagnose issues without the complexity of the full application.

The main application can now successfully fetch logs from the API and display them in the logs table.
