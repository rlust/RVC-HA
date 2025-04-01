FROM node:20-alpine

WORKDIR /app

# Install dependencies for building SQLite3
RUN apk add --no-cache python3 make g++ sqlite sqlite-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose the port
EXPOSE 3002

# Start the application
CMD ["node", "server.js"]
