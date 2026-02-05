FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 🔥 FIX: ensure vite is executable
RUN chmod +x node_modules/.bin/vite

RUN npm run build
