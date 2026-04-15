# Secure Exam Platform - Quick Start Guide

## Prerequisites
- Docker Desktop installed and running
- At least 8GB RAM available
- 10GB free disk space

## One-Command Deployment

```bash
docker compose up --build
```

That's it! The system will automatically:
- Build all services with multi-stage Docker builds
- Set up PostgreSQL database with proper schema
- Configure Redis for session management
- Start AI proctoring with MediaPipe face detection
- Configure monitoring with Prometheus and Grafana
- Apply proper CORS and security settings

## Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3005 | - |
| Backend API | http://localhost:4005/api/health | - |
| AI Service | http://localhost:5005/health | - |
| Grafana Dashboard | http://localhost:3002 | admin/admin123 |
| Prometheus | http://localhost:9092 | - |

## Test Flow

1. **Register a new user:**
   - Go to http://localhost:3005
   - Click "Create Account"
   - Use email: `test@student.com`
   - Password: `Test123!@#` (meets all requirements)
   - Role: Student

2. **Login:**
   - Use the same credentials
   - You'll be redirected to the student dashboard

3. **Teacher Features:**
   - Register a teacher: `test@teacher.com` / `Test123!@#`
   - Create exams and manage questions

4. **AI Proctoring:**
   - Start an exam as a student
   - Grant camera permissions
   - AI will detect faces and suspicious behavior

## Monitoring

- **Grafana Dashboard**: Real-time metrics, error rates, AI analysis
- **Prometheus**: Raw metrics collection
- **Health Checks**: All services have built-in health monitoring

## Port Configuration

All ports are standardized as requested:
- Frontend: 3005
- Backend: 4005  
- AI Service: 5005
- Grafana: 3002
- Prometheus: 9092
- PostgreSQL: 5432 (internal)
- Redis: 6379 (internal)

## Troubleshooting

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f [service-name]

# Restart services
docker compose restart

# Clean rebuild
docker compose down -v && docker compose up --build
```

## What's Fixed

- **CORS Issues**: Proper localhost:3005 configuration
- **Password Validation**: Enforces uppercase, lowercase, numbers, symbols
- **Database**: Fixed foreign key constraints with ON DELETE CASCADE
- **Frontend Registration**: Fixed UI validation and error handling
- **Logout Button**: Added to student dashboard
- **AI Detection**: Enhanced with MediaPipe for better accuracy
- **Monitoring**: Complete Prometheus/Grafana setup
- **Error Handling**: Better 500 error responses with detailed messages

## Architecture

```
Frontend (React/Vite) -> Backend (Node.js/Express) -> Database (PostgreSQL)
                      \-> AI Service (Python/FastAPI) -> Redis
                      \-> Monitoring (Prometheus/Grafana)
```

All services are containerized with health checks and proper dependencies.
