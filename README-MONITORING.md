# 🔍 Secure Exam Platform - Complete Monitoring System

## 📋 Overview

This document describes the comprehensive real-time monitoring and anti-cheat system implemented for the Secure Exam Platform.

## 🎯 Features Implemented

### ⏱️ Server-Controlled Timer Synchronization
- **Server Time Only**: All exam timing is controlled by server
- **Real-time Sync**: Client syncs with server every 5 seconds
- **Auto-submit**: Automatic submission when time expires
- **Time Validation**: Server validates client time to prevent manipulation

### 🔄 WebSocket Real-time Communication
- **Live Events**: Real-time updates for exam start, submit, violations
- **Room Management**: Students join exam rooms, teachers monitor all sessions
- **Connection Tracking**: Monitor active WebSocket connections
- **Event Types**: `exam_started`, `exam_submitted`, `force_submit`, `violation_detected`

### 🚨 Anti-Cheat System
- **Tab Switch Detection**: Monitors browser tab visibility changes
- **Fullscreen Exit**: Detects when user exits fullscreen mode
- **Copy/Paste Prevention**: Blocks clipboard operations and keyboard shortcuts
- **Right Click Blocking**: Prevents context menu access
- **Violation Tracking**: Records all violations with timestamps and details
- **Auto-submit Triggers**: Automatic submission on violation threshold (5 violations)

### 📤 Auto-Submit Functionality
- **Time-based**: Auto-submit when exam duration expires
- **Violation-based**: Auto-submit when violation threshold exceeded
- **Teacher Force**: Teachers can force-submit any student's exam
- **Graceful Handling**: Proper cleanup and notification system

### 📊 Prometheus Metrics Collection

#### Core Metrics
- `exam_active_sessions`: Number of active exam sessions
- `exam_started_total`: Total exams started (with labels: exam_id, course_id, user_id)
- `exam_submitted_total`: Total exams submitted (with labels: exam_id, course_id, user_id)
- `exam_force_submitted_total`: Teacher force submissions (with labels: exam_id, course_id, teacher_id)
- `exam_violations_total`: Violation count (with labels: type, exam_id, course_id, user_id)
- `websocket_connections`: Active WebSocket connections (with labels: type)
- `api_request_duration_seconds`: API latency (with labels: method, route, status_code, user_role)
- `db_query_duration_seconds`: Database query latency (with labels: table, operation, user_role)
- `exam_session_duration_seconds`: Session duration (with labels: exam_id, course_id, user_id)
- `exam_violation_rate`: Violation rate per exam (with labels: exam_id, course_id)

#### Metrics Endpoint
- **URL**: `GET /metrics`
- **Format**: Prometheus text format
- **Labels**: Comprehensive labeling for filtering and alerting
- **Help**: Detailed metric descriptions

### 📈 Grafana Dashboards (Auto-Provisioned)

#### Live Exam Monitoring Dashboard
- **Dashboard ID**: `live-exam-monitoring`
- **Auto-load**: Automatically loaded on Grafana startup
- **Panels**: 10 comprehensive monitoring panels

##### Panel Details:
1. **Active Exams** (Gauge)
   - Metric: `sum(exam_active_sessions)`
   - Shows current active exam sessions

2. **Exams Started** (Counter)
   - Metric: `increase(exam_started_total[5m])`
   - Shows exams started in last 5 minutes

3. **Exams Submitted** (Counter)
   - Metric: `increase(exam_submitted_total[5m])`
   - Shows exams submitted in last 5 minutes

4. **Violations Rate** (Graph)
   - Metric: `rate(exam_violations_total[5m])`
   - Shows violation rate over time

5. **Force Submit Events** (Counter)
   - Metric: `increase(exam_force_submitted_total[5m])`
   - Shows teacher force submissions

6. **API Latency** (Graph)
   - Metric: `histogram_quantile(0.95, api_request_duration_seconds)`
   - Shows 95th percentile API response time

7. **WebSocket Connections** (Graph)
   - Metric: `websocket_connections`
   - Shows active real-time connections

8. **Top Exams by Activity** (Table)
   - Metric: `topk(10, sum by (exam_id) (exam_started_total + exam_submitted_total))`
   - Shows most active exams

