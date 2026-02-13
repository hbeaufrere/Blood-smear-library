FROM node:20-slim

# Install libvips for Sharp (image processing)
RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create temp directory for DZI processing
RUN mkdir -p /app/temp_dzi

EXPOSE 3000

# Start the server
CMD ["node", "app.js"]
