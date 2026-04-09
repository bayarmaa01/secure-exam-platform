#!/bin/bash

# ========================================
# System Test Script for Secure Exam Platform
# ========================================
# This script tests all the critical fixes and functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print colored output
print_info() {
    echo -e "${BLUE}i  $1${NC}"
}

print_success() {
    echo -e "${GREEN} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  $1${NC}"
}

print_error() {
    echo -e "${RED}  $1${NC}"
}

print_header() {
    echo -e "${GREEN}"
    echo "======================================"
    echo "$1"
    echo "======================================"
    echo -e "${NC}"
}

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    print_info "Running test: $test_name"
    
    if eval "$test_command" &>/dev/null; then
        print_success "PASS: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "FAIL: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Function to test API endpoints
test_api_endpoint() {
    local endpoint="$1"
    local method="${2:-GET}"
    local expected_status="${3:-200}"
    
    case $method in
        "GET")
            curl -s -o /dev/null -w "%{http_code}" "$endpoint" | grep -q "$expected_status"
            ;;
        "POST")
            curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$endpoint" | grep -q "$expected_status"
            ;;
    esac
}

# Function to test backend services
test_backend_services() {
    print_header "Testing Backend Services"
    
    # Test backend health endpoint
    run_test "Backend Health Check" "curl -f -s http://localhost:4005/health"
    
    # Test auth endpoints
    run_test "Auth Login Endpoint" "test_api_endpoint http://localhost:4005/api/auth/login POST 401"
    run_test "Auth Me Endpoint" "test_api_endpoint http://localhost:4005/api/auth/me 401"
    
    # Test exam endpoints
    run_test "Student Exams Endpoint" "test_api_endpoint http://localhost:4005/api/exams 401"
    run_test "Teacher Exams Endpoint" "test_api_endpoint http://localhost:4005/api/teacher/exams 401"
    
    # Test advanced features
    run_test "Analytics Endpoint" "test_api_endpoint http://localhost:4005/api/analytics/student-dashboard 401"
    run_test "Security Endpoint" "test_api_endpoint http://localhost:4005/api/security/analytics 401"
    
    # Test CORS headers
    run_test "CORS Headers" "curl -s -I http://localhost:4005/health | grep -i 'access-control-allow-origin'"
}

# Function to test frontend
test_frontend() {
    print_header "Testing Frontend"
    
    # Test frontend accessibility
    run_test "Frontend Accessibility" "curl -f -s http://localhost:3005"
    
    # Test frontend build
    if [ -d "frontend" ]; then
        run_test "Frontend Build" "cd frontend && npm run build"
    fi
}

# Function to test database connectivity
test_database() {
    print_header "Testing Database Connectivity"
    
    # Check if PostgreSQL is running
    if command -v pg_isready &> /dev/null; then
        run_test "PostgreSQL Ready" "pg_isready -h localhost -p 5432"
    else
        print_warning "pg_isready not available, skipping database test"
    fi
    
    # Test database connection through backend
    run_test "Database Connection via Backend" "curl -f -s http://localhost:4005/health"
}

# Function to test JWT authentication
test_jwt_auth() {
    print_header "Testing JWT Authentication"
    
    # Test login with valid credentials
    local login_response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test123"}' \
        http://localhost:4005/api/auth/login || echo "")
    
    if echo "$login_response" | grep -q "accessToken"; then
        print_success "PASS: Login with valid credentials"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "FAIL: Login with valid credentials"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    
    # Test login with invalid credentials
    run_test "Login with Invalid Credentials" "! curl -s -X POST -H 'Content-Type: application/json' -d '{\"email\":\"invalid@example.com\",\"password\":\"wrong\"}' http://localhost:4005/api/auth/login | grep -q 'accessToken'"
}

# Function to test role-based access
test_role_based_access() {
    print_header "Testing Role-Based Access Control"
    
    # Test teacher endpoints without auth
    run_test "Teacher Endpoint Without Auth" "test_api_endpoint http://localhost:4005/api/teacher/exams GET 401"
    
    # Test student endpoints without auth
    run_test "Student Endpoint Without Auth" "test_api_endpoint http://localhost:4005/api/exams GET 401"
    
    # Test admin endpoints without auth
    run_test "Admin Endpoint Without Auth" "test_api_endpoint http://localhost:4005/api/admin/users GET 401"
}

