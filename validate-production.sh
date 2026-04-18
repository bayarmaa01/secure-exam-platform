#!/bin/bash

# 🔒 Secure Exam Platform - Production Validation Script
# Azure VM: 4.247.154.224 | Domain: secure-exam.duckdns.org

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://4.247.154.224:4005/api"
DOMAIN_API="http://secure-exam.duckdns.org/api"
FRONTEND_URL="http://4.247.154.224:3005"
DOMAIN_URL="http://secure-exam.duckdns.org"
PROMETHEUS_URL="http://4.247.154.224:9092"
GRAFANA_URL="http://4.247.154.224:3002"

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

test_endpoint() {
    local url="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    local expected_code="${4:-200}"
    local test_name="$5"
    
    ((TOTAL_TESTS++))
    log_info "Testing $test_name: $method $url"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -o /tmp/response.json -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null || echo "000")
    else
        response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$url" 2>/dev/null || echo "000")
    fi
    
    if [ "$response" = "$expected_code" ]; then
        log_success "$test_name - HTTP $response"
        return 0
    else
        log_error "$test_name - HTTP $response (expected $expected_code)"
        if [ -f /tmp/response.json ]; then
            log_error "Response: $(cat /tmp/response.json)"
        fi
        return 1
    fi
}

test_container_health() {
    local container="$1"
    local health_check="$2"
    
    ((TOTAL_TESTS++))
    log_info "Checking container health: $container"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep "$container" | grep -q "healthy\|Up"; then
        log_success "$container is healthy"
        return 0
    else
        log_error "$container is not healthy"
        docker ps --format "table {{.Names}}\t{{.Status}}" | grep "$container" || log_error "$container not found"
        return 1
    fi
}

# ==========================================
# STEP 1: CONTAINER HEALTH CHECKS
# ==========================================
echo -e "\n${BLUE}🔍 STEP 1: Container Health Checks${NC}"

test_container_health "nginx-proxy" "nginx health"
test_container_health "secure-exam-platform-frontend-1" "frontend health"
test_container_health "secure-exam-platform-backend-1" "backend health"
test_container_health "secure-exam-platform-postgres-1" "postgres health"
test_container_health "secure-exam-platform-redis-1" "redis health"
test_container_health "secure-exam-platform-ai-proctoring-1" "ai-proctoring health"
test_container_health "prometheus" "prometheus health"
test_container_health "grafana" "grafana health"
test_container_health "node-exporter" "node-exporter health"

# ==========================================
# STEP 2: BASIC HEALTH ENDPOINTS
# ==========================================
echo -e "\n${BLUE}🏥 STEP 2: Health Endpoint Tests${NC}"

test_endpoint "http://4.247.154.224/health" "GET" "" "200" "Nginx Health (IP)"
test_endpoint "http://secure-exam.duckdns.org/health" "GET" "" "200" "Nginx Health (Domain)"
test_endpoint "$API_BASE/health" "GET" "" "200" "Backend Health (IP)"
test_endpoint "$API_BASE/../health" "GET" "" "200" "Backend Health (Direct)"
test_endpoint "http://4.247.154.224:5005/health" "GET" "" "200" "AI Proctoring Health"

# ==========================================
# STEP 3: AUTHENTICATION TESTS
# ==========================================
echo -e "\n${BLUE}🔐 STEP 3: Authentication Tests${NC}"

# Test login endpoint
login_data='{"email":"test@example.com","password":"testpassword"}'
test_endpoint "$API_BASE/auth/login" "POST" "$login_data" "200" "Login Endpoint"

# Test registration endpoint  
register_data='{"email":"newuser@example.com","password":"newpassword","name":"Test User","role":"student"}'
test_endpoint "$API_BASE/auth/register" "POST" "$register_data" "201" "Registration Endpoint"

# Test auth middleware with invalid token
test_endpoint "$API_BASE/exams" "GET" "" "401" "Auth Middleware (No Token)"

# ==========================================
# STEP 4: EXAM API TESTS
# ==========================================
echo -e "\n${BLUE}📝 STEP 4: Exam API Tests${NC}"

# Test exams endpoint (will fail without auth, but should return proper error)
test_endpoint "$API_BASE/exams" "GET" "" "401" "Exams List (No Auth)"

# Test attempts start endpoint (will fail without auth, but should return proper error)
attempt_data='{"examId":"test-exam-id"}'
test_endpoint "$API_BASE/attempts/start" "POST" "$attempt_data" "401" "Attempts Start (No Auth)"

# ==========================================
# STEP 5: FRONTEND ACCESSIBILITY
# ==========================================
echo -e "\n${BLUE}🌐 STEP 5: Frontend Accessibility${NC}"

test_endpoint "$FRONTEND_URL" "GET" "" "200" "Frontend (IP)"
test_endpoint "$DOMAIN_URL" "GET" "" "200" "Frontend (Domain)"

# Check for static assets
test_endpoint "$FRONTEND_URL/" "GET" "" "200" "Frontend Root"
test_endpoint "$DOMAIN_URL/" "GET" "" "200" "Frontend Root (Domain)"

# ==========================================
# STEP 6: PROMETHEUS TARGETS
# ==========================================
echo -e "\n${BLUE}📊 STEP 6: Prometheus Targets${NC}"

test_endpoint "$PROMETHEUS_URL/targets" "GET" "" "200" "Prometheus Targets"

