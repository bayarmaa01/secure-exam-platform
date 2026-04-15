#!/bin/bash

echo "=========================================="
echo "Fix Grafana Dashboard Import"
echo "=========================================="

# Check if Grafana is running
if ! docker compose ps grafana | grep -q "Up"; then
    echo "Grafana is not running. Starting it..."
    docker compose up -d grafana
    sleep 10
fi

echo "1. Checking Grafana logs..."
docker compose logs grafana --tail=20

echo ""
echo "2. Checking dashboard files..."
ls -la monitoring/grafana/dashboards/

echo ""
echo "3. Checking provisioning configuration..."
cat monitoring/grafana/provisioning/dashboards/dashboards.yml

echo ""
echo "4. Restarting Grafana to trigger provisioning..."
docker compose restart grafana
sleep 15

echo ""
echo "5. Checking Grafana logs after restart..."
docker compose logs grafana --tail=20

echo ""
echo "6. Testing Grafana API..."
curl -s http://localhost:3002/api/health || echo "Grafana API not responding"

echo ""
echo "7. Checking available dashboards via API..."
curl -s -u admin:admin123 http://localhost:3002/api/search | jq '.' 2>/dev/null || echo "No dashboards found via API"

echo ""
echo "=========================================="
echo "MANUAL IMPORT INSTRUCTIONS:"
echo "=========================================="
echo "If dashboards still don't appear:"
echo "1. Go to http://localhost:3002"
echo "2. Login: admin/admin123"
echo "3. Click '+' > Import"
echo "4. Upload these files:"
echo "   - monitoring/grafana/dashboards/secure-exam-platform.json"
echo "   - monitoring/grafana/dashboards/ai-proctoring.json"
echo ""
echo "Or use curl to import:"
echo "curl -X POST -u admin:admin123 \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d @monitoring/grafana/dashboards/secure-exam-platform.json \\"
echo "  http://localhost:3002/api/dashboards/db"
