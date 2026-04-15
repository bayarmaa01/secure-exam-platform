#!/bin/bash

echo "=========================================="
echo "Secure Exam Platform - Complete System Test"
echo "=========================================="

# Check Docker Desktop
echo "1. Checking Docker Desktop..."
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker Desktop is not running!"
    echo "Please start Docker Desktop and try again."
    exit 1
fi
echo "Docker Desktop is running!"

# Clean up previous containers
echo "2. Cleaning up previous containers..."
docker compose down -v --remove-orphans

# Build and start services
echo "3. Building and starting services..."
docker compose up --build -d

# Wait for services to be healthy
echo "4. Waiting for services to be healthy..."
sleep 30

# Check service health
echo "5. Checking service health..."
services=("frontend:3005" "backend:4005" "ai-proctoring:5005" "postgres:5432" "redis:6379" "grafana:3002" "prometheus:9092")

for service in "${services[@]}"; do
    service_name=$(echo $service | cut -d':' -f1)
    port=$(echo $service | cut -d':' -f2)
    
    if curl -f -s http://localhost:$port >/dev/null 2>&1; then
        echo "  $service_name: OK"
    else
        echo "  $service_name: FAILED"
    fi
done

echo ""
echo "6. Testing API endpoints..."
echo "Testing backend health..."
if curl -f -s http://localhost:4005/api/health >/dev/null; then
    echo "  Backend health: OK"
else
    echo "  Backend health: FAILED"
fi

echo "Testing AI service health..."
if curl -f -s http://localhost:5005/health >/dev/null; then
    echo "  AI service health: OK"
else
    echo "  AI service health: FAILED"
fi

echo ""
echo "7. Testing user registration..."
# Test registration with valid password
register_response=$(curl -s -X POST http://localhost:4005/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@student.com",
        "password": "Test123!@#",
        "name": "Test Student",
        "role": "student"
    }')

if echo "$register_response" | grep -q "accessToken"; then
    echo "  User registration: OK"
else
    echo "  User registration: FAILED"
    echo "  Response: $register_response"
fi

echo ""
echo "8. Testing user login..."
login_response=$(curl -s -X POST http://localhost:4005/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@student.com",
        "password": "Test123!@#"
    }')

if echo "$login_response" | grep -q "accessToken"; then
    echo "  User login: OK"
else
    echo "  User login: FAILED"
    echo "  Response: $login_response"
fi

echo ""
echo "=========================================="
echo "SYSTEM TEST COMPLETE"
echo "=========================================="
echo ""
echo "Access URLs:"
echo "  Frontend:        http://localhost:3005"
echo "  Backend API:     http://localhost:4005/api/health"
echo "  AI Service:      http://localhost:5005/health"
echo "  Grafana:         http://localhost:3002 (admin/admin123)"
echo "  Prometheus:      http://localhost:9092"
echo ""
echo "Test Credentials:"
echo "  Email: test@student.com"
echo "  Password: Test123!@#"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