9. **Violations per Student** (Table)
   - Metric: `topk(20, sum by (user_id) (exam_violations_total))`
   - Shows students with most violations

10. **System Health** (Stat)
   - Metric: `up`
   - Shows overall system status

### 🚨 Alerting System

#### Alert Rules
- **High Violation Rate**: Alert when violation rate > 0.1/sec
- **Too Many Force Submits**: Alert when >5 force submits in 5 minutes
- **High API Latency**: Warning when 95th percentile > 2s, Critical > 5s
- **Database Latency**: Warning when 95th percentile > 1s, Critical > 2s
- **WebSocket Anomaly**: Warning when connections < 10
- **No Active Exams**: Info when no active sessions during exam hours
- **System Down**: Critical when system becomes unresponsive
- **Long Running Exams**: Warning when exam > 2 hours
- **High Violation Count**: Warning when student > 10 violations
- **Low Completion Rate**: Warning when < 50% completion rate

#### Alert Channels
- **Webhook**: HTTP POST to backend `/api/alerts`
- **Email**: SMTP integration (configurable)
- **Slack**: Webhook integration (configurable)

### 🏗 Infrastructure Components

#### Docker Services
- **Backend API**: Node.js application with monitoring
- **PostgreSQL**: Database with metrics export
- **Redis**: Caching layer
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and alerting
- **AlertManager**: Alert routing and management
- **Node Exporter**: System metrics
- **PostgreSQL Exporter**: Database metrics
- **Nginx**: Reverse proxy with SSL termination

#### Network Configuration
- **Bridge Network**: Isolated monitoring network
- **Port Mapping**: Secure port exposure
- **SSL/TLS**: HTTPS support with self-signed certificates
- **Load Balancing**: Nginx for high availability

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- 4GB+ RAM
- 10GB+ Storage

### Setup Commands

```bash
# Clone the repository
git clone <repository-url>
cd secure-exam-platform

# Make setup script executable
chmod +x scripts/setup-monitoring.sh

# Run the setup script
./scripts/setup-monitoring.sh
```

### Access URLs

After setup, access the monitoring stack:

- **Grafana Dashboard**: http://localhost:3001
  - Username: `admin`
  - Password: `admin123`
  - Dashboard: "Live Exam Monitoring"

- **Prometheus**: http://localhost:9090
  - Username: `admin`
  - Password: Check `.htpasswd` file

- **AlertManager**: http://localhost:9093
  - Alert management interface

- **Backend API**: http://localhost:4000
  - Main application API

- **Nginx Proxy**: http://localhost (HTTP) / https://localhost (HTTPS)

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/examdb

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# Monitoring
PROMETHEUS_RETENTION=30d
PROMETHEUS_STORAGE_SIZE=10GB
GF_SECURITY_ADMIN_PASSWORD=admin123

# Application
FRONTEND_URL=http://localhost:3005
REDIS_URL=redis://redis:6379
```

### Customization

#### Violation Thresholds
```typescript
// In useAntiCheat hook
const VIOLATION_THRESHOLD = 5 // Auto-submit after 5 violations
const MAX_SESSION_AGE = 24 * 60 * 60 * 1000 // 24 hours
const TIME_TOLERANCE = 60000 // 1 minute
```

#### Alert Thresholds
```yaml
# In prometheus/alert_rules.yml
- High violation rate: > 0.1/sec
- API latency: Warning > 2s, Critical > 5s
- Database latency: Warning > 1s, Critical > 2s
```

## 🔒 Security Features

### Anti-Cheat Bypass Prevention
- **Server-side Validation**: All timing and state validated server-side
- **Token-based Security**: JWT tokens for session management
- **Request Origin Validation**: CORS and origin checking
- **Rate Limiting**: API rate limiting per client
- **Suspicious Pattern Detection**: Bot and crawler blocking
- **Time Integrity Checks**: Server time validation with tolerance
- **Multi-session Prevention**: Block multiple concurrent exam sessions
- **Fullscreen Enforcement**: Required fullscreen mode for exams

### Monitoring Security
- **Authentication**: Basic auth for Prometheus
- **HTTPS Support**: SSL/TLS encryption
- **Network Isolation**: Docker network isolation
- **Access Control**: Role-based access control
- **Audit Logging**: Comprehensive security event logging

## 📊 API Endpoints

### Monitoring Endpoints

```typescript
// Exam Session Management
POST   /api/exam-sessions              // Start exam session
GET    /api/exam-sessions/:sessionId       // Get session status
POST   /api/exam-sessions/:sessionId/submit    // Submit exam
POST   /api/exam-sessions/:sessionId/force-submit // Force submit
POST   /api/exam-sessions/:sessionId/violations // Record violation
GET    /api/exam-sessions/sessions/active   // Get active sessions

