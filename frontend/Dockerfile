FROM node:20-alpine

WORKDIR /app

# Copy dependency files first
COPY package*.json ./

RUN npm install

# Copy source
COPY . .

# ✅ FIX: run Vite via Node (bypasses permission issues)
RUN node node_modules/vite/bin/vite.js build

# Serve static build
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]

