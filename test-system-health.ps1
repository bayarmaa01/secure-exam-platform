# Secure Exam Platform System Health Check (PowerShell)

Write-Host "=== Secure Exam Platform System Health Check ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running" -ForegroundColor Red
    exit 1
}

# Check if containers are running
Write-Host ""
Write-Host "=== Container Status ===" -ForegroundColor Yellow
$containers = @("frontend", "backend", "ai-proctoring", "postgres", "redis", "prometheus", "grafana")

foreach ($container in $containers) {
    $running = docker ps --format "table {{.Names}}" | Select-String $container
    if ($running) {
        Write-Host "✅ $container is running" -ForegroundColor Green
    } else {
        Write-Host "❌ $container is not running" -ForegroundColor Red
    }
}

# Check service health endpoints
Write-Host ""
Write-Host "=== Service Health Checks ===" -ForegroundColor Yellow

# Backend health check
Write-Host "Checking backend (port 4005)..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4005/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Backend health endpoint responding" -ForegroundColor Green
    } else {
        Write-Host "❌ Backend health endpoint not responding" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Backend health endpoint not responding" -ForegroundColor Red
}

# Frontend health check
Write-Host "Checking frontend (port 3005)..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3005" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Frontend is responding" -ForegroundColor Green
    } else {
        Write-Host "❌ Frontend is not responding" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Frontend is not responding" -ForegroundColor Red
}

# AI Proctoring health check
Write-Host "Checking AI proctoring (port 5005)..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5005/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ AI proctoring health endpoint responding" -ForegroundColor Green
    } else {
        Write-Host "❌ AI proctoring health endpoint not responding" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ AI proctoring health endpoint not responding" -ForegroundColor Red
}

# Prometheus health check
Write-Host "Checking Prometheus (port 9092)..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9092/-/healthy" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Prometheus is healthy" -ForegroundColor Green
    } else {
        Write-Host "❌ Prometheus is not healthy" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Prometheus is not healthy" -ForegroundColor Red
}

# Grafana health check
Write-Host "Checking Grafana (port 3002)..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3002/api/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Grafana is healthy" -ForegroundColor Green
    } else {
        Write-Host "❌ Grafana is not healthy" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Grafana is not healthy" -ForegroundColor Red
}

# Check API endpoints
Write-Host ""
Write-Host "=== API Endpoint Tests ===" -ForegroundColor Yellow

# Test teacher stats endpoint
Write-Host "Testing /api/teacher/stats endpoint..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4005/api/teacher/stats" -UseBasicParsing -TimeoutSec 5 -Headers @{"Content-Type"="application/json"}
    Write-Host "✅ Teacher stats endpoint accessible (may require auth)" -ForegroundColor Green
} catch {
    Write-Host "❌ Teacher stats endpoint not accessible" -ForegroundColor Red
}

# Test teacher exams endpoint
Write-Host "Testing /api/teacher/exams endpoint..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4005/api/teacher/exams" -UseBasicParsing -TimeoutSec 5 -Headers @{"Content-Type"="application/json"}
    Write-Host "✅ Teacher exams endpoint accessible (may require auth)" -ForegroundColor Green
} catch {
    Write-Host "❌ Teacher exams endpoint not accessible" -ForegroundColor Red
}

# Check Prometheus targets
Write-Host ""
Write-Host "=== Prometheus Targets Status ===" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9092/api/v1/targets" -UseBasicParsing | ConvertFrom-Json
    $healthyTargets = $response.data.activeTargets | Where-Object { $_.health -eq "up" }
    if ($healthyTargets.Count -gt 0) {
        Write-Host "✅ Prometheus has healthy targets" -ForegroundColor Green
    } else {
        Write-Host "❌ Prometheus targets are not healthy" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Cannot check Prometheus targets" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== System Health Check Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. If any services are down, run: docker-compose up -d" -ForegroundColor Gray
Write-Host "2. If API endpoints fail, check backend logs: docker-compose logs backend" -ForegroundColor Gray
Write-Host "3. Access services at:" -ForegroundColor Gray
Write-Host "   - Frontend: http://localhost:3005" -ForegroundColor Blue
Write-Host "   - Backend API: http://localhost:4005" -ForegroundColor Blue
Write-Host "   - Prometheus: http://localhost:9092" -ForegroundColor Blue
Write-Host "   - Grafana: http://localhost:3002 (admin/admin123)" -ForegroundColor Blue
