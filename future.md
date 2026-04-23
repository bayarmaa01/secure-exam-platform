# Production-Ready Multi-Tenant SaaS Transformation Guide

## 1. Production Architecture Overview

### Target Architecture: Multi-Tenant SaaS Platform

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client        │    │   Nginx          │    │   Backend       │
│   (Browser)     │───▶│   (Reverse      │───▶│   (Node.js)     │
│                 │    │    Proxy)        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────┐         ┌─────────────┐
                       │   SSL/TLS   │         │ PostgreSQL  │
                       │ (HTTPS)     │         │ (Multi-tenant)│
                       └─────────────┘         └─────────────┘
                                                       │
                              ┌───────────────────────┼───────────────────────┐
                              ▼                       ▼                       ▼
                       ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
                       │    Redis    │         │  AI Service │         │  Prometheus │
                       │   (Cache)   │         │ (FastAPI)   │         │ (Metrics)   │
                       └─────────────┘         └─────────────┘         └─────────────┘
```

### Subdomain-Based Routing Concept

- **tenant1.examplatform.com** → Organization 1
- **tenant2.examplatform.com** → Organization 2  
- **tenant3.examplatform.com** → Organization 3

Each subdomain maps to a specific organization with complete data isolation.

## 2. Multi-Tenant Implementation

### Nginx Configuration

**File: `./nginx/nginx.conf`**

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
    
    # Upstream servers
    upstream backend {
        server backend:4005;
    }
    
    upstream frontend {
        server frontend:3000;
    }
    
    upstream ai_service {
        server ai-proctoring:8000;
    }
    
    # Main server block with wildcard subdomain
    server {
        listen 80;
        server_name *.examplatform.com examplatform.com;
        
        # Redirect HTTP to HTTPS
        return 301 https://$host$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name *.examplatform.com examplatform.com;
        
        # SSL certificates (wildcard)
        ssl_certificate /etc/letsencrypt/live/examplatform.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/examplatform.com/privkey.pem;
        
        # Extract subdomain for routing
        set $tenant "";
        if ($host ~* ^(?<subdomain>[^.]+)\.examplatform\.com$) {
            set $tenant $subdomain;
        }
        
        # Add tenant header for backend
        proxy_set_header X-Tenant-ID $tenant;
        
        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend API routes with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Tenant-ID $tenant;
        }
        
        # Auth endpoints with stricter rate limiting
        location /api/auth/ {
            limit_req zone=auth burst=10 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Tenant-ID $tenant;
        }
        
        # AI service routes
        location /api/ai/ {
            proxy_pass http://ai_service/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Tenant-ID $tenant;
        }
        
        # Health checks
        location /health {
            proxy_pass http://backend/health;
            access_log off;
        }
        
        # Static files
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### Backend Middleware for Multi-Tenancy

**File: `backend/src/middleware/tenant.ts`**

```typescript
import { Request, Response, NextFunction } from 'express'
import { pool } from '../db'

export interface TenantRequest extends Request {
  tenant?: {
    id: string
    name: string
    subdomain: string
  }
}

