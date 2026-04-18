# Production Deployment Checklist

## ✅ Pre-Deployment Requirements

### 1. DNS Configuration
- [ ] DuckDNS A record: `secure-exam.duckdns.org` → `4.247.154.224`
- [ ] Verify DNS propagation: `dig secure-exam.duckdns.org`
- [ ] Test both HTTP and HTTPS access

### 2. SSL Certificate Setup
- [ ] Run SSL setup: `./ssl-setup.sh`
- [ ] Verify certificates in `./nginx/ssl/`
- [ ] Check certificate validity: `openssl x509 -in cert.pem -text -noout`

### 3. Docker Configuration
- [ ] Fixed docker-compose.yml YAML structure
- [ ] Frontend uses HTTPS URLs
- [ ] Backend CORS allows HTTPS domain
- [ ] Grafana uses HTTPS root URL
- [ ] All services use internal networking

## 🚀 Deployment Commands

```bash
# Clean deployment
docker-compose down -v

# Build and start
docker-compose up -d --build

# Verify services
docker-compose ps
docker-compose logs -f
```

## 🔍 Verification Steps

### 1. Service Health Checks
```bash
# Frontend
curl -f https://secure-exam.duckdns.org/health

# Backend API
curl -f https://secure-exam.duckdns.org/api/health

# AI Service
curl -f https://secure-exam.duckdns.org/ai/health

# Grafana
curl -f https://secure-exam.duckdns.org/grafana/api/health

# Prometheus
curl -f https://secure-exam.duckdns.org/prometheus/-/healthy
```

### 2. Browser Testing
- [ ] Frontend loads: https://secure-exam.duckdns.org
- [ ] Registration works
- [ ] Login works
- [ ] API calls succeed (no localhost errors)
- [ ] Grafana accessible: https://secure-exam.duckdns.org/grafana
- [ ] Prometheus accessible: https://secure-exam.duckdns.org/prometheus

### 3. SSL Verification
```bash
# Check certificate
openssl s_client -connect secure-exam.duckdns.org:443 -servername secure-exam.duckdns.org

# Verify redirect
curl -I http://secure-exam.duckdns.org
# Should return: 301 Moved Permanently → https://
```

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### 1. DuckDNS Not Pointing
```bash
# Check current DNS
dig secure-exam.duckdns.org

# Update DuckDNS (via web interface)
# A record: secure-exam.duckdns.org → 4.247.154.224
```

#### 2. SSL Certificate Issues
```bash
# Check certificate files
ls -la nginx/ssl/

# Regenerate certificate
sudo certbot delete --cert-name secure-exam.duckdns.org
./ssl-setup.sh
```

#### 3. Frontend Localhost Errors
```bash
# Check build args
grep VITE_API_URL docker-compose.yml

# Should show: https://secure-exam.duckdns.org/api
```

#### 4. CORS Issues
```bash
# Check CORS headers
curl -H "Origin: https://secure-exam.duckdns.org" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://secure-exam.duckdns.org/api/auth/login -v
```

#### 5. Service Communication
```bash
# Test internal DNS
docker-compose exec backend ping postgres
docker-compose exec backend ping redis
docker-compose exec backend ping ai-proctoring
```

## 📊 Monitoring Access

### Grafana
- **URL**: https://secure-exam.duckdns.org/grafana
- **Username**: admin
- **Password**: SecureGrafanaAdmin2024!

### Prometheus
- **URL**: https://secure-exam.duckdns.org/prometheus
- **Targets**: Should show backend, node-exporter, ai-proctoring

## 🔐 Security Checklist

- [ ] SSL certificate valid and not expired
- [ ] HTTP redirects to HTTPS
- [ ] Security headers present
- [ ] Rate limiting enabled
- [ ] No exposed ports except 80/443
- [ ] Strong passwords used
- [ ] CORS properly configured

## 📝 Final Validation

After deployment, run this comprehensive test:
```bash
# Full system test
curl -f https://secure-exam.duckdns.org/health && \
echo "✅ Frontend healthy" || \
echo "❌ Frontend failed"

curl -f https://secure-exam.duckdns.org/api/health && \
echo "✅ Backend healthy" || \
echo "❌ Backend failed"

curl -f https://secure-exam.duckdns.org/grafana/api/health && \
echo "✅ Grafana healthy" || \
echo "❌ Grafana failed"
```

## 🚨 Emergency Rollback

If deployment fails:
```bash
# Quick rollback
docker-compose down
git checkout previous-working-commit
docker-compose up -d --build
```
