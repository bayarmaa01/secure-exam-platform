# 🔒 Secure Exam Platform

A production-ready AI-proctored online examination system with role-based access control, real-time monitoring, and comprehensive exam management.

## 🏗️ Architecture

### Frontend (React + TypeScript + Vite)
- **UI Framework**: React 18 with TypeScript
- **Styling**: TailwindCSS for modern responsive design
- **State Management**: React Context for authentication
- **Routing**: React Router v6 with role-based protection
- **Build Tool**: Vite for fast development and production builds

### Backend (Node.js + Express + TypeScript)
- **API Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT with refresh tokens
- **Validation**: Express-validator for input sanitization
- **Security**: Helmet, CORS, rate limiting

### AI Proctoring (Python + FastAPI)
- **Framework**: FastAPI with async support
- **Computer Vision**: OpenCV for face detection
- **AI Models**: 100% free local models (no API costs)
- **Frame Processing**: Real-time video analysis
- **Privacy**: All processing done locally

### Infrastructure
- **Database**: PostgreSQL 16 with persistent volumes
- **Cache**: Redis 7 for session storage
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for local development
- **Production**: Kubernetes with Helm charts

## 🚀 Quick Start

### Prerequisites
- Docker Desktop (latest version)
- Node.js 18+ (for local development)
- Python 3.9+ (for AI proctoring development)

### Local Development

```bash
# Clone repository
git clone https://github.com/bayarmaa01/secure-exam-platform.git
cd secure-exam-platform

# Start all services
docker compose up --build

# Access applications
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000/api
# AI Proctoring: http://localhost:5001
```

### Development Commands

```bash
# Frontend development
cd frontend
npm install
npm run dev

# Backend development  
cd backend
npm install
npm run dev

# AI Proctoring development
cd ai-proctoring
pip install -r requirements-free.txt  # Use free requirements
uvicorn main-free:app --host 0.0.0.0 --port 5000 --reload
```

## 📱 Features

### 🎓 Student Features
- **Dashboard**: View available exams and recent attempts
- **Exam Room**: Secure exam interface with anti-cheating
- **Real-time Proctoring**: Webcam monitoring with free AI detection
- **Results**: View exam scores and proctoring reports
- **Navigation**: Seamless question and exam navigation

### 👨‍🏫 Teacher Features  
- **Dashboard**: Exam creation and management overview
- **Exam Creation**: Build comprehensive exams with questions
- **Question Management**: Add MCQ and text-based questions
- **Results Analysis**: View student performance and cheating scores
- **Exam Scheduling**: Set exam dates and time limits

### 🔐 Admin Features
- **User Management**: Create and manage user accounts
- **System Analytics**: Platform usage and performance metrics
- **Exam Oversight**: Monitor all platform exams
- **Security Monitoring**: View proctoring alerts and incidents
- **Database Management**: Full system administration

### 🛡️ Security Features
- **Role-Based Access**: Student, Teacher, Admin roles
- **JWT Authentication**: Secure token-based auth with refresh
- **Anti-Cheating**: Copy/paste prevention, tab detection
- **Webcam Monitoring**: Real-time free AI-powered proctoring
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: Prevent brute force attacks

### 🤖 Free AI Proctoring
- **Face Detection**: OpenCV-based face recognition (100% free)
- **Motion Tracking**: Monitor suspicious movements
- **Frame Analysis**: Real-time cheating detection
- **Alert System**: Immediate proctoring notifications
- **Risk Scoring**: Automated cheating probability scoring
- **Zero Cost**: No API fees, completely free
- **Privacy**: All processing done locally

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
PORT=4000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=exam_platform
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
REDIS_URL=redis://redis:6379
CORS_ORIGIN=http://localhost:3000
```

#### Frontend (.env)
```bash
VITE_API_URL=http://localhost:4000/api
VITE_AI_URL=http://localhost:5000
```

#### AI Proctoring (.env)
```bash
# No API keys required - uses free local models
AI_PROVIDER=local_opencv
MODEL_TYPE=free_open_source
```

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    student_id VARCHAR(50) UNIQUE,
    teacher_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Exams Table
```sql
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    scheduled_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'draft',
    teacher_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Questions Table
