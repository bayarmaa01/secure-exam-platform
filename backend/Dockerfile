# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-cache && npm cache clean --force

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-cache && npm cache clean --force

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]