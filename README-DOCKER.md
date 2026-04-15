# 🚀 Secure Exam Platform - Docker Deployment

## 📋 Prerequisites

- Docker and Docker Compose installed
- Git repository cloned locally

## 🏃 Quick Start

```bash
# Clone and navigate to project
git clone <repository-url>
cd secure-exam-platform

# Create environment file
cp .env.example .env
# Edit .env with your values (optional for demo)

# Start everything
docker compose up --build

# Or run in background
docker compose up --build -d
```

## 🌐 Access Services

Once running, access services at:

- **Frontend**: http://localhost:3005
- **Backend API**: http://localhost:4005/api
- **AI Proctoring**: http://localhost:5005
- **Grafana**: http://localhost:3002 (admin/admin123)
- **Prometheus**: http://localhost:9092
- **Database**: localhost:5432 (postgres/postgres)
- **Redis**: localhost:6379

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Database
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=exam_platform

# Backend
JWT_SECRET=change-me-in-production-use-strong-secret-key
JWT_REFRESH_SECRET=change-refresh-in-production-use-strong-secret-key
CORS_ORIGIN=http://localhost:3005

# Frontend
REACT_APP_API_URL=http://localhost:4005/api
REACT_APP_AI_URL=http://localhost:5005

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123
```

## 🛠️ Development Commands

```bash
# Start all services
docker compose up --build

# Start specific service
docker compose up --build backend

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop all services
docker compose down

# Clean up volumes (removes all data)
docker compose down -v
```

## 🏥 Health Checks

All services include health checks:

```bash
# Check service health
docker compose ps

# Check specific service
curl http://localhost:4005/api/health  # Backend
curl http://localhost:5005/health      # AI Service
```

## 📊 Monitoring

- **Grafana Dashboard**: Pre-configured dashboards at http://localhost:3002
- **Prometheus Metrics**: http://localhost:9092
- **Service Discovery**: Automatic service discovery in Prometheus

## 🔒 Security Notes

**For Production:**
1. Change default passwords in `.env`
2. Use strong JWT secrets
3. Update CORS origins
4. Use HTTPS in production
5. Remove debug endpoints

## 🐛 Troubleshooting

### Port Conflicts
If ports are in use, modify them in `docker-compose.yml`:

```yaml
ports:
  - "3006:80"  # Change frontend to 3006
```

### Permission Issues
```bash
# Fix Docker permissions
sudo chown -R $USER:$USER .
```

### Service Won't Start
```bash
# Check logs
docker compose logs <service-name>

# Restart specific service
docker compose restart <service-name>
```

### Database Issues
```bash
# Reset database
docker compose down -v
docker compose up --build postgres
```

## 📁 Project Structure

```
secure-exam-platform/
├── docker-compose.yml          # Main orchestration
├── .env.example               # Environment template
├── frontend/                  # React app
├── backend/                   # Node.js API
├── ai-proctoring/            # Python AI service
└── monitoring/               # Grafana/Prometheus configs
    ├── grafana/
    │   ├── provisioning/
    │   └── dashboards/
    └── prometheus.yml
```

## 🚀 Production Deployment

For production deployment:

1. **Update Environment Variables**
   ```bash
   # Use strong secrets
   JWT_SECRET=<256-bit-secret>
   DB_PASSWORD=<strong-password>
   ```

2. **Enable HTTPS**
   ```bash
   # Add reverse proxy (nginx/traefik)
   # Update CORS origins
   CORS_ORIGIN=https://yourdomain.com
   ```

3. **Resource Limits**
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
       reservations:
         memory: 256M
   ```

## 🎯 Features

- ✅ **Auto-healing**: Services restart on failure
- ✅ **Health Checks**: All services monitored
- ✅ **Zero Configuration**: Works out of the box
- ✅ **Development Ready**: Hot reload included
- ✅ **Production Ready**: Security and monitoring built-in
- ✅ **Port Mapping**: All ports properly exposed
- ✅ **Service Discovery**: Internal DNS resolution
- ✅ **Data Persistence**: Database and Redis volumes
