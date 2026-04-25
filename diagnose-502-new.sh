#!/bin/bash

echo "=== DIAGNOSING 502 BAD GATEWAY ERROR ==="
echo "Time: $(date)"
echo ""

# Check Docker container status
echo "=== DOCKER CONTAINER STATUS ==="
docker-compose ps
echo ""

# Check backend container logs for errors
echo "=== BACKEND CONTAINER LOGS (last 20 lines) ==="
docker-compose logs --tail=20 backend
echo ""

# Check nginx container logs for errors
echo "=== NGINX CONTAINER LOGS (last 20 lines) ==="
docker-compose logs --tail=20 nginx
echo ""

# Test backend health directly
echo "=== BACKEND HEALTH CHECK ==="
curl -f http://localhost:4005/health || echo "Backend health check failed"
echo ""

# Test backend from nginx container
echo "=== BACKEND ACCESS FROM NGINX CONTAINER ==="
docker-compose exec nginx wget -qO- http://backend:4005/health || echo "Backend not accessible from nginx"
echo ""

# Check network connectivity
echo "=== DOCKER NETWORK CONNECTIVITY ==="
docker network ls | grep exam-network
echo ""

# Test nginx configuration
echo "=== NGINX CONFIGURATION TEST ==="
docker-compose exec nginx nginx -t || echo "Nginx config test failed"
echo ""

echo "=== DIAGNOSIS COMPLETE ==="