export async function tenantMiddleware(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const tenantId = req.headers['x-tenant-id'] as string
    const subdomain = req.headers['x-tenant-id'] as string
    
    if (!tenantId && !subdomain) {
      return res.status(400).json({ message: 'Tenant identifier required' })
    }
    
    // Get tenant from database
    const tenantResult = await pool.query(
      'SELECT id, name, subdomain FROM organizations WHERE subdomain = $1 OR id = $2',
      [subdomain, tenantId]
    )
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ message: 'Tenant not found' })
    }
    
    req.tenant = tenantResult.rows[0]
    
    // Set tenant context for database queries
    req.app.set('tenant', req.tenant)
    
    next()
  } catch (error) {
    console.error('Tenant middleware error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

// Enhanced query builder for tenant isolation
export function buildTenantQuery(baseQuery: string, tenantId: string): string {
  return baseQuery.replace(/FROM (\w+)/g, `FROM $1 WHERE organization_id = '${tenantId}'`)
}
```

### Database Schema Updates

**File: `backend/src/migrations/multi-tenant.sql`**

```sql
-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    max_users INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true
);

-- Add organization_id to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE results ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE proctoring_violations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_courses_organization_id ON courses(organization_id);
CREATE INDEX IF NOT EXISTS idx_exams_organization_id ON exams(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_organization_id ON enrollments(organization_id);

-- Update existing records (migration step)
UPDATE users SET organization_id = (SELECT id FROM organizations WHERE subdomain = 'default') WHERE organization_id IS NULL;
UPDATE courses SET organization_id = (SELECT id FROM organizations WHERE subdomain = 'default') WHERE organization_id IS NULL;
-- ... similar updates for other tables

-- Row Level Security (RLS) for data isolation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tenant_isolation_users ON users
    FOR ALL TO authenticated_user
    USING (organization_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_courses ON courses
    FOR ALL TO authenticated_user
    USING (organization_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_exams ON exams
    FOR ALL TO authenticated_user
    USING (organization_id = current_setting('app.current_tenant_id')::UUID);
```

### Example Queries Before/After

**Before (Single Tenant):**
```sql
SELECT * FROM users WHERE email = $1;
SELECT * FROM courses WHERE teacher_id = $1;
SELECT * FROM exams WHERE course_id = $1;
```

**After (Multi-Tenant):**
```sql
SELECT * FROM users WHERE email = $1 AND organization_id = $2;
SELECT * FROM courses WHERE teacher_id = $1 AND organization_id = $2;
SELECT * FROM exams WHERE course_id = $1 AND organization_id = $2;
```

## 3. Domain & DNS Setup

### DuckDNS vs Real Domain

**Option 1: DuckDNS (Free for Development)**
```bash
# Install duckdns
curl https://raw.githubusercontent.com/linuxserver/docker-duckdns/master/init > /etc/init.d/duckdns
chmod +x /etc/init.d/duckdns

# Configure
echo "domains=subdomain1.duckdns.org,subdomain2.duckdns.org" > /etc/duckdns/duck.conf
echo "token=your-duckdns-token" >> /etc/duckdns/duck.conf
echo "silent=true" >> /etc/duckdns/duck.conf

# Start service
/etc/init.d/duckdns start
```

**Option 2: Real Domain (Production)**
```bash
# Name server configuration
ns1.examplatform.com A 192.168.1.100
ns2.examplatform.com A 192.168.1.101

# Wildcard subdomain
*.examplatform.com A 192.168.1.100
```

### Wildcard Subdomain Setup

**DNS Records:**
```
A    examplatform.com      192.168.1.100
A    *.examplatform.com    192.168.1.100
MX   examplatform.com      mail.examplatform.com
TXT  examplatform.com      "v=spf1 mx -all"
```

## 4. SSL / HTTPS Setup

### Certbot + Let's Encrypt Setup

**Installation:**
```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get wildcard certificate
sudo certbot certonly --manual --preferred-challenges dns -d *.examplatform.com -d examplatform.com
```

**DNS Challenge for Wildcard:**
```
Please deploy a DNS TXT record under the name:
_acme-challenge.examplatform.com

with the following value:
abcdef1234567890abcdef1234567890abcdef1234567890.examplatform.com
```

### Enable HTTPS in Nginx

**File: `./nginx/nginx.conf` (SSL Section)**
```nginx
server {
    listen 443 ssl http2;
    server_name *.examplatform.com examplatform.com;
    
    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/examplatform.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/examplatform.com/privkey.pem;
    
    # SSL hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # ... rest of configuration
}
```

## 5. Docker & Deployment Changes

### Updated docker-compose.yml

**File: `./docker-compose.yml`**

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - frontend
      - backend
      - ai-proctoring
    restart: unless-stopped
    networks:
      - exam-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
      args:
        VITE_API_URL: https://examplatform.com/api
        VITE_AI_URL: https://examplatform.com/api/ai
        VITE_ENVIRONMENT: production
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    networks:
      - exam-network
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      NODE_ENV: production
      PORT: '4005'
      DB_HOST: postgres
      DB_NAME: exam_platform
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      FRONTEND_URL: https://examplatform.com
      ALLOWED_ORIGINS: https://examplatform.com,https://*.examplatform.com
      AI_SERVICE_URL: http://ai-proctoring:8000
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - exam-network
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: exam_platform
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    networks:
      - exam-network
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - exam-network

  ai-proctoring:
    build:
      context: ./ai-proctoring
      dockerfile: Dockerfile.prod
    environment:
      PYTHONPATH: /app
      MODEL_PATH: /app/models
      REDIS_URL: redis://redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    depends_on:
      - redis
    restart: unless-stopped
    networks:
      - exam-network
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G

  prometheus:
    image: prom/prometheus:latest
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --web.enable-lifecycle
      - --storage.tsdb.retention.time=30d
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped
    networks:
      - exam-network

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    restart: unless-stopped
    networks:
      - exam-network

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  exam-network:
    driver: bridge
```

### Production Dockerfiles

**File: `./backend/Dockerfile.prod`**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN npm run build
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4005

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4005/health || exit 1

CMD ["node", "dist/index.js"]
```

**File: `./frontend/Dockerfile.prod`**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL
ARG VITE_AI_URL
ARG VITE_ENVIRONMENT
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AI_URL=$VITE_AI_URL
ENV VITE_ENVIRONMENT=$VITE_ENVIRONMENT

RUN npm run build

FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables

**File: `.env.production`**
```bash
# Database
DB_PASSWORD=SecureExamPlatform2024!Production

# Authentication
JWT_SECRET=SecureExamPlatformJWTSecret2024!ProductionKey256BitsMinimum
JWT_REFRESH_SECRET=SecureExamPlatformRefreshSecret2024!ProductionKey256BitsMinimum

# Redis
REDIS_PASSWORD=SecureRedis2024!

# Grafana
GRAFANA_PASSWORD=SecureGrafanaAdmin2024!

# SSL
SSL_EMAIL=admin@examplatform.com
```

## 6. Monitoring Completion

### Fix Prometheus Metrics in Backend

**File: `backend/src/metrics.ts`**
```typescript
import { collectDefaultMetrics, register, Counter, Histogram, Gauge } from 'prom-client'

// Enable collection of default metrics
collectDefaultMetrics({ register })

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  registers: [register]
})

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  registers: [register]
})

export const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Number of active users',
  labelNames: ['tenant_id'],
  registers: [register]
})

export const examSubmissions = new Counter({
  name: 'exam_submissions_total',
  help: 'Total number of exam submissions',
  labelNames: ['tenant_id', 'status'],
  registers: [register]
})

// Metrics endpoint
export function metricsHandler(req: Request, res: Response) {
  res.set('Content-Type', register.contentType)
  res.end(register.metrics())
}
```

**File: `backend/src/index.ts` (Add metrics route)**
```typescript
import { metricsHandler } from './metrics'

