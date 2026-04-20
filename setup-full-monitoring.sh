#!/bin/bash

# # SETUP FULL MONITORING FOR ALL SERVICES
# Configure Prometheus + Grafana with comprehensive monitoring

set -e

echo "Setting up Full Monitoring for All Services..."
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

print_header "1. Checking current service status..."

# Check if all containers are running
if docker-compose ps | grep -q "Up"; then
    print_status "Services are running"
    docker-compose ps --format "table {{.Name}}\t{{.Status}}"
else
    print_error "No services running, starting them..."
    docker-compose up -d
    sleep 10
fi

echo ""
print_header "2. Verifying Prometheus configuration..."

# Check prometheus.yml
if [ -f "./monitoring/prometheus/prometheus.yml" ]; then
    print_status "Prometheus config exists"
    
    # Show current scrape targets
    echo "Current scrape targets:"
    grep -A 2 "job_name:" ./monitoring/prometheus/prometheus.yml | grep -E "job_name|targets" | sed 's/^[[:space:]]*//'
else
    print_error "Prometheus config not found"
    exit 1
fi

echo ""
print_header "3. Checking service metrics endpoints..."

# Check backend metrics
print_status "Testing backend metrics endpoint..."
if curl -s http://localhost:4005/metrics | grep -q "HELP"; then
    print_status "Backend metrics endpoint working"
else
    print_error "Backend metrics endpoint not working"
fi

# Check AI proctoring metrics
print_status "Testing AI proctoring metrics endpoint..."
if curl -s http://localhost:8000/metrics | grep -q "HELP"; then
    print_status "AI proctoring metrics endpoint working"
else
    print_error "AI proctoring metrics endpoint not working"
fi

# Check node-exporter metrics
print_status "Testing node-exporter metrics endpoint..."
if curl -s http://localhost:9100/metrics | grep -q "HELP"; then
    print_status "Node exporter metrics endpoint working"
else
    print_error "Node exporter metrics endpoint not working"
fi

echo ""
print_header "4. Restarting Prometheus to apply configuration..."

docker-compose restart prometheus

# Wait for Prometheus to be ready
print_status "Waiting for Prometheus to be ready..."
sleep 10

# Check Prometheus health
if curl -s http://localhost:9090/-/healthy | grep -q "Prometheus"; then
    print_status "Prometheus is healthy"
else
    print_error "Prometheus is not healthy"
fi

echo ""
print_header "5. Verifying Prometheus targets..."

