FROM node:20-alpine AS builder

# Set build arguments for versioning
ARG APP_VERSION=unknown
ARG BUILD_DATE=unknown

WORKDIR /app
COPY package*.json ./

# Install dependencies with no cache and clean npm cache
RUN npm ci --no-cache && npm cache clean --force

COPY . .

# Build with version info
RUN npm run build

# Create version file
RUN echo "{\"version\":\"${APP_VERSION}\",\"buildDate\":\"${BUILD_DATE}\"}" > /app/dist/version.json

FROM nginx:alpine

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add cache busting headers
RUN echo 'add_header Cache-Control "no-cache, no-store, must-revalidate";' >> /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