// Add metrics endpoint
app.get('/metrics', metricsHandler)
```

### Nginx Metrics Exporter

**File: `./docker-compose.yml` (Add nginx-exporter)**
```yaml
  nginx-exporter:
    image: nginx/nginx-prometheus-exporter:latest
    container_name: nginx-exporter
    ports:
      - "9113:9113"
    command:
      - -nginx.scrape-uri=http://nginx:80/nginx_status
    depends_on:
      - nginx
    restart: unless-stopped
    networks:
      - exam-network
```

**File: `./nginx/nginx.conf` (Add status endpoint)**
```nginx
server {
    listen 80;
    server_name localhost;
    
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
    }
}
```

### Prometheus Configuration

**File: `./monitoring/prometheus.yml`**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['backend:4005']
    metrics_path: '/metrics'
    scrape_interval: 15s

  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx-exporter:9113']
    scrape_interval: 15s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 15s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 15s

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 15s
```

### Grafana Dashboard Connection

**File: `./monitoring/grafana/datasources/prometheus.yml`**
```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

## 7. LMS Integration

### What is LMS (Learning Management System)

LMS is a software application for administration, documentation, tracking, reporting, and delivery of educational courses and training programs. Popular LMS platforms include Moodle, Canvas, Blackboard, and Google Classroom.

### Moodle Integration Example

**File: `backend/src/routes/lms.ts`**
```typescript
import { Router } from 'express'
import { auth, AuthRequest, requireTeacher } from '../middleware/auth'
import { pool } from '../db'

const router = Router()

// Moodle Web Service API Client
class MoodleClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  async getUsers(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/webservice/rest/server.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        wstoken: this.token,
        wsfunction: 'core_user_get_users',
        moodlewsrestformat: 'json',
        criteria: JSON.stringify([{ key: 'email', value: '%' }])
      })
    })
    return response.json()
  }

  async getCourses(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/webservice/rest/server.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        wstoken: this.token,
        wsfunction: 'core_course_get_courses',
        moodlewsrestformat: 'json'
      })
    })
    return response.json()
  }

  async getEnrollments(courseId: string): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/webservice/rest/server.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        wstoken: this.token,
        wsfunction: 'core_enrol_get_enrolled_users',
        moodlewsrestformat: 'json',
        courseid: courseId
      })
    })
    return response.json()
  }
}

// Sync users from LMS
router.post('/sync/users', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const { lmsUrl, lmsToken } = req.body
    const moodle = new MoodleClient(lmsUrl, lmsToken)
    
    const lmsUsers = await moodle.getUsers()
    
    for (const lmsUser of lmsUsers) {
      // Check if user exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND organization_id = $2',
        [lmsUser.email, req.tenant?.id]
      )
      
      if (existingUser.rows.length === 0) {
        // Create new user
        await pool.query(
          `INSERT INTO users (email, name, role, organization_id, lms_id)
           VALUES ($1, $2, 'student', $3, $4)`,
          [lmsUser.email, `${lmsUser.firstname} ${lmsUser.lastname}`, req.tenant?.id, lmsUser.id]
        )
      }
    }
    
    res.json({ message: 'Users synced successfully', count: lmsUsers.length })
  } catch (error) {
    console.error('LMS sync error:', error)
    res.status(500).json({ message: 'Sync failed' })
  }
})

