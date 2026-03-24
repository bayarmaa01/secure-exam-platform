# 🚀 Deployment Guide

This guide covers all deployment scenarios for the Secure Exam Platform, from local development to production Kubernetes clusters.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Helm Deployment](#helm-deployment)
6. [Cloud Deployment](#cloud-deployment)
7. [Environment Configuration](#environment-configuration)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

## 🛠️ Prerequisites

### Required Software
- **Docker Desktop** v4.0+ (for local development)
- **kubectl** v1.25+ (for Kubernetes deployment)
- **Helm** v3.8+ (for Helm deployment)
- **Git** v2.30+ (for version control)
- **Node.js** v18+ (for local frontend/backend development)
- **Python** v3.9+ (for AI proctoring development)

### Cloud Accounts (Optional)
- **AWS Account** (for EKS deployment)
- **Google Cloud Account** (for GKE deployment)
- **Azure Account** (for AKS deployment)
- **DigitalOcean Account** (for DOKS deployment)

## 🏠 Local Development

### Quick Start
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

### Individual Service Development
```bash
# Frontend only
cd frontend
npm install
npm run dev

# Backend only
cd backend
npm install
npm run dev

# AI Proctoring only
cd ai-proctoring
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

### Development Database Setup
```bash
# PostgreSQL with Docker
docker run -d \
  --name postgres-dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=exam_platform \
  -p 5432:5432 \
  postgres:16-alpine

# Redis with Docker
docker run -d \
  --name redis-dev \
  -p 6379:6379 \
  redis:7-alpine
```

## 🐳 Docker Deployment

### Production Docker Compose
```bash
# Create production compose file
cp docker-compose.yml docker-compose.prod.yml

# Edit for production settings
# - Change passwords to secure values
# - Update CORS_ORIGIN to production domain
# - Configure external database if needed

# Deploy to production
docker compose -f docker-compose.prod.yml up -d --build
```

### Docker Swarm Deployment
```bash
# Initialize Docker Swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml exam-platform

# Scale services
docker service scale exam-platform_frontend=3
docker service scale exam-platform_backend=2
```

### Docker Registry Push
```bash
# Build and tag images
docker build -t your-registry/exam-platform:latest ./frontend
docker build -t your-registry/exam-platform-backend:latest ./backend
docker build -t your-registry/exam-platform-ai:latest ./ai-proctoring

# Push to registry
docker push your-registry/exam-platform:latest
docker push your-registry/exam-platform-backend:latest
docker push your-registry/exam-platform-ai:latest
```

## ☸️ Kubernetes Deployment

### Prerequisites
```bash
# Verify kubectl access
kubectl cluster-info
kubectl get nodes

# Install required operators
kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.8.0/cert-manager.yaml
```

### Namespace Creation
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: exam-platform
  labels:
    name: exam-platform
```

### ConfigMaps
```yaml
# k8s/configmaps.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: exam-platform-config
  namespace: exam-platform
data:
  CORS_ORIGIN: "https://exam.yourdomain.com"
  REDIS_URL: "redis://redis-service:6379"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "exam_platform"
```

### Secrets
```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: exam-platform-secrets
  namespace: exam-platform
type: Opaque
data:
  DB_PASSWORD: cG9zdGdyZXM=  # base64 encoded
  JWT_SECRET: eW91ci1qdXBlci1zZWNyZXQand0ZXJrZXQ=  # base64 encoded
  JWT_REFRESH_SECRET: eW91ci1zdXBlci1zZWNyZXQand0ZXJrZXQ=  # base64 encoded
```

### PostgreSQL Deployment
```yaml
# k8s/postgres.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: exam-platform
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        env:
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: exam-platform-secrets
              key: DB_PASSWORD
        - name: POSTGRES_DB
          value: "exam_platform"
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: exam-platform
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: exam-platform
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: fast-ssd
```

### Backend Deployment
```yaml
# k8s/backend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: exam-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/exam-platform-backend:latest
        envFrom:
        - configMapRef:
            name: exam-platform-config
        - secretRef:
            name: exam-platform-secrets
        ports:
        - containerPort: 4000
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: exam-platform
spec:
  selector:
    app: backend
  ports:
  - port: 4000
    targetPort: 4000
  type: ClusterIP
```

### Frontend Deployment
```yaml
# k8s/frontend.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: exam-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/exam-platform:latest
        envFrom:
        - configMapRef:
            name: exam-platform-config
        ports:
        - containerPort: 80
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: exam-platform
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### Ingress Configuration
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: exam-platform-ingress
  namespace: exam-platform
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
  - hosts:
    - exam.yourdomain.com
    - api.exam.yourdomain.com
    secretName: exam-platform-tls
  rules:
  - host: exam.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
  - host: api.exam.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 4000
```

### Deploy to Kubernetes
```bash
# Apply all configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ai-proctoring.yaml
kubectl apply -f k8s/ingress.yaml

# Check deployment status
kubectl get pods -n exam-platform
kubectl get services -n exam-platform
kubectl get ingress -n exam-platform

# Scale if needed
kubectl scale deployment backend --replicas=3 -n exam-platform
kubectl scale deployment frontend --replicas=5 -n exam-platform
```

## ⛵ Helm Deployment

### Chart Structure
```
helm/exam-platform/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── postgresql.yaml
│   ├── redis.yaml
│   ├── backend.yaml
│   ├── frontend.yaml
│   ├── ai-proctoring.yaml
│   ├── ingress.yaml
│   └── serviceaccount.yaml
└── .helmignore
```

### Chart.yaml
```yaml
# helm/exam-platform/Chart.yaml
apiVersion: v2
name: exam-platform
description: Secure Exam Platform with AI Proctoring
type: application
version: 1.0.0
appVersion: "1.0.0"
keywords:
  - exam
  - education
  - ai-proctoring
  - security
home: https://github.com/bayarmaa01/secure-exam-platform
sources:
  - https://github.com/bayarmaa01/secure-exam-platform
maintainers:
  - name: Secure Exam Team
    email: team@exam-platform.com
dependencies:
  - name: postgresql
    version: 12.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 17.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

### Values.yaml
```yaml
# helm/exam-platform/values.yaml
global:
  imageRegistry: your-registry
  imagePullSecrets: []

frontend:
  replicaCount: 3
  image:
    repository: exam-platform
    tag: latest
  service:
    type: ClusterIP
    port: 80
  ingress:
    enabled: true
    hostname: exam.yourdomain.com
    tls: true
  resources:
    requests:
      memory: 128Mi
      cpu: 100m
    limits:
      memory: 256Mi
      cpu: 200m

backend:
  replicaCount: 2
  image:
    repository: exam-platform-backend
    tag: latest
  service:
    type: ClusterIP
    port: 4000
  resources:
    requests:
      memory: 256Mi
      cpu: 250m
    limits:
      memory: 512Mi
      cpu: 500m

aiProctoring:
  replicaCount: 1
  image:
    repository: exam-platform-ai
    tag: latest
  service:
    type: ClusterIP
    port: 5000
  resources:
    requests:
      memory: 512Mi
      cpu: 500m
    limits:
      memory: 1Gi
      cpu: 1000m

postgresql:
  enabled: true
  auth:
    postgresPassword: "secure-password"
    database: "exam_platform"
  primary:
    persistence:
      enabled: true
      size: 20Gi

redis:
  enabled: true
  auth:
    enabled: false
  master:
    persistence:
      enabled: true
      size: 8Gi
```

### Install with Helm
```bash
# Add required Helm repositories
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install the chart
helm install exam-platform ./helm/exam-platform \
  --namespace exam-platform \
  --create-namespace \
  --set frontend.domain=exam.yourdomain.com \
  --set backend.domain=api.exam.yourdomain.com \
  --set postgresql.auth.postgresPassword=your-secure-password \
  --set global.imageRegistry=your-registry

# Upgrade existing deployment
helm upgrade exam-platform ./helm/exam-platform \
  --namespace exam-platform \
  --reuse-values

# Uninstall
helm uninstall exam-platform --namespace exam-platform
```

## ☁️ Cloud Deployment

### AWS EKS Deployment
```bash
# Configure AWS CLI
aws configure
aws eks update-kubeconfig --region us-west-2 --name exam-platform

# Create EKS cluster
eksctl create cluster \
  --name exam-platform \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --managed

# Deploy to EKS
kubectl apply -f k8s/
```

### Google Cloud GKE Deployment
```bash
# Configure gcloud CLI
gcloud auth login
gcloud config set project your-project-id

# Create GKE cluster
gcloud container clusters create exam-platform \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-medium \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 5

# Get cluster credentials
gcloud container clusters get-credentials exam-platform --zone us-central1-a

# Deploy to GKE
kubectl apply -f k8s/
```

### Azure AKS Deployment
```bash
# Configure Azure CLI
az login
az account set --subscription "your-subscription"

# Create resource group
az group create --name exam-platform-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group exam-platform-rg \
  --name exam-platform \
  --node-count 3 \
  --node-vm-size Standard_D2s_v3 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get cluster credentials
az aks get-credentials --resource-group exam-platform-rg --name exam-platform

# Deploy to AKS
kubectl apply -f k8s/
```

## ⚙️ Environment Configuration

### Production Environment Variables
```bash
# Backend Production (.env)
PORT=4000
DB_HOST=postgres-service
DB_PORT=5432
DB_NAME=exam_platform
DB_USER=postgres
DB_PASSWORD=your-secure-password
JWT_SECRET=your-super-secure-jwt-secret-key-256-bits
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-256-bits
REDIS_URL=redis://redis-service:6379
CORS_ORIGIN=https://exam.yourdomain.com
NODE_ENV=production

# Frontend Production (.env)
VITE_API_URL=https://api.exam.yourdomain.com/api
VITE_AI_URL=https://ai-proctoring.exam.yourdomain.com
VITE_ENVIRONMENT=production

# AI Proctoring Production (.env)
OPENAI_API_KEY=sk-your-openai-api-key
ENVIRONMENT=production
LOG_LEVEL=INFO
```

### Database Migration
```bash
# Run database migrations
kubectl exec -it deployment/backend -n exam-platform -- npm run migrate

# Seed initial data
kubectl exec -it deployment/backend -n exam-platform -- npm run seed

# Verify database
kubectl exec -it deployment/postgres -n exam-platform -- psql -U postgres -d exam_platform -c "\dt"
```

## 📊 Monitoring & Troubleshooting

### Health Checks
```bash
# Check pod status
kubectl get pods -n exam-platform -w

# Check services
kubectl get services -n exam-platform

# Check ingress
kubectl get ingress -n exam-platform

# Port-forward for debugging
kubectl port-forward service/backend-service 4000:4000 -n exam-platform
kubectl port-forward service/frontend-service 3000:80 -n exam-platform
```

### Log Management
```bash
# View backend logs
kubectl logs -f deployment/backend -n exam-platform

# View frontend logs
kubectl logs -f deployment/frontend -n exam-platform

# View database logs
kubectl logs deployment/postgres -n exam-platform

# View all logs
kubectl logs -f --all-namespaces -l app=exam-platform
```

### Performance Monitoring
```bash
# Install metrics server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Check resource usage
kubectl top pods -n exam-platform
kubectl top nodes

# Set up Prometheus (optional)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring
```

### Common Issues & Solutions

#### Pod Not Starting
```bash
# Check image pull issues
kubectl describe pod -n exam-platform

# Check resource limits
kubectl get events -n exam-platform --sort-by='.lastTimestamp'

# Fix: Increase resource limits in deployment
```

#### Database Connection Issues
```bash
# Check database connectivity
kubectl exec -it deployment/backend -n exam-platform -- ping postgres-service

# Check database logs
kubectl logs deployment/postgres -n exam-platform

# Fix: Verify secrets and configmaps
```

#### Ingress Not Working
```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress configuration
kubectl describe ingress exam-platform-ingress -n exam-platform

# Fix: Verify DNS and TLS certificates
```

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Configure kubectl
      run: |
        aws eks update-kubeconfig --region ${{ secrets.AWS_REGION }} --name ${{ secrets.CLUSTER_NAME }}
    - name: Deploy to Kubernetes
      run: |
        kubectl apply -f k8s/
        kubectl rollout status deployment/backend -n exam-platform
        kubectl rollout status deployment/frontend -n exam-platform
```

### GitLab CI/CD
```yaml
# .gitlab-ci.yml
stages:
  - build
  - deploy

build:
  stage: build
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA ./frontend
    - docker build -t $CI_REGISTRY_IMAGE-backend:$CI_COMMIT_SHA ./backend
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE-backend:$CI_COMMIT_SHA

deploy:
  stage: deploy
  script:
    - kubectl set image deployment/frontend frontend=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl set image deployment/backend backend=$CI_REGISTRY_IMAGE-backend:$CI_COMMIT_SHA
    - kubectl rollout restart deployment/frontend
    - kubectl rollout restart deployment/backend
  only:
    - main
```

## 🔒 Security Best Practices

### Network Security
- Use HTTPS everywhere
- Implement proper CORS policies
- Enable rate limiting
- Use network policies in Kubernetes
- Regularly update dependencies

### Application Security
- Rotate secrets regularly
- Use read-only file systems where possible
- Implement proper logging and monitoring
- Regular security audits
- Use vulnerability scanning

### Infrastructure Security
- Enable RBAC in Kubernetes
- Use pod security policies
- Encrypt data at rest and in transit
- Regular backup and disaster recovery testing

---

**For additional support, check the main [README.md](./README.md) or create an issue in the repository.**
