# Secure Exam Platform Service Restart (PowerShell)

Write-Host "=== Secure Exam Platform Service Restart ===" -ForegroundColor Cyan
Write-Host ""

# Stop all services
Write-Host "Stopping all services..." -ForegroundColor Yellow
docker-compose down

# Clean up any hanging containers
Write-Host "Cleaning up hanging containers..." -ForegroundColor Yellow
docker system prune -f

# Rebuild and start services
Write-Host "Rebuilding and starting services..." -ForegroundColor Yellow
docker-compose up -d --build

# Wait for services to be healthy
Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service status
Write-Host ""
Write-Host "=== Service Status ===" -ForegroundColor Green
docker-compose ps

Write-Host ""
Write-Host "=== Access URLs ===" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3005" -ForegroundColor Blue
Write-Host "Backend API: http://localhost:4005" -ForegroundColor Blue
Write-Host "AI Proctoring: http://localhost:5005" -ForegroundColor Blue
Write-Host "Prometheus: http://localhost:9092" -ForegroundColor Blue
Write-Host "Grafana: http://localhost:3002 (admin/admin123)" -ForegroundColor Blue

Write-Host ""
Write-Host "=== Testing API Endpoints ===" -ForegroundColor Yellow

# Test backend
Write-Host "Testing backend health..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4005/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host " ✅ Backend healthy" -ForegroundColor Green
    } else {
        Write-Host " ❌ Backend not responding" -ForegroundColor Red
    }
} catch {
    Write-Host " ❌ Backend not responding" -ForegroundColor Red
}

# Test frontend
Write-Host "Testing frontend..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3005" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host " ✅ Frontend responding" -ForegroundColor Green
    } else {
        Write-Host " ❌ Frontend not responding" -ForegroundColor Red
    }
} catch {
    Write-Host " ❌ Frontend not responding" -ForegroundColor Red
}

# Test AI proctoring
Write-Host "Testing AI proctoring..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5005/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host " ✅ AI Proctoring healthy" -ForegroundColor Green
    } else {
        Write-Host " ❌ AI Proctoring not responding" -ForegroundColor Red
    }
} catch {
    Write-Host " ❌ AI Proctoring not responding" -ForegroundColor Red
}

# Test Prometheus
Write-Host "Testing Prometheus..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:9092/-/healthy" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host " ✅ Prometheus healthy" -ForegroundColor Green
    } else {
        Write-Host " ❌ Prometheus not responding" -ForegroundColor Red
    }
} catch {
    Write-Host " ❌ Prometheus not responding" -ForegroundColor Red
}

# Test Grafana
Write-Host "Testing Grafana..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3002/api/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host " ✅ Grafana healthy" -ForegroundColor Green
    } else {
        Write-Host " ❌ Grafana not responding (may still be starting)" -ForegroundColor Yellow
    }
} catch {
    Write-Host " ❌ Grafana not responding (may still be starting)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Restart Complete ===" -ForegroundColor Cyan
Write-Host "If Grafana is still starting, wait another 30 seconds and test again." -ForegroundColor Gray
