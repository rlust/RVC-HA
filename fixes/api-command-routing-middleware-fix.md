# Issue: API Command Endpoint Not Reached / Missing deviceType Error

## Problem Description

Attempts to send commands via the `/command` POST endpoint resulted in a `{"error":"Missing deviceType"}` response. Debug logs revealed that the request was not reaching the route handler defined in `routes/devices.js`, and therefore the `deviceType` was not being added to the payload before being passed to the `handleCommand` function.

Further investigation showed that even basic middleware (like authentication checks) was not reliably logging for the `/command` path, suggesting a fundamental issue with middleware ordering or route registration.

Initial attempts to reorder middleware and route `require` statements in `server.js` led to initialization errors (`ReferenceError: Cannot access 'db' before initialization`) because routes depended on variables initialized later in the file.

A persistent `EADDRINUSE` error for port 3002 also complicated debugging, eventually traced to a Docker service using the port. The application port was changed to 3003.

## Solution

The root cause was determined to be the original structure in `server.js` where route setup functions were required and immediately invoked *before* global middleware (like authentication) was applied. This likely interfered with Express's internal routing and middleware chain setup.

The solution involved refactoring the application structure to follow a more standard Express pattern:

1.  **Refactored Route Files (`routes/api.js`, `routes/devices.js`):**
    *   Changed from exporting a setup function (`module.exports = function(app, ...){ ... }`) to using `express.Router()`.
    *   Defined routes directly on the `router` object (e.g., `router.post('/command', ...)`).
    *   Exported the `router` instance (`module.exports = router;`).
    *   Accessed shared dependencies (like `db`, `devices`, `handleCommand`) via `req.app.locals` within the route handlers, using small middleware within each router file to attach them to the `req` object.

2.  **Refactored `server.js`:**
    *   Initialized all core components (db, devices map, mqtt client, helper functions like `handleCommand`, `logEvent`) first.
    *   Attached these core components and necessary variables to `app.locals` (e.g., `app.locals.db = db;`).
    *   Applied global middleware (like the debug logger and the global basic authentication middleware) *after* initialization but *before* mounting routes.
    *   Mounted the routers using `app.use()` *after* all initializations and middleware definitions (e.g., `app.use('/api', require('./routes/api'));`, `app.use('/', require('./routes/devices'));`).

3.  **Changed Port:** Changed the default application port from 3002 to 3003 to avoid the conflict with Docker.
4.  **Explicit Port Start:** Ensured the server was started using `PORT=3003 node server.js` to definitively use the correct port.

This new structure ensures that middleware is applied correctly before the routers handle the requests, and dependencies are safely shared via `app.locals`. The `/command` endpoint now receives requests properly, adds the `deviceType`, calls `handleCommand` successfully, and returns the correct response.