```sql
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    options JSONB,
    correct_answer TEXT,
    points INTEGER DEFAULT 1
);
```

## 🐳 Docker Configuration

### Multi-Stage Builds
- **Frontend**: Optimized production build with Nginx
- **Backend**: Minimal Node.js runtime with compiled TypeScript
- **AI Proctoring**: Python Alpine with required dependencies

### Service Dependencies
- **Frontend** → Depends on Backend
- **Backend** → Depends on PostgreSQL + Redis
- **AI Proctoring** → Independent service
- **PostgreSQL** → Persistent data volume
- **Redis** → In-memory cache

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration with role
- `POST /api/auth/login` - User authentication
- `POST /api/auth/refresh` - Token refresh
- `GET /api/auth/me` - Current user info

### Exams
- `GET /api/exams` - Get available exams (student)
- `POST /api/exams` - Create exam (teacher)
- `GET /api/exams/:id` - Get exam details
- `GET /api/exams/:id/questions` - Get exam questions

### Attempts
- `POST /api/attempts` - Start exam attempt
- `PUT /api/attempts/:id` - Save answers
- `POST /api/attempts/:id/submit` - Submit exam

### Admin
- `GET /api/admin/users` - User management
- `GET /api/admin/exams` - All exams overview
- `GET /api/admin/results` - Platform analytics

## 🔒 Security Considerations

### Authentication
- JWT tokens with 15-minute expiration
- Refresh tokens for extended sessions
- Role-based route protection
- Password hashing with bcrypt (10 rounds)

### Anti-Cheating
- Right-click and context menu prevention
- Copy/paste blocking in exam interface
- Tab switching detection and alerts
- Keyboard shortcut monitoring
- Full-screen exam mode enforcement

### API Security
- Express Helmet for security headers
- CORS configuration for cross-origin requests
- Rate limiting (100 requests per 15 minutes)
- Input validation and sanitization
- SQL injection prevention with parameterized queries

## 📈 Monitoring & Logging

### Application Logs
- Structured logging with timestamps
- Error tracking and reporting
- Performance metrics collection
- User activity auditing

### Proctoring Logs
- Frame capture timestamps
- Cheating detection events
- Risk score calculations
- Alert generation and notifications

## 🚀 Production Deployment

### Kubernetes Deployment
```bash
# Apply namespace and configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy applications
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ai-proctoring.yaml

# Configure ingress
kubectl apply -f k8s/ingress.yaml
```

### Helm Deployment
```bash
# Install with Helm
helm install exam-platform ./helm/exam-platform \
  --namespace exam-platform \
  --create-namespace \
  --set frontend.domain=exam.yourdomain.com \
  --set backend.domain=api.exam.yourdomain.com
```

## 🧪 Testing

### Unit Tests
```bash
# Frontend tests
cd frontend
npm run test

# Backend tests  
cd backend
npm run test

# AI Proctoring tests
cd ai-proctoring
pytest
```

### Integration Tests
```bash
# End-to-end testing
npm run test:e2e

# API testing
npm run test:api
```

## 📝 Development Guidelines

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Conventional commits for version control

### Git Workflow
1. Create feature branch from main
2. Implement changes with tests
3. Submit pull request with description
4. Code review and merge
5. Tag releases for production

## 🆓 Free AI Setup

### Quick Start with Free AI
```bash
# Use free AI proctoring (no API costs)
cd ai-proctoring
cp .env.free.example .env
pip install -r requirements-free.txt
python main-free.py

# Test the free AI
python test-free-ai.py
```

### Free AI Benefits
- **💰 Zero Cost**: No API fees ever
- **🔐 Privacy**: All processing local
- **🚀 Fast**: Sub-second processing
- **🛡️ Secure**: No data leaves your server

See [FREE-AI-SETUP.md](FREE-AI-SETUP.md) for complete guide.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the [documentation](./docs/) for detailed guides
- Review the [FAQ](./docs/FAQ.md) for common questions

---

**Built with ❤️ for secure online examinations**
