# Fix Grafana and Prometheus access issues

Write-Host "🔧 Fixing Grafana and Prometheus access issues..." -ForegroundColor Green

# Restart nginx to apply configuration changes
Write-Host "📝 Restarting Nginx with new configuration..." -ForegroundColor Yellow
docker-compose restart nginx

# Wait for nginx to be ready
Write-Host "⏳ Waiting for Nginx to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test Grafana access
Write-Host "🔍 Testing Grafana access..." -ForegroundColor Cyan
try {
    $grafanaResponse = Invoke-WebRequest -Uri "https://secure-exam.duckdns.org/grafana/" -Method HEAD -UseBasicParsing
    Write-Host "Grafana Status: $($grafanaResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Grafana Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Prometheus access  
Write-Host "🔍 Testing Prometheus access..." -ForegroundColor Cyan
try {
    $prometheusResponse = Invoke-WebRequest -Uri "https://secure-exam.duckdns.org/prometheus/" -Method HEAD -UseBasicParsing
    Write-Host "Prometheus Status: $($prometheusResponse.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Prometheus Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Prometheus metrics endpoint directly
Write-Host "🔍 Testing Prometheus metrics endpoint..." -ForegroundColor Cyan
try {
    $metricsResponse = Invoke-WebRequest -Uri "https://secure-exam.duckdns.org/prometheus/metrics" -UseBasicParsing
    Write-Host "Metrics endpoint working: $($metricsResponse.Content.Substring(0, Math.Min(100, $metricsResponse.Content.Length)))..." -ForegroundColor Green
} catch {
    Write-Host "Metrics Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Grafana API
Write-Host "🔍 Testing Grafana API..." -ForegroundColor Cyan
try {
    $grafanaApi = Invoke-WebRequest -Uri "https://secure-exam.duckdns.org/grafana/api/health" -Headers @{Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:SecureGrafanaAdmin2024!"))} -UseBasicParsing
    Write-Host "Grafana API Status: $($grafanaApi.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Grafana API Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Check container status
Write-Host "📊 Checking container status..." -ForegroundColor Yellow
docker-compose ps

Write-Host "✅ Monitoring fix complete!" -ForegroundColor Green
Write-Host "🌐 Grafana should be available at: https://secure-exam.duckdns.org/grafana/" -ForegroundColor Cyan
Write-Host "📈 Prometheus should be available at: https://secure-exam.duckdns.org/prometheus/" -ForegroundColor Cyan
