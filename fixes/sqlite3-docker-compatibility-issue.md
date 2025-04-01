# SQLite3 Docker Compatibility Issue

## Problem Description

When attempting to run the RV-C MQTT Control Application in a Docker container, we encountered an error with the SQLite3 module:

```bash
Error: Error loading shared library /app/node_modules/sqlite3/build/Release/node_sqlite3.node: Exec format error
```

This error occurred because the SQLite3 binary was compiled for a different architecture than what was running in the Docker container. The pre-built SQLite3 binary included in the npm package was not compatible with the Alpine Linux environment in our Node.js Docker container.

## Solution

We implemented a two-part solution to resolve this issue:

1. **Temporarily removed SQLite3 dependency usage**:
   - Commented out the SQLite3 import in `server.js` since it's not actively used in the current implementation
   - Added a comment indicating that SQLite3 will be implemented in a future task

2. **Modified package.json and Docker configuration**:
   - Moved SQLite3 from `dependencies` to `optionalDependencies` in `package.json`
   - Updated the Dockerfile to use `--no-optional` flag when installing dependencies
   - This prevents npm from attempting to install the SQLite3 package in the Docker container

## Future Considerations

When implementing the database functionality in future tasks, we'll need to:

1. Either properly rebuild SQLite3 for Alpine Linux by adding necessary build tools
2. Or consider using a different database solution that's more compatible with Docker containers, such as:
   - Better-SQLite3 (more compatible with Docker)
   - PostgreSQL with a Docker service
   - MySQL/MariaDB with a Docker service

## Related Files Modified

- `/backend/server.js` - Commented out SQLite3 import
- `/backend/package.json` - Moved SQLite3 to optionalDependencies
- `/backend/Dockerfile` - Added --no-optional flag to npm install