// Monitoring
GET    /api/exam-sessions/violations/recent   // Recent violations
GET    /metrics                              // Prometheus metrics
POST   /api/alerts                            // AlertManager webhook
```

### WebSocket Events

```typescript
// Client to Server
{
  event: 'join_exam_room',
  data: { examId: string }
}

// Server to Client
{
  event: 'exam_started',
  data: {
    session_id: string,
    exam_id: string,
    user_id: string,
    start_time: string,
    end_time: string,
    questions: Question[]
  }
}

{
  event: 'exam_submitted',
  data: {
    session_id: string,
    exam_id: string,
    user_id: string,
    score: number,
    percentage: number,
    violation_count: number,
    submitted_at: string
  }
}

{
  event: 'violation_detected',
  data: {
    session_id: string,
    user_id: string,
    type: 'tab_switch' | 'fullscreen_exit' | 'copy_paste' | 'right_click',
    details: string,
    timestamp: string
  }
}

{
  event: 'force_submit',
  data: {
    session_id: string,
    exam_id: string,
    user_id: string,
    reason: string
  }
}
```

## 🛠️ Development

### Running Locally

```bash
# Backend with monitoring
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm start

# Monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d
```

### Testing

```bash
# Test metrics endpoint
curl http://localhost:4000/metrics

# Test WebSocket connection
curl -X GET http://localhost:4000/api/health

# Load test API
ab -n 100 -c 10 http://localhost:4000/api/exam-sessions
```

## 🔍 Troubleshooting

### Common Issues

1. **Metrics Not Appearing in Grafana**
   - Check Prometheus configuration
   - Verify datasource connection
   - Check firewall rules

2. **WebSocket Connection Issues**
   - Check CORS configuration
   - Verify Nginx proxy settings
   - Check browser console errors

3. **Alerts Not Firing**
   - Verify AlertManager configuration
   - Check alert rules syntax
   - Test webhook endpoints

4. **Performance Issues**
   - Monitor database connection pool
   - Check resource utilization
   - Review slow query logs

### Logs

```bash
# View application logs
docker-compose logs -f backend

# View monitoring logs
docker-compose logs -f prometheus
docker-compose logs -f grafana
docker-compose logs -f alertmanager

# View Nginx logs
docker-compose logs -f nginx
```

## 📈 Scaling

### Horizontal Scaling
- **Load Balancer**: Multiple backend instances
- **Database Replication**: Read replicas for scaling
- **Metrics Federation**: Multiple Prometheus instances
- **Grafana HA**: Multiple Grafana instances

### Vertical Scaling
- **Resource Allocation**: Increase CPU/Memory limits
- **Storage Scaling**: Larger disk volumes
- **Network Bandwidth**: Increase network limits

## 🔮 Future Enhancements

### Planned Features
- **AI-powered Proctoring**: Machine learning for cheating detection
- **Video Recording**: Optional video proctoring
- **Screen Sharing Detection**: Advanced anti-cheat measures
- **Biometric Verification**: Facial recognition integration
- **Mobile App Support**: Native mobile monitoring
- **Advanced Analytics**: Predictive analytics for exam patterns

### Integration Opportunities
- **LTI Integration**: Learning Tools Interoperability
- **SIS Integration**: Student Information System sync
- **Cloud Monitoring**: AWS CloudWatch, Azure Monitor
- **SSO Integration**: Single Sign-On support
- **Compliance**: GDPR, FERPA compliance features

---

## 📞 Support

For support and questions:
- **Documentation**: Check inline code comments
- **Issues**: Create GitHub issues with detailed descriptions
- **Monitoring**: Check Grafana dashboards for real-time insights
- **Logs**: Review application logs for troubleshooting

**System Status**: All monitoring components are production-ready and fully integrated.