# Function to test Kubernetes services
test_kubernetes_services() {
    print_header "Testing Kubernetes Services"
    
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        # Test if services exist
        run_test "Frontend Service Exists" "kubectl get svc frontend -n exam-platform"
        run_test "Backend Service Exists" "kubectl get svc backend -n exam-platform"
        run_test "PostgreSQL Service Exists" "kubectl get svc postgres -n exam-platform"
        run_test "Redis Service Exists" "kubectl get svc redis -n exam-platform"
        
        # Test ArgoCD if installed
        if kubectl get namespace argocd &> /dev/null; then
            run_test "ArgoCD Server Exists" "kubectl get svc argocd-server -n argocd"
        fi
        
        # Test monitoring if installed
        if kubectl get namespace monitoring &> /dev/null; then
            run_test "Grafana Service Exists" "kubectl get svc prometheus-grafana -n monitoring"
        fi
    else
        print_warning "Kubernetes cluster not accessible, skipping K8s tests"
    fi
}

# Function to test port forwards
test_port_forwards() {
    print_header "Testing Port Forwards"
    
    # Test if ports are accessible
    run_test "Frontend Port Forward (3005)" "curl -f -s http://localhost:3005"
    run_test "Backend Port Forward (4005)" "curl -f -s http://localhost:4005/health"
    run_test "AI Service Port Forward (5005)" "curl -f -s http://localhost:5005/health"
    
    # Test Grafana if available
    run_test "Grafana Port Forward (3002)" "curl -f -s http://localhost:3002"
    
    # Test Prometheus if available
    run_test "Prometheus Port Forward (9092)" "curl -f -s http://localhost:9092"
    
    # Test ArgoCD if available
    run_test "ArgoCD Port Forward (18081)" "curl -f -s -k https://localhost:18081"
}

# Function to test notifications (basic)
test_notifications() {
    print_header "Testing Notification System"
    
    # Test if Socket.io endpoint is accessible
    run_test "Socket.io Endpoint" "curl -f -s http://localhost:4005/socket.io/"
}

# Function to display test results
show_test_results() {
    print_header "Test Results Summary"
    
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo -e "${BLUE}Total Tests: $TESTS_TOTAL${NC}"
    
    local success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    echo -e "Success Rate: ${success_rate}%"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All tests passed! System is working correctly."
    else
        print_warning "Some tests failed. Please check the failed tests above."
    fi
}

# Function to show system status
show_system_status() {
    print_header "System Status"
    
    echo -e "${BLUE}Backend Services:${NC}"
    if curl -f -s http://localhost:4005/health &>/dev/null; then
        echo -e "  Backend: ${GREEN}Running${NC}"
    else
        echo -e "  Backend: ${RED}Not Running${NC}"
    fi
    
    echo -e "${BLUE}Frontend Services:${NC}"
    if curl -f -s http://localhost:3005 &>/dev/null; then
        echo -e "  Frontend: ${GREEN}Running${NC}"
    else
        echo -e "  Frontend: ${RED}Not Running${NC}"
    fi
    
    echo -e "${BLUE}Database:${NC}"
    if pg_isready -h localhost -p 5432 &>/dev/null; then
        echo -e "  PostgreSQL: ${GREEN}Running${NC}"
    else
        echo -e "  PostgreSQL: ${RED}Not Running${NC}"
    fi
    
    echo -e "${BLUE}Redis:${NC}"
    if redis-cli ping &>/dev/null; then
        echo -e "  Redis: ${GREEN}Running${NC}"
    else
        echo -e "  Redis: ${RED}Not Running${NC}"
    fi
}

# Main execution
main() {
    print_header "Secure Exam Platform System Test"
    
    # Show system status
    show_system_status
    
    # Run all tests
    test_backend_services
    test_frontend
    test_database
    test_jwt_auth
    test_role_based_access
    test_kubernetes_services
    test_port_forwards
    test_notifications
    
    # Show results
    show_test_results
    
    # Exit with appropriate code
    if [ $TESTS_FAILED -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"