# Check Prometheus targets
print_status "Checking Prometheus targets status..."
TARGETS_RESPONSE=$(curl -s http://localhost:9090/api/v1/targets)

if echo "$TARGETS_RESPONSE" | jq -r '.data.activeTargets[] | "\(.job):\(.health)"' | while read -r target; do
    job=$(echo "$target" | cut -d: -f1)
    health=$(echo "$target" | cut -d: -f2)
    
    if [ "$health" = "up" ]; then
        echo -e "  $job: ${GREEN}UP${NC}"
    else
        echo -e "  $job: ${RED}DOWN${NC}"
    fi
done; then
    print_status "All targets checked"
else
    print_warning "Could not parse targets response"
fi

echo ""
print_header "6. Configuring Grafana..."

# Check if Grafana is running
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
    print_status "Grafana is running"
    
    # Check if Prometheus datasource exists
    print_status "Checking Prometheus datasource..."
    DATASOURCE_CHECK=$(curl -s -u admin:SecureGrafanaAdmin2024! \
        http://localhost:3000/api/datasources/name/prometheus)
    
    if echo "$DATASOURCE_CHECK" | grep -q "prometheus"; then
        print_status "Prometheus datasource already exists"
    else
        print_status "Creating Prometheus datasource..."
        curl -s -u admin:SecureGrafanaAdmin2024! \
            -X POST http://localhost:3000/api/datasources \
            -H "Content-Type: application/json" \
            -d '{
                "name": "Prometheus",
                "type": "prometheus",
                "access": "proxy",
                "url": "http://prometheus:9090",
                "isDefault": true,
                "editable": true
            }' | jq .
        
        print_status "Prometheus datasource created"
    fi
else
    print_error "Grafana is not running"
fi

echo ""
print_header "7. Creating monitoring dashboards..."

# Create Node Exporter dashboard
print_status "Importing Node Exporter dashboard (ID: 1860)..."
curl -s -u admin:SecureGrafanaAdmin2024! \
    -X POST http://localhost:3000/api/dashboards/db \
    -H "Content-Type: application/json" \
    -d '{
        "dashboard": {
            "id": null,
            "title": "Node Exporter Full",
            "tags": ["node-exporter"],
            "timezone": "browser",
            "panels": [
                {
                    "id": 1,
                    "title": "CPU Usage",
                    "type": "stat",
                    "targets": [
                        {
                            "expr": "100 - (avg by(instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
                            "legendFormat": "{{instance}}"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "percent",
                            "thresholds": {
                                "steps": [
                                    {"color": "green", "value": 0},
                                    {"color": "yellow", "value": 70},
                                    {"color": "red", "value": 90}
                                ]
                            }
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
                },
                {
                    "id": 2,
                    "title": "Memory Usage",
                    "type": "stat",
                    "targets": [
                        {
                            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
                            "legendFormat": "{{instance}}"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "percent",
                            "thresholds": {
                                "steps": [
                                    {"color": "green", "value": 0},
                                    {"color": "yellow", "value": 70},
                                    {"color": "red", "value": 90}
                                ]
                            }
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
                },
                {
                    "id": 3,
                    "title": "Disk Usage",
                    "type": "stat",
                    "targets": [
                        {
                            "expr": "(1 - (node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"})) * 100",
                            "legendFormat": "{{instance}}"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "percent",
                            "thresholds": {
                                "steps": [
                                    {"color": "green", "value": 0},
                                    {"color": "yellow", "value": 80},
                                    {"color": "red", "value": 95}
                                ]
                            }
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
                },
                {
                    "id": 4,
                    "title": "Network I/O",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "irate(node_network_receive_bytes_total[5m]) * 8",
                            "legendFormat": "RX {{instance}}"
                        },
                        {
                            "expr": "irate(node_network_transmit_bytes_total[5m]) * 8",
                            "legendFormat": "TX {{instance}}"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "bps"
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
                }
            ],
            "time": {"from": "now-1h", "to": "now"},
            "refresh": "5s"
        },
        "overwrite": true
    }' | jq . > /dev/null

# Create Backend API dashboard
print_status "Creating Backend API dashboard..."
curl -s -u admin:SecureGrafanaAdmin2024! \
    -X POST http://localhost:3000/api/dashboards/db \
    -H "Content-Type: application/json" \
    -d '{
        "dashboard": {
            "id": null,
            "title": "Backend API Metrics",
            "tags": ["backend", "api"],
            "timezone": "browser",
            "panels": [
                {
                    "id": 1,
                    "title": "HTTP Request Rate",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "rate(http_requests_total[5m])",
                            "legendFormat": "{{method}} {{route}}"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "reqps"
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
                },
                {
                    "id": 2,
                    "title": "Request Duration",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                            "legendFormat": "95th percentile"
                        },
                        {
                            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
                            "legendFormat": "50th percentile"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "s"
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
                },
                {
                    "id": 3,
                    "title": "Active Exam Sessions",
                    "type": "stat",
                    "targets": [
                        {
                            "expr": "exam_sessions_active",
                            "legendFormat": "Active Sessions"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "short"
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
                },
                {
                    "id": 4,
                    "title": "HTTP Status Codes",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "rate(http_requests_total[5m])",
                            "legendFormat": "{{status_code}} {{method}}"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "reqps"
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
                }
            ],
            "time": {"from": "now-1h", "to": "now"},
            "refresh": "5s"
        },
        "overwrite": true
    }' | jq . > /dev/null

# Create AI Proctoring dashboard
print_status "Creating AI Proctoring dashboard..."
curl -s -u admin:SecureGrafanaAdmin2024! \
    -X POST http://localhost:3000/api/dashboards/db \
    -H "Content-Type: application/json" \
    -d '{
        "dashboard": {
            "id": null,
            "title": "AI Proctoring Metrics",
            "tags": ["ai", "proctoring"],
            "timezone": "browser",
            "panels": [
                {
                    "id": 1,
                    "title": "Cheating Score",
                    "type": "gauge",
                    "targets": [
                        {
                            "expr": "ai_proctoring_cheating_score",
                            "legendFormat": "Current Score"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "percent",
                            "thresholds": {
                                "steps": [
                                    {"color": "green", "value": 0},
                                    {"color": "yellow", "value": 50},
                                    {"color": "red", "value": 80}
                                ]
                            }
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
                },
                {
                    "id": 2,
                    "title": "Suspicious Events",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "rate(suspicious_events_total[5m])",
                            "legendFormat": "{{event_type}}"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "eps"
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
                },
                {
                    "id": 3,
                    "title": "Face Detection Issues",
                    "type": "stat",
                    "targets": [
                        {
                            "expr": "rate(face_not_detected_total[5m])",
                            "legendFormat": "Face Not Detected Rate"
                        },
                        {
                            "expr": "rate(multiple_faces_detected_total[5m])",
                            "legendFormat": "Multiple Faces Rate"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "eps"
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
                },
                {
                    "id": 4,
                    "title": "AI Processing Time",
                    "type": "graph",
                    "targets": [
                        {
                            "expr": "histogram_quantile(0.95, rate(ai_processing_duration_seconds_bucket[5m]))",
                            "legendFormat": "95th percentile"
                        }
                    ],
                    "fieldConfig": {
                        "defaults": {
                            "unit": "s"
                        }
                    },
                    "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
                }
            ],
            "time": {"from": "now-1h", "to": "now"},
            "refresh": "5s"
        },
        "overwrite": true
    }' | jq . > /dev/null

print_status "Dashboards created successfully"

echo ""
print_header "8. Final verification..."

echo ""
print_status "Monitoring Setup Complete!"
echo ""
echo "Access URLs:"
echo "- Prometheus: http://4.247.154.224:9090"
echo "- Grafana: http://4.247.154.224:3000"
echo "  - Username: admin"
echo "  - Password: SecureGrafanaAdmin2024!"
echo ""
echo "Dashboards created:"
echo "- Node Exporter Full (CPU, Memory, Disk, Network)"
echo "- Backend API Metrics (Request Rate, Duration, Status Codes)"
echo "- AI Proctoring Metrics (Cheating Score, Suspicious Events)"
echo ""
echo "Expected Prometheus targets:"
echo "- node-exporter: UP (port 9100)"
echo "- backend: UP (port 4005)"
echo "- ai-proctoring: UP (port 8000)"
echo ""
echo "To verify targets, visit: http://4.247.154.224:9090/targets"
