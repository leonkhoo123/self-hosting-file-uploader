# Use the smallest official Node.js Alpine image as base
FROM node:18-alpine

# Install only the necessary package (smbclient) without extra dependencies
RUN apk add --no-cache samba-client && rm -rf /var/cache/apk/*

# Set working directory in the container
WORKDIR /app

# Copy only package.json for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --no-audit --no-fund

# Copy the rest of the application code
COPY . .

# Remove unnecessary files (node_modules cache, etc.) to save space
RUN npm prune --production

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
