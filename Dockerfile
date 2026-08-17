FROM node:18-slim

# Install Chromium and required font dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy application files
COPY . .

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV CHROME_PATH=/usr/bin/chromium

# Expose server port
EXPOSE 3000

# Start REST API server
CMD ["node", "tt.js", "api", "3000"]