// Sync courses from LMS
router.post('/sync/courses', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const { lmsUrl, lmsToken } = req.body
    const moodle = new MoodleClient(lmsUrl, lmsToken)
    
    const lmsCourses = await moodle.getCourses()
    
    for (const lmsCourse of lmsCourses) {
      const existingCourse = await pool.query(
        'SELECT id FROM courses WHERE lms_id = $1 AND organization_id = $2',
        [lmsCourse.id, req.tenant?.id]
      )
      
      if (existingCourse.rows.length === 0) {
        await pool.query(
          `INSERT INTO courses (name, description, teacher_id, organization_id, lms_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [lmsCourse.fullname, lmsCourse.summary, req.user!.id, req.tenant?.id, lmsCourse.id]
        )
      }
    }
    
    res.json({ message: 'Courses synced successfully', count: lmsCourses.length })
  } catch (error) {
    console.error('LMS sync error:', error)
    res.status(500).json({ message: 'Sync failed' })
  }
})

// Sync enrollments from LMS
router.post('/sync/enrollments', auth, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const { lmsUrl, lmsToken, courseId } = req.body
    const moodle = new MoodleClient(lmsUrl, lmsToken)
    
    const enrollments = await moodle.getEnrollments(courseId)
    
    for (const enrollment of enrollments) {
      // Find local user and course
      const userResult = await pool.query(
        'SELECT id FROM users WHERE lms_id = $1 AND organization_id = $2',
        [enrollment.id, req.tenant?.id]
      )
      
      const courseResult = await pool.query(
        'SELECT id FROM courses WHERE lms_id = $1 AND organization_id = $2',
        [courseId, req.tenant?.id]
      )
      
      if (userResult.rows.length > 0 && courseResult.rows.length > 0) {
        // Create enrollment
        await pool.query(
          `INSERT INTO enrollments (student_id, course_id, organization_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (student_id, course_id) DO NOTHING`,
          [userResult.rows[0].id, courseResult.rows[0].id, req.tenant?.id]
        )
      }
    }
    
    res.json({ message: 'Enrollments synced successfully', count: enrollments.length })
  } catch (error) {
    console.error('LMS sync error:', error)
    res.status(500).json({ message: 'Sync failed' })
  }
})

export default router
```

### API-Based Sync Flow

1. **Authentication**: Connect to LMS using API token
2. **User Sync**: Import users from LMS to local database
3. **Course Sync**: Import courses from LMS to local database  
4. **Enrollment Sync**: Import student enrollments from LMS
5. **Exam Mapping**: Map LMS courses to local exams
6. **Result Sync**: Export exam results back to LMS

## 8. LTI Integration (IMPORTANT)

### What is LTI (Learning Tools Interoperability)

LTI is a standard developed by IMS Global Learning Consortium that enables learning tools to be integrated with learning management systems. It provides secure authentication and data exchange between the LMS and external tools.

### LTI Login Flow

```
1. User clicks exam link in LMS
2. LMS generates LTI launch request with OAuth signature
3. LMS redirects to exam platform with LTI parameters
4. Exam platform validates OAuth signature
5. Exam platform creates/updates user session
6. User is redirected to exam dashboard
7. Exam results are sent back to LMS via grade passback
```

### LTI Backend Implementation

**File: `backend/src/routes/lti.ts`**
```typescript
import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import crypto from 'crypto'
import { pool } from '../db'
import { authService } from '../services/auth'

const router = Router()

// LTI Configuration
interface LTIConfig {
  consumerKey: string
  consumerSecret: string
  oauthSignatureMethod: string
}

// LTI Launch Endpoint
router.post('/lti/launch', [
  body('lti_message_type').equals('basic-lti-launch-request'),
  body('lti_version').equals('LTI-1p0'),
  body('oauth_consumer_key').notEmpty(),
  body('oauth_signature').notEmpty(),
  body('oauth_timestamp').notEmpty(),
  body('oauth_nonce').notEmpty(),
  body('user_id').notEmpty(),
  body('context_id').notEmpty(),
  body('lis_person_name_full').optional(),
  body('lis_person_contact_email_primary').optional(),
  body('roles').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    // Validate OAuth signature
    const isValid = await validateLTISignature(req.body)
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid LTI signature' })
    }

    const {
      user_id: ltiUserId,
      context_id: ltiCourseId,
      lis_person_name_full: fullName,
      lis_person_contact_email_primary: email,
      roles: ltiRoles,
      custom_exam_id: examId,
      launch_presentation_return_url: returnUrl
    } = req.body

    // Determine user role from LTI roles
    const role = determineRole(ltiRoles)

    // Find or create user
    let user
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE lti_user_id = $1 AND organization_id = $2',
      [ltiUserId, req.tenant?.id]
    )

    if (existingUser.rows.length > 0) {
      user = existingUser.rows[0]
    } else {
      // Create new user
      const newUser = await pool.query(
        `INSERT INTO users (email, name, role, lti_user_id, organization_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [email || `${ltiUserId}@lti.local`, fullName || `LTI User ${ltiUserId}`, role, ltiUserId, req.tenant?.id]
      )
      user = newUser.rows[0]
    }

    // Find or create course
    let course
    const existingCourse = await pool.query(
      'SELECT * FROM courses WHERE lti_context_id = $1 AND organization_id = $2',
      [ltiCourseId, req.tenant?.id]
    )

    if (existingCourse.rows.length > 0) {
      course = existingCourse.rows[0]
    } else {
      // Create new course
      const newCourse = await pool.query(
        `INSERT INTO courses (name, teacher_id, lti_context_id, organization_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [`LTI Course ${ltiCourseId}`, user.id, ltiCourseId, req.tenant?.id]
      )
      course = newCourse.rows[0]
    }

    // Create enrollment if needed
    if (role === 'student') {
      await pool.query(
        `INSERT INTO enrollments (student_id, course_id, organization_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (student_id, course_id) DO NOTHING`,
        [user.id, course.id, req.tenant?.id]
      )
    }

    // Generate JWT tokens
    const tokens = await authService.generateTokens(user)

    // Create session
    await pool.query(
      `INSERT INTO lti_sessions (user_id, lti_user_id, course_id, exam_id, return_url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [user.id, ltiUserId, course.id, examId, returnUrl]
    )

    // Redirect to appropriate dashboard
    let redirectUrl
    if (examId) {
      redirectUrl = `/exam/${examId}`
    } else if (role === 'teacher') {
      redirectUrl = '/teacher-dashboard'
    } else {
      redirectUrl = '/student-dashboard'
    }

    res.json({
      success: true,
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      redirectUrl
    })

  } catch (error) {
    console.error('LTI launch error:', error)
    res.status(500).json({ message: 'LTI launch failed' })
  }
})

// LTI Grade Passback
router.post('/lti/gradeback', async (req, res) => {
  try {
    const { userId, examId, score, maxScore } = req.body

    // Get LTI session info
    const session = await pool.query(
      `SELECT ls.*, l.outcome_service_url 
       FROM lti_sessions ls
       JOIN lti_config l ON ls.organization_id = l.organization_id
       WHERE ls.user_id = $1 AND ls.exam_id = $2`,
      [userId, examId]
    )

    if (session.rows.length === 0) {
      return res.status(404).json({ message: 'LTI session not found' })
    }

    const ltiSession = session.rows[0]

    // Send grade to LMS
    const gradeSent = await sendGradeToLMS({
      sourcedid: `${userId}_${examId}`,
      score: score / maxScore,
      outcomeServiceUrl: ltiSession.outcome_service_url
    })

    if (gradeSent) {
      res.json({ success: true, message: 'Grade sent to LMS' })
    } else {
      res.status(500).json({ message: 'Failed to send grade to LMS' })
    }

  } catch (error) {
    console.error('LTI gradeback error:', error)
    res.status(500).json({ message: 'Grade passback failed' })
  }
})

// Helper Functions
function determineRole(ltiRoles: string): 'student' | 'teacher' | 'admin' {
  const roles = ltiRoles.toLowerCase()
  if (roles.includes('instructor') || roles.includes('faculty')) {
    return 'teacher'
  } else if (roles.includes('administrator')) {
    return 'admin'
  } else {
    return 'student'
  }
}

async function validateLTISignature(body: any): Promise<boolean> {
  try {
    // Get LTI config for tenant
    const config = await pool.query(
      'SELECT consumer_key, consumer_secret FROM lti_config WHERE organization_id = $1',
      [req.tenant?.id]
    )

    if (config.rows.length === 0) {
      return false
    }

    const { consumer_key, consumer_secret } = config.rows[0]

    // Validate consumer key
    if (body.oauth_consumer_key !== consumer_key) {
      return false
    }

    // Build base string for signature validation
    const baseString = buildOAuthBaseString(body)
    const expectedSignature = crypto
      .createHmac('sha1', consumer_secret)
      .update(baseString)
      .digest('base64')

    return body.oauth_signature === expectedSignature
  } catch (error) {
    console.error('Signature validation error:', error)
    return false
  }
}

function buildOAuthBaseString(body: any): string {
  // Implementation of OAuth base string construction
  // This is simplified - real implementation needs proper URL encoding
  const params = new URLSearchParams()
  
  // Add all OAuth and LTI parameters except signature
  Object.keys(body).forEach(key => {
    if (key !== 'oauth_signature') {
      params.append(key, body[key])
    }
  })

  return `${body.oauth_method}&${encodeURIComponent(body.url)}&${encodeURIComponent(params.toString())}`
}

async function sendGradeToLMS(gradeData: any): Promise<boolean> {
  try {
    // Implementation of LTI grade passback
    // This would use XML-RPC or REST to send grades to LMS
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
        <imsx_POXHeader>
          <imsx_POXBody>
            <replaceResultRequest>
              <resultRecord>
                <sourcedGUID>${gradeData.sourcedid}</sourcedGUID>
                <result>
                  <resultScore>
                    <language>en</language>
                    <textString>${gradeData.score}</textString>
                  </resultScore>
                </result>
              </resultRecord>
            </replaceResultRequest>
          </imsx_POXBody>
        </imsx_POXHeader>
      </imsx_POXEnvelopeRequest>
    `

    const response = await fetch(gradeData.outcomeServiceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xml
    })

    return response.ok
  } catch (error) {
    console.error('Grade passback error:', error)
    return false
  }
}

export default router
```

### LTI Database Schema

**File: `backend/src/migrations/lti.sql`**
```sql
-- LTI Configuration
CREATE TABLE IF NOT EXISTS lti_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    consumer_key VARCHAR(255) NOT NULL,
    consumer_secret VARCHAR(255) NOT NULL,
    outcome_service_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LTI Sessions
CREATE TABLE IF NOT EXISTS lti_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lti_user_id VARCHAR(255) NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    return_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add LTI fields to existing tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS lti_user_id VARCHAR(255);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS lti_context_id VARCHAR(255);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS lti_resource_link_id VARCHAR(255);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lti_sessions_user_id ON lti_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lti_sessions_course_id ON lti_sessions(course_id);
```

### Example LTI Launch Request

```http
POST /api/lti/launch HTTP/1.1
Host: tenant1.examplatform.com
Content-Type: application/x-www-form-urlencoded

lti_message_type=basic-lti-launch-request&lti_version=LTI-1p0&oauth_consumer_key=tenant1_key&oauth_signature=abcdef123456&oauth_timestamp=1640995200&oauth_nonce=unique123&user_id=student123&context_id=course456&lis_person_name_full=John+Doe&lis_person_contact_email_primary=john@university.edu&roles=Student&custom_exam_id=exam789
```

### Example LTI Response

```json
{
  "success": true,
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "def50200f3b8b1e6e8e8e8e8e8e8e8e8e8e8e8e8"
  },
  "user": {
    "id": "user-uuid",
    "email": "john@university.edu",
    "name": "John Doe",
    "role": "student"
  },
  "redirectUrl": "/exam/exam789"
}
```

## 9. SaaS Model

### Organization Onboarding Flow

**File: `backend/src/routes/saas.ts`**
```typescript
import { Router } from 'express'
import { body, validationResult } from 'express-validator'
import { pool } from '../db'
import { authService } from '../services/auth'

const router = Router()

// Create new organization (tenant)
router.post('/organizations', [
  body('name').notEmpty().withMessage('Organization name is required'),
  body('subdomain').isAlphanumeric().withMessage('Subdomain must be alphanumeric'),
  body('adminEmail').isEmail().withMessage('Valid admin email required'),
  body('adminName').notEmpty().withMessage('Admin name is required'),
  body('adminPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('plan').isIn(['basic', 'professional', 'enterprise']).withMessage('Invalid plan')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { name, subdomain, adminEmail, adminName, adminPassword, plan } = req.body

    // Check if subdomain is available
    const existingSubdomain = await pool.query(
      'SELECT id FROM organizations WHERE subdomain = $1',
      [subdomain]
    )

    if (existingSubdomain.rows.length > 0) {
      return res.status(400).json({ message: 'Subdomain already taken' })
    }

    // Start transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Create organization
      const orgResult = await client.query(
        `INSERT INTO organizations (name, subdomain, subscription_plan, max_users, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, subdomain, plan, getMaxUsersForPlan(plan), true]
      )

      const organization = orgResult.rows[0]

      // Create admin user
      const hashedPassword = await authService.hashPassword(adminPassword)
      const userResult = await client.query(
        `INSERT INTO users (email, name, password, role, organization_id, is_active)
         VALUES ($1, $2, $3, 'admin', $4, $5)
         RETURNING id, email, name, role, organization_id`,
        [adminEmail, adminName, hashedPassword, organization.id, true]
      )

      const adminUser = userResult.rows[0]

      // Create default settings
      await client.query(
        `INSERT INTO organization_settings (organization_id, settings)
         VALUES ($1, $2)`,
        [organization.id, getDefaultSettings(plan)]
      )

      // Generate tokens for admin
      const tokens = await authService.generateTokens(adminUser)

      await client.query('COMMIT')

      // Send welcome email
      await sendWelcomeEmail(adminEmail, adminName, subdomain, plan)

      res.status(201).json({
        success: true,
        organization: {
          id: organization.id,
          name: organization.name,
          subdomain: organization.subdomain,
          plan: organization.subscription_plan
        },
        admin: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role
        },
        tokens,
        setupUrl: `https://${subdomain}.examplatform.com/setup`
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Organization creation error:', error)
    res.status(500).json({ message: 'Failed to create organization' })
  }
})

// Get organization details
router.get('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count,
              (SELECT COUNT(*) FROM courses WHERE organization_id = o.id) as course_count,
              (SELECT COUNT(*) FROM exams WHERE organization_id = o.id) as exam_count
       FROM organizations o
       WHERE o.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Organization not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Get organization error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Update organization plan
router.put('/organizations/:id/plan', [
  body('plan').isIn(['basic', 'professional', 'enterprise']).withMessage('Invalid plan')
], async (req, res) => {
  try {
    const { id } = req.params
    const { plan } = req.body

    const result = await pool.query(
      `UPDATE organizations 
       SET subscription_plan = $1, max_users = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [plan, getMaxUsersForPlan(plan), id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Organization not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Update plan error:', error)
    res.status(500).json({ message: 'Failed to update plan' })
  }
})

// Helper Functions
function getMaxUsersForPlan(plan: string): number {
  switch (plan) {
    case 'basic': return 100
    case 'professional': return 1000
    case 'enterprise': return 10000
    default: return 100
  }
}

function getDefaultSettings(plan: string): object {
  return {
    features: {
      ltiIntegration: plan !== 'basic',
      lmsSync: plan !== 'basic',
      advancedAnalytics: plan === 'enterprise',
      customBranding: plan !== 'basic',
      apiAccess: plan !== 'basic',
      prioritySupport: plan === 'enterprise'
    },
    limits: {
      examsPerMonth: plan === 'basic' ? 50 : plan === 'professional' ? 500 : -1,
      storageGB: plan === 'basic' ? 10 : plan === 'professional' ? 100 : 1000,
      aiProctoringMinutes: plan === 'basic' ? 1000 : plan === 'professional' ? 10000 : -1
    }
  }
}

async function sendWelcomeEmail(email: string, name: string, subdomain: string, plan: string) {
  // Implementation of welcome email
  console.log(`Welcome email sent to ${email} for ${subdomain}.${plan}`)
}

export default router
```

### Data Isolation Implementation

**File: `backend/src/services/tenantService.ts`**
```typescript
import { pool } from '../db'

export class TenantService {
  // Create tenant-specific database connection
  static async getTenantConnection(tenantId: string) {
    const client = await pool.connect()
    
    // Set tenant context for RLS
    await client.query('SET app.current_tenant_id = $1', [tenantId])
    
    return client
  }

  // Isolate data by tenant in all queries
  static async queryWithTenant(tenantId: string, query: string, params?: any[]) {
    const client = await this.getTenantConnection(tenantId)
    
    try {
      const result = await client.query(query, params)
      return result
    } finally {
      client.release()
    }
  }

  // Check tenant limits
  static async checkTenantLimits(tenantId: string, resource: string, count: number = 1): Promise<boolean> {
    const tenant = await pool.query(
      'SELECT subscription_plan, max_users FROM organizations WHERE id = $1',
      [tenantId]
    )

    if (tenant.rows.length === 0) {
      return false
    }

    const { subscription_plan, max_users } = tenant.rows[0]

    switch (resource) {
      case 'users':
        const userCount = await pool.query(
          'SELECT COUNT(*) as count FROM users WHERE organization_id = $1',
          [tenantId]
        )
        return (parseInt(userCount.rows[0].count) + count) <= max_users

      case 'exams':
        const examLimit = this.getExamLimitForPlan(subscription_plan)
        if (examLimit === -1) return true // Unlimited

        const examCount = await pool.query(
          'SELECT COUNT(*) as count FROM exams WHERE organization_id = $1 AND created_at >= date_trunc(\'month\', CURRENT_DATE)',
          [tenantId]
        )
        return (parseInt(examCount.rows[0].count) + count) <= examLimit

      default:
        return true
    }
  }

  private static getExamLimitForPlan(plan: string): number {
    switch (plan) {
      case 'basic': return 50
      case 'professional': return 500
      case 'enterprise': return -1 // Unlimited
      default: return 50
    }
  }
}
```

## 10. Security Improvements

### Enhanced JWT Handling

**File: `backend/src/services/jwtService.ts`**
```typescript
import jwt from 'jsonwebtoken'
import { pool } from '../db'

export class JWTService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m'
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'
  private static readonly ALGORITHM = 'RS256'

  // Generate key pair for production
  static generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    return { publicKey, privateKey }
  }

  // Generate access token
  static generateAccessToken(payload: any): string {
    return jwt.sign(payload, process.env.JWT_PRIVATE_KEY!, {
      algorithm: this.ALGORITHM,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'examplatform.com',
      audience: payload.tenantId || 'global'
    })
  }

  // Generate refresh token
  static generateRefreshToken(payload: any): string {
    return jwt.sign(payload, process.env.JWT_REFRESH_PRIVATE_KEY!, {
      algorithm: this.ALGORITHM,
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'examplatform.com',
      audience: payload.tenantId || 'global'
    })
  }

  // Verify token
  static verifyToken(token: string, type: 'access' | 'refresh'): any {
    try {
      const key = type === 'access' ? process.env.JWT_PUBLIC_KEY! : process.env.JWT_REFRESH_PUBLIC_KEY!
      return jwt.verify(token, key, {
        algorithms: [this.ALGORITHM],
        issuer: 'examplatform.com'
      })
    } catch (error) {
      throw new Error('Invalid token')
    }
  }

  // Refresh token rotation
  static async rotateRefreshToken(oldToken: string): Promise<string> {
    const payload = this.verifyToken(oldToken, 'refresh')
    
    // Check if refresh token is revoked
    const isRevoked = await pool.query(
      'SELECT 1 FROM revoked_tokens WHERE token_id = $1',
      [payload.jti]
    )
    
    if (isRevoked.rows.length > 0) {
      throw new Error('Token has been revoked')
    }

    // Revoke old token
    await pool.query(
      'INSERT INTO revoked_tokens (token_id, expires_at) VALUES ($1, $2)',
      [payload.jti, new Date(payload.exp * 1000)]
    )

    // Generate new refresh token
    return this.generateRefreshToken({
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role
    })
  }
}
```

### Enhanced CORS Configuration

**File: `backend/src/middleware/cors.ts`**
```typescript
import cors from 'cors'
import { Request } from 'express'

const allowedOrigins = [
  'https://examplatform.com',
  'https://www.examplatform.com'
]

// Add tenant-specific origins dynamically
export const dynamicCors = cors({
  origin: async (origin: string | undefined, callback: Function) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true)

    // Check if origin matches pattern *.examplatform.com
    if (origin.match(/^https:\/\/([a-zA-Z0-9-]+)\.examplatform\.com$/)) {
      return callback(null, true)
    }

    // Check against allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    // Check tenant-specific custom domains
    const customDomain = await pool.query(
      'SELECT custom_domain FROM organizations WHERE custom_domain = $1 AND is_active = true',
      [origin]
    )

    if (customDomain.rows.length > 0) {
      return callback(null, true)
    }

    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400 // 24 hours
})
```

### Advanced Rate Limiting

**File: `backend/src/middleware/rateLimiter.ts`**
```typescript
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

// Tenant-specific rate limiting
export const createTenantRateLimiter = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs,
    max,
    message: message || 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => {
      // Use tenant ID + IP for rate limiting
      const tenantId = req.tenant?.id || 'global'
      const ip = req.ip
      return `${tenantId}:${ip}`
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/metrics'
    }
  })
}

// Different limits for different endpoints
export const authLimiter = createTenantRateLimiter(15 * 60 * 1000, 5, 'Too many auth attempts, please try again later.')
export const apiLimiter = createTenantRateLimiter(15 * 60 * 1000, 1000, 'API rate limit exceeded.')
export const uploadLimiter = createTenantRateLimiter(60 * 60 * 1000, 10, 'Upload rate limit exceeded.')
```

### Security Headers Middleware

**File: `backend/src/middleware/security.ts`**
```typescript
import helmet from 'helmet'
import { Request, Response, NextFunction } from 'express'

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "https:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
})

// Additional security middleware
export const additionalSecurity = (req: Request, res: Response, next: NextFunction) => {
  // Remove server headers
  res.removeHeader('X-Powered-By')
  
  // Add security headers
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  
  // Add tenant-specific headers
  if (req.tenant) {
    res.setHeader('X-Tenant-ID', req.tenant.id)
  }
  
  next()
}
```

## 11. Final Deployment Flow

### Step-by-Step Deployment Commands

```bash
# 1. Clone and prepare repository
git clone https://github.com/your-org/secure-exam-platform.git
cd secure-exam-platform

# 2. Set up environment variables
cp .env.example .env.production
# Edit .env.production with production values

# 3. Generate SSL certificates
sudo certbot certonly --manual --preferred-challenges dns \
  -d *.examplatform.com -d examplatform.com \
  --email admin@examplatform.com --agree-tos --no-eff-email

# 4. Setup database
docker-compose up -d postgres
sleep 10

# 5. Run database migrations
docker-compose exec backend npm run migrate
docker-compose exec backend node run-migration.js

# 6. Build and deploy services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 7. Setup monitoring
docker-compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker-compose exec grafana grafana-cli admin reset-admin-password

# 8. Verify deployment
curl -k https://examplatform.com/health
curl -k https://examplatform.com/api/health

# 9. Setup log rotation
sudo logrotate -f /etc/logrotate.d/exam-platform

# 10. Setup backup cron jobs
echo "0 2 * * * cd /opt/exam-platform && ./backup-database.sh" | sudo crontab -
```

### Production Deployment Script

**File: `deploy.sh`**
```bash
#!/bin/bash

set -e

echo "🚀 Starting Secure Exam Platform Production Deployment"

# Configuration
DOMAIN="examplatform.com"
EMAIL="admin@examplatform.com"
BACKUP_DIR="/opt/backups"
LOG_DIR="/var/log/exam-platform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check Certbot
    if ! command -v certbot &> /dev/null; then
        error "Certbot is not installed"
    fi
    
    # Check environment file
    if [ ! -f ".env.production" ]; then
        error ".env.production file not found"
    fi
    
    log "Prerequisites check passed"
}

# Setup directories
setup_directories() {
    log "Setting up directories..."
    
    sudo mkdir -p $BACKUP_DIR
    sudo mkdir -p $LOG_DIR
    sudo mkdir -p /opt/exam-platform
    
    sudo chown -R $USER:$USER $BACKUP_DIR
    sudo chown -R $USER:$USER $LOG_DIR
    sudo chown -R $USER:$USER /opt/exam-platform
    
    log "Directories setup completed"
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        log "Obtaining SSL certificate for $DOMAIN"
        sudo certbot certonly --manual --preferred-challenges dns \
            -d $DOMAIN -d *.$DOMAIN \
            --email $EMAIL --agree-tos --no-eff-email --non-interactive
        
        log "SSL certificate obtained"
    else
        log "SSL certificate already exists"
    fi
}

# Setup database
setup_database() {
    log "Setting up database..."
    
    # Start PostgreSQL
    docker-compose up -d postgres
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U postgres; then
            break
        fi
        sleep 2
    done
    
    # Run migrations
    log "Running database migrations..."
    docker-compose run --rm backend npm run migrate
    docker-compose run --rm backend node run-migration.js
    
    log "Database setup completed"
}

# Build and deploy services
deploy_services() {
    log "Building and deploying services..."
    
    # Build images
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
    
    # Start services
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    log "Services deployed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Check Prometheus configuration
    docker-compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
    
    # Setup Grafana admin password
    if [ -n "$GRAFANA_PASSWORD" ]; then
        docker-compose exec grafana grafana-cli admin reset-admin-password $GRAFANA_PASSWORD
    fi
    
    log "Monitoring setup completed"
}

# Run health checks
health_check() {
    log "Running health checks..."
    
    # Check frontend
    if curl -k -f https://$DOMAIN/health > /dev/null 2>&1; then
        log "✅ Frontend health check passed"
    else
        error "❌ Frontend health check failed"
    fi
    
    # Check backend API
    if curl -k -f https://$DOMAIN/api/health > /dev/null 2>&1; then
        log "✅ Backend API health check passed"
    else
        error "❌ Backend API health check failed"
    fi
    
    # Check metrics
    if curl -k -f https://$DOMAIN/metrics > /dev/null 2>&1; then
        log "✅ Metrics endpoint working"
    else
        warning "⚠️ Metrics endpoint not accessible"
    fi
    
    log "Health checks completed"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    sudo tee /etc/logrotate.d/exam-platform > /dev/null <<EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        docker-compose restart nginx
    endscript
}
EOF
    
    sudo logrotate -f /etc/logrotate.d/exam-platform
    
    log "Log rotation setup completed"
}

# Setup backup cron job
setup_backups() {
    log "Setting up automated backups..."
    
    # Create backup script
    cat > /opt/exam-platform/backup-database.sh << 'EOF'
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/exam_platform_$DATE.sql"

docker-compose exec -T postgres pg_dump -U postgres exam_platform > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "exam_platform_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
EOF
    
    chmod +x /opt/exam-platform/backup-database.sh
    
    # Add to cron
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/exam-platform/backup-database.sh") | crontab -
    
    log "Backup setup completed"
}

# Main deployment function
main() {
    log "Starting Secure Exam Platform deployment..."
    
    check_prerequisites
    setup_directories
    setup_ssl
    setup_database
    deploy_services
    setup_monitoring
    health_check
    setup_log_rotation
    setup_backups
    
    log "🎉 Deployment completed successfully!"
    log "🌐 Your platform is available at: https://$DOMAIN"
    log "📊 Grafana dashboard: https://$DOMAIN:3000"
    log "📈 Prometheus metrics: https://$DOMAIN:9090"
    
    echo ""
    echo "Next steps:"
    echo "1. Create your first organization via API or admin panel"
    echo "2. Configure DNS for your tenant subdomains"
    echo "3. Set up LMS integrations if needed"
    echo "4. Monitor system health via Grafana dashboard"
}

# Run main function
main "$@"
```

### Production Verification Checklist

```bash
# Production verification script
#!/bin/bash

echo "🔍 Production Verification Checklist"

# 1. SSL Certificate Check
echo "1. Checking SSL certificate..."
openssl s_client -connect examplatform.com:443 -servername examplatform.com </dev/null 2>/dev/null | openssl x509 -noout -dates

# 2. Service Health Check
echo "2. Checking service health..."
curl -k -s https://examplatform.com/health | jq .
curl -k -s https://examplatform.com/api/health | jq .

# 3. Database Connection Check
echo "3. Checking database connection..."
docker-compose exec -T postgres pg_isready -U postgres

# 4. Redis Connection Check
echo "4. Checking Redis connection..."
docker-compose exec -T redis redis-cli ping

# 5. Monitoring Check
echo "5. Checking monitoring..."
curl -k -s https://examplatform.com/metrics | head -10

# 6. Log Check
echo "6. Checking for errors in logs..."
docker-compose logs --tail=50 backend | grep -i error || echo "No errors found"

# 7. Performance Check
echo "7. Checking performance..."
curl -k -w "@curl-format.txt" -o /dev/null -s https://examplatform.com/api/health

echo "✅ Production verification completed"
```

This comprehensive guide provides everything needed to transform your Secure Exam Platform into a production-ready, multi-tenant SaaS system with enterprise-grade features, security, and monitoring.