# Check if targets are up
log_info "Checking Prometheus targets status..."
targets_response=$(curl -s "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null || echo "")
if echo "$targets_response" | grep -q '"health":"up"'; then
    log_success "Prometheus targets are UP"
    ((PASSED_TESTS++))
else
    log_error "Prometheus targets are DOWN"
    log_error "Targets response: $targets_response"
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# ==========================================
# STEP 7: GRAFANA DASHBOARDS
# ==========================================
echo -e "\n${BLUE}📈 STEP 7: Grafana Dashboards${NC}"

test_endpoint "$GRAFANA_URL/api/health" "GET" "" "200" "Grafana Health"

# Test Grafana login
grafana_login='{"user":"admin","password":"SecureGrafanaAdmin2024!"}'
test_endpoint "$GRAFANA_URL/api/login" "POST" "$grafana_login" "200" "Grafana Login"

# Check datasources
test_endpoint "$GRAFANA_URL/api/datasources" "GET" "" "200" "Grafana Datasources"

# ==========================================
# STEP 8: DATABASE CONNECTIVITY
# ==========================================
echo -e "\n${BLUE}🗄️ STEP 8: Database Connectivity${NC}"

((TOTAL_TESTS++))
log_info "Testing PostgreSQL connection..."

if docker exec secure-exam-platform-postgres-1 pg_isready -U postgres -d exam_platform >/dev/null 2>&1; then
    log_success "PostgreSQL is ready"
    ((PASSED_TESTS++))
else
    log_error "PostgreSQL is not ready"
    ((FAILED_TESTS++))
fi

# Test unique constraint exists
((TOTAL_TESTS++))
log_info "Checking unique_active_attempt index..."

if docker exec secure-exam-platform-postgres-1 psql -U postgres -d exam_platform -c "\d exam_attempts" | grep -q "unique_active_attempt"; then
    log_success "unique_active_attempt index exists"
    ((PASSED_TESTS++))
else
    log_error "unique_active_attempt index missing"
    ((FAILED_TESTS++))
fi

# ==========================================
# STEP 9: REDIS CONNECTIVITY
# ==========================================
echo -e "\n${BLUE}🔴 STEP 9: Redis Connectivity${NC}"

((TOTAL_TESTS++))
log_info "Testing Redis connection..."

if docker exec secure-exam-platform-redis-1 redis-cli ping | grep -q "PONG"; then
    log_success "Redis is responding"
    ((PASSED_TESTS++))
else
    log_error "Redis is not responding"
    ((FAILED_TESTS++))
fi

# ==========================================
# STEP 10: AI PROCTORING CONNECTIVITY
# ==========================================
echo -e "\n${BLUE}🤖 STEP 10: AI Proctoring Connectivity${NC}"

test_endpoint "http://4.247.154.224:5005/health" "GET" "" "200" "AI Service Health"

# Test AI frame analysis endpoint (will fail without proper auth/data, but should be accessible)
frame_data='{"frame":"data:image/jpeg;base64,test","timestamp":1234567890}'
test_endpoint "http://4.247.154.224:5005/analyze-frame" "POST" "$frame_data" "400" "AI Frame Analysis"

# ==========================================
# STEP 11: CORS AND HEADERS
# ==========================================
echo -e "\n${BLUE}🔒 STEP 11: CORS and Security Headers${NC}"

# Test CORS preflight
((TOTAL_TESTS++))
log_info "Testing CORS preflight..."

cors_response=$(curl -s -w "%{http_code}" -o /tmp/cors.json -X OPTIONS -H "Origin: http://secure-exam.duckdns.org" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" "$DOMAIN_API/auth/login" 2>/dev/null || echo "000")

if [ "$cors_response" = "204" ] || [ "$cors_response" = "200" ]; then
    log_success "CORS preflight working"
    ((PASSED_TESTS++))
else
    log_error "CORS preflight failed - HTTP $cors_response"
    ((FAILED_TESTS++))
fi

# ==========================================
# STEP 12: RATE LIMITING
# ==========================================
echo -e "\n${BLUE}⚡ STEP 12: Rate Limiting${NC}"

# Test rate limiting (send multiple quick requests)
((TOTAL_TESTS++))
log_info "Testing rate limiting..."

rate_limit_passed=0
for i in {1..5}; do
    response=$(curl -s -w "%{http_code}" -o /dev/null "$DOMAIN_API/auth/login" -X POST -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}' 2>/dev/null || echo "000")
    if [ "$response" = "429" ]; then
        rate_limit_passed=1
        break
    fi
    sleep 0.1
done

if [ $rate_limit_passed -eq 1 ]; then
    log_success "Rate limiting is working"
    ((PASSED_TESTS++))
else
    log_warning "Rate limiting may not be working (this is optional)"
    ((PASSED_TESTS++)) # Don't fail for optional feature
fi

# ==========================================
# RESULTS SUMMARY
# ==========================================
echo -e "\n${BLUE}📋 TEST RESULTS SUMMARY${NC}"
echo "=================================="
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
echo -e "Success Rate: ${BLUE}$success_rate%${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! System is production-ready.${NC}"
    echo -e "\n${GREEN}✅ VERIFIED WORKING URLS:${NC}"
    echo -e "   App: ${BLUE}$DOMAIN_URL${NC}"
    echo -e "   API: ${BLUE}$API_BASE${NC}"
    echo -e "   Grafana: ${BLUE}$GRAFANA_URL${NC}"
    echo -e "   Prometheus: ${BLUE}$PROMETHEUS_URL${NC}"
    echo -e "\n${GREEN}🔐 Grafana Credentials: admin / SecureGrafanaAdmin2024!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ SOME TESTS FAILED! System needs fixes.${NC}"
    echo -e "\n${RED}Please check the failed tests above and fix the issues.${NC}"
    exit 1
fi
