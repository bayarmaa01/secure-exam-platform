# -------- Build stage --------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# FIX: explicitly call vite via npx
RUN npx vite build

# -------- Runtime stage --------
FROM python:3.10-slim
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY app.py .

RUN pip install flask

EXPOSE 6000
CMD ["python", "app.py"]
