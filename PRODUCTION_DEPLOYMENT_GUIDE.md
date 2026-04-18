# 🔒 Secure Exam Platform - Production Deployment Guide

## 📋 Overview
This guide provides step-by-step instructions for deploying the Secure AI-Proctored Exam Platform on Azure VM.

**Deployment Target:**
- **VM IP:** 4.247.154.224
- **Domain:** secure-exam.duckdns.org
- **Platform:** Azure VM (Ubuntu/Debian recommended)

## 🚀 Quick Start Deployment

### 1. Clone Repository
```bash
git clone <repository-url>
cd secure-exam-platform
```

### 2. Run Deployment Script
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

### 3. Single Command Alternative
```bash
docker-compose up -d --build
```

## 🏗️ Architecture Overview

### Services & Ports
| Service | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------|
| Nginx | 80 | 80 | Reverse Proxy & Domain Routing |
| Frontend | 80 | 3005 | React Application |
| Backend | 4005 | 4005 | Node.js API Server |
| AI Proctoring | 8000 | 5005 | Python AI Service |
| PostgreSQL | 5432 | - | Primary Database |
| Redis | 6379 | 6380 | Cache & Session Store |
| Prometheus | 9090 | 9092 | Metrics Collection |
| Grafana | 3000 | 3002 | Monitoring Dashboard |
| Node Exporter | 9100 | 9100 | System Metrics |

### Network Architecture
```
Internet → Nginx (Port 80) → Frontend (Port 3005)
                    ↘ Backend API (Port 4005)
                    ↘ AI Proctoring (Port 5005)
```

## 🔗 Access URLs

### Application URLs
- **Main Application:** http://secure-exam.duckdns.org
- **Direct IP Access:** http://4.247.154.224
- **Frontend Direct:** http://4.247.154.224:3005
- **Backend API:** http://4.247.154.224:4005/api
- **AI Proctoring:** http://4.247.154.224:5005

### Monitoring URLs
- **Grafana Dashboard:** http://4.247.154.224:3002
- **Prometheus:** http://4.247.154.224:9092

### Credentials
- **Grafana Username:** admin
- **Grafana Password:** SecureGrafanaAdmin2024!
- **Database User:** postgres
- **Database Password:** SecureExamPlatform2024!

## 🛠️ Configuration Details

### Environment Variables
All production environment variables are hardcoded in `docker-compose.yml` for zero-dependency deployment:

#### Backend Configuration
- **JWT Secrets:** 256-bit secure keys
- **Database:** PostgreSQL with persistent storage
- **Redis:** Session management and caching
- **CORS:** Configured for both IP and domain access
- **Rate Limiting:** Applied to API endpoints

#### Frontend Configuration
- **API Base URL:** Domain-based for nginx routing
- **Environment:** Production mode
- **Build Optimization:** Minified and optimized builds

### Security Features
- **JWT Authentication:** Secure token-based auth
- **Rate Limiting:** API protection against abuse
- **CORS:** Properly configured for domain access
- **Security Headers:** Added via nginx
- **Health Checks:** All services monitored

### Monitoring & Observability

#### Prometheus Metrics
- **Backend Metrics:** Request count, latency, error rates
- **System Metrics:** CPU, memory, disk usage
- **Container Health:** Service availability monitoring
- **Custom Metrics:** Exam sessions, user activity

#### Grafana Dashboards
- **System Overview:** Resource utilization
- **Application Metrics:** API performance
- **Real-time Monitoring:** Live service status
- **Alerting:** Configurable thresholds

## 🔧 Management Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Service Management
```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend

# Stop all services
docker-compose down

# Update and rebuild
docker-compose up -d --build
```

### Database Management
```bash
# Access PostgreSQL
docker-compose exec postgres psql -U postgres -d exam_platform

# Backup database
docker-compose exec postgres pg_dump -U postgres exam_platform > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres exam_platform < backup.sql
```

## 🧪 Health Checks

### Automated Health Endpoints
- **Frontend:** `/health`
- **Backend:** `/api/health` and `/health`
- **AI Proctoring:** `/health`
- **Prometheus:** `/-/healthy`
- **Grafana:** `/api/health`

### Manual Testing
```bash
# Test frontend
curl http://localhost/health

# Test backend API
curl http://localhost/api/health

# Test metrics
curl http://localhost:9092/-/healthy
```

## 📊 Monitoring Setup

### Prometheus Targets
1. **Backend:** `backend:4005/metrics`
2. **AI Proctoring:** `ai-proctoring:8000/metrics`
3. **Node Exporter:** `node-exporter:9100/metrics`
4. **Prometheus:** `localhost:9090/metrics`

### Grafana Dashboards
Auto-provisioned dashboards include:
- **Secure Exam Platform Overview**
- **System Metrics**
- **Application Performance**
- **Real-time Monitoring**

## 🔒 Security Considerations

### Production Security
- **Strong JWT Secrets:** 256-bit keys configured
- **Database Security:** Strong password, network isolation
- **Rate Limiting:** API protection enabled
- **CORS Configuration:** Restricted to allowed origins
- **Security Headers:** XSS protection, content security policy

### Recommended Additional Security
1. **SSL/TLS:** Configure HTTPS with Let's Encrypt
2. **Firewall:** Restrict unnecessary ports
3. **Database Backup:** Automated backup strategy
4. **Log Rotation:** Prevent disk space issues
5. **Monitoring Alerts:** Set up alert notifications

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs [service-name]

# Check resource usage
docker stats

# Restart services
docker-compose restart
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready -U postgres

# Test connection
docker-compose exec backend npm run test:db
```

#### Frontend Build Issues
```bash
# Clear build cache
docker-compose build --no-cache frontend

# Check build logs
docker-compose logs frontend
```

#### Monitoring Issues
```bash
# Check Prometheus targets
curl http://localhost:9092/api/v1/targets

# Check Grafana datasource
curl http://localhost:3002/api/datasources
```

## 📈 Performance Optimization

### Database Optimization
- Connection pooling configured
- Indexes on frequently queried columns
- Query optimization implemented

### Application Performance
- Nginx reverse proxy with caching
- Gzip compression enabled
- Static asset optimization
- API rate limiting

### Monitoring Performance
- 15-second scrape intervals
- Efficient metric collection
- Optimized dashboard queries

## 🔄 Updates & Maintenance

### Application Updates
```bash
# Pull latest code
git pull

# Rebuild and deploy
docker-compose up -d --build

# Monitor deployment
docker-compose logs -f
```

### System Maintenance
```bash
# Clean up unused images
docker system prune -f

# Update base images
docker-compose pull

# Backup before major updates
./backup-database.sh
```

## 📞 Support & Documentation

### Additional Resources
- **API Documentation:** Available at `/api/docs`
- **Health Endpoints:** `/health` on all services
- **Monitoring:** Grafana dashboards provide real-time insights

### Emergency Procedures
1. **Service Recovery:** `docker-compose restart`
2. **Database Recovery:** Restore from backup
3. **Rollback:** Use git to revert changes
4. **Monitoring:** Check Grafana for issues

---

## ✅ Deployment Checklist

- [ ] Docker and Docker Compose installed
- [ ] Repository cloned on VM
- [ ] Ports 80, 443, 3005, 4005, 5005, 3002, 9092 available
- [ ] Domain DNS configured (secure-exam.duckdns.org → 4.247.154.224)
- [ ] Firewall rules configured
- [ ] Run deployment script
- [ ] Verify all services healthy
- [ ] Test application functionality
- [ ] Confirm monitoring working
- [ ] Set up backup procedures

---

**🎉 Your Secure Exam Platform is now production-ready!**
