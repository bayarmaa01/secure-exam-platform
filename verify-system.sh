#!/bin/bash

echo "=== SECURE EXAM PLATFORM SYSTEM VERIFICATION ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

DOMAIN="https://secure-exam.duckdns.org"

echo "Testing Nginx reverse proxy..."
echo "================================"

# Test health endpoint
echo -n "Testing /health endpoint: "
if curl -s -f "$DOMAIN/health" > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test frontend
echo -n "Testing frontend (/): "
if curl -s -f "$DOMAIN/" > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

echo ""
echo "Testing API endpoints..."
echo "========================"

# Test backend health
echo -n "Testing /api/health: "
if curl -s -f "$DOMAIN/api/health" > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test warnings route (should be 401 without auth)
echo -n "Testing /api/warnings (expect 401): "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/warnings")
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ PASS (401 as expected)${NC}"
else
    echo -e "${RED}✗ FAIL (got $HTTP_CODE)${NC}"
fi

echo ""
echo "Testing Monitoring Stack..."
echo "=========================="

# Test Prometheus
echo -n "Testing Prometheus (/prometheus): "
if curl -s -f "$DOMAIN/prometheus/targets" > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

# Test Grafana
echo -n "Testing Grafana (/grafana): "
if curl -s -f "$DOMAIN/grafana/api/health" > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

echo ""
echo "Testing Prometheus Scrape Targets..."
echo "===================================="

# Check Prometheus targets
echo "Prometheus targets status:"
curl -s "$DOMAIN/prometheus/api/v1/targets" | jq -r '.data.activeTargets[] | "\(.job): \(.health) (\(.lastError // "OK"))"' 2>/dev/null || echo "Could not fetch targets"

echo ""
echo "Testing AI Service..."
echo "===================="

# Test AI service health
echo -n "Testing AI service (/ai/health): "
if curl -s -f "$DOMAIN/ai/health" > /dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
fi

echo ""
echo "=== VERIFICATION COMPLETE ==="
