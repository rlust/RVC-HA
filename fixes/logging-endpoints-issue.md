# Logging Endpoints Issue

## Problem Description
We encountered issues with the `/api/logs` and `/logs` endpoints not working correctly. Despite implementing the endpoints in the server.js file, requests to these endpoints were returning "Cannot GET /api/logs" and "Not implemented yet" errors respectively.

## Root Cause Analysis
After investigation, we identified several potential issues:

1. **Authentication Middleware Conflict**: The global basic authentication middleware was conflicting with the endpoint-specific authentication.

2. **Route Definition Issues**: The routes were defined correctly but there might be an issue with how Express is handling them.

3. **Debugging Information**: We added debugging middleware to log all incoming requests to help identify if the requests were reaching our route handlers.

## Solution Implemented
We made the following changes to address the issues:

1. Modified the global authentication middleware to skip authentication for the `/logs` and `/api/logs` endpoints:
```javascript
app.use((req, res, next) => {
  // Skip authentication for routes with their own auth
  if (req.path === '/logs' || req.path === '/api/logs') {
    return next();
  }
  
  // Apply basic auth to all other routes
  basicAuth({
    users: { 
      [process.env.ADMIN_USERNAME || 'admin']: process.env.ADMIN_PASSWORD || 'rvpass' 
    },
    challenge: true,
    realm: 'RV-C Control Application'
  })(req, res, next);
});
```

2. Implemented custom authentication logic directly in the route handlers for `/logs` and `/api/logs` to ensure proper authentication:
```javascript
app.get('/api/logs', (req, res) => {
  // Check for basic auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="RV-C MQTT Control Application"');
    return res.status(401).send('Authentication required');
  }
  
  // Decode and verify credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  const validUsername = process.env.ADMIN_USERNAME || 'admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'rvpass';
  
  if (username !== validUsername || password !== validPassword) {
    res.set('WWW-Authenticate', 'Basic realm="RV-C MQTT Control Application"');
    return res.status(401).send('Invalid credentials');
  }
  
  // ... rest of the endpoint implementation
});
```

3. Added debugging middleware to log all incoming requests:
```javascript
app.use((req, res, next) => {
  console.log(`[DEBUG] Request received: ${req.method} ${req.path}`);
  next();
});
```

## Lessons Learned
1. When implementing authentication in Express, be careful about middleware order and potential conflicts between global and route-specific authentication.
2. Adding debugging middleware early in the development process can help identify routing issues more quickly.
3. For critical endpoints, consider implementing custom authentication logic directly in the route handlers to have more control over the authentication process.

## Next Steps
1. Continue monitoring the endpoints to ensure they're working correctly.
2. Add more comprehensive error handling to provide better feedback when issues occur.
3. Consider refactoring the authentication logic into a reusable middleware function to avoid code duplication.
