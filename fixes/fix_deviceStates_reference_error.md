# Fix: ReferenceError: deviceStates is not defined in ui.js

**Date:** 2025-04-01

**Files Affected:**
*   `/Users/randylust/RVC-HA/frontend/js/ui.js`
*   `/Users/randylust/RVC-HA/frontend/js/main.js`

## Problem Description

When running the application, particularly when receiving MQTT messages or during simulation mode initialization, a `ReferenceError: deviceStates is not defined` error occurred within the `updateTable` and `updateCardView` functions in `ui.js`. This prevented the UI from correctly updating device statuses in the table and card views.

The error typically manifested after the `DOMContentLoaded` event fired in `main.js`, which called functions in `ui.js` (like `updateTable` either directly via simulation or indirectly via MQTT message callbacks) that attempted to access or modify the `deviceStates` variable.

## Root Cause

The `deviceStates` variable was intended to be a shared map holding the last known state for each device ID. However, it was not explicitly declared in the scope where `updateTable` and `updateCardView` were defined (`ui.js`). While JavaScript can sometimes implicitly create global variables, relying on this is bad practice and unreliable, especially with modules (`type="module"` in the script tags) which have stricter scoping rules. The functions were trying to access `deviceStates` before it had been properly initialized within the `ui.js` module scope.

## Solution Implemented

The fix involved explicitly declaring `deviceStates` as a `Map` at the top level of the `ui.js` file:

```javascript
// /Users/randylust/RVC-HA/frontend/js/ui.js

// ... other imports or code ...

// Declare deviceStates at the top level to store the latest state for each device
let deviceStates = new Map();

// ... rest of the ui.js code, including updateTable and updateCardView ...

function updateTable(topic, payload) {
    // ... function now correctly accesses the module-scoped deviceStates map ...
    if (deviceStates.has(deviceId)) {
        // ...
    } else {
       // ...
    }
    deviceStates.set(deviceId, state);
    // ...
}

// ... similar access in updateCardView ...
```

By declaring `deviceStates` within the `ui.js` module scope *before* the functions that use it are defined, we ensure that `updateTable` and `updateCardView` have reliable access to the map, resolving the `ReferenceError`. This variable now correctly persists the state information between calls within the UI module.
