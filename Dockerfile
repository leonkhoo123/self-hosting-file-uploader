# Use the smallest official Node.js Alpine image as base
FROM node:18-alpine

# Install necessary packages (smbclient) without extra dependencies
# RUN apk add --no-cache samba-client && rm -rf /var/cache/apk/*

# Set working directory to the project root
WORKDIR /app

# Copy only package.json for better caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --no-audit --no-fund

# Copy all files to the container
COPY . .

# Install PM2 globally
RUN npm install -g pm2

# Expose ports
EXPOSE 3000
EXPOSE 3001

# Start both server.js and generator.js using PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
