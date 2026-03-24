# 📋 Commands Reference

This file contains all essential commands for developing, testing, and deploying Secure Exam Platform.

## 🏠 Local Development Commands

### Quick Start
```bash
# Start all services
docker compose up --build

# Start in background
docker compose up -d --build

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Rebuild specific service
docker compose up --build backend
```

### Individual Development
```bash
# Frontend Development
cd frontend
npm install
npm run dev          # Start dev server on http://localhost:5173
npm run build         # Build for production
npm run preview        # Preview production build
npm run lint          # Run ESLint
npm run type-check     # TypeScript type checking

# Backend Development
cd backend
npm install
npm run dev          # Start dev server with nodemon
npm run build         # Compile TypeScript
npm run start         # Start production server
npm run test          # Run tests
npm run lint          # Run ESLint
npm run migrate       # Run database migrations
npm run seed          # Seed initial data

# AI Proctoring Development
cd ai-proctoring
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
python -m pytest          # Run tests
python main.py             # Run directly
```

### Database Management
```bash
# Connect to PostgreSQL
docker exec -it secure-exam-platform-postgres-1 psql -U postgres -d exam_platform

# Reset database
docker compose down -v
docker compose up --build

# Backup database
docker exec secure-exam-platform-postgres-1 pg_dump -U postgres exam_platform > backup.sql

# Restore database
docker exec -i secure-exam-platform-postgres-1 psql -U postgres exam_platform < backup.sql
```

## 🐳 Docker Commands

### Image Management
```bash
# Build images
docker build -t exam-platform:latest ./frontend
docker build -t exam-platform-backend:latest ./backend
docker build -t exam-platform-ai:latest ./ai-proctoring

# Tag images
docker tag exam-platform:latest your-registry/exam-platform:latest
docker tag exam-platform-backend:latest your-registry/exam-platform-backend:latest
docker tag exam-platform-ai:latest your-registry/exam-platform-ai:latest

# Push to registry
docker push your-registry/exam-platform:latest
docker push your-registry/exam-platform-backend:latest
docker push your-registry/exam-platform-ai:latest

# Pull images
docker pull your-registry/exam-platform:latest
docker pull your-registry/exam-platform-backend:latest
docker pull your-registry/exam-platform-ai:latest
```

### Container Management
```bash
# List running containers
docker ps

# List all containers
docker ps -a

# Stop specific container
docker stop secure-exam-platform-backend-1

# Remove container
docker rm secure-exam-platform-backend-1

# Execute command in container
docker exec -it secure-exam-platform-backend-1 /bin/bash

# View container logs
docker logs secure-exam-platform-backend-1

# Follow logs
docker logs -f secure-exam-platform-backend-1
```

### Volume Management
```bash
# List volumes
docker volume ls

# Remove unused volumes
docker volume prune

# Inspect volume
docker volume inspect secure-exam-platform_postgres_data

# Create volume
docker volume create exam-platform-data
```

## ☸️ Kubernetes Commands

### Cluster Management
```bash
# Get cluster info
kubectl cluster-info
kubectl get nodes

# Create namespace
kubectl create namespace exam-platform

# Switch context
kubectl config use-context exam-platform-context

# Get current context
kubectl config current-context
```

### Deployment Management
```bash
# Apply configurations
kubectl apply -f k8s/
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/backend.yaml

# Delete resources
kubectl delete -f k8s/backend.yaml
kubectl delete deployment backend -n exam-platform

# Get deployments
kubectl get deployments -n exam-platform
kubectl describe deployment backend -n exam-platform

# Scale deployments
kubectl scale deployment backend --replicas=3 -n exam-platform
kubectl autoscale deployment backend --min=2 --max=5 -n exam-platform
```

### Pod Management
```bash
# List pods
kubectl get pods -n exam-platform

# Get pod details
kubectl describe pod backend-pod-xxx -n exam-platform

# Execute in pod
kubectl exec -it backend-pod-xxx -n exam-platform -- /bin/bash

# View logs
kubectl logs backend-pod-xxx -n exam-platform
kubectl logs -f deployment/backend -n exam-platform

# Delete pod
kubectl delete pod backend-pod-xxx -n exam-platform
```

### Service Management
```bash
# List services
kubectl get services -n exam-platform

# Get service details
kubectl describe service backend-service -n exam-platform

# Port-forward
kubectl port-forward service/backend-service 4000:4000 -n exam-platform

# Delete service
kubectl delete service backend-service -n exam-platform
```

### Ingress Management
```bash
# List ingress
kubectl get ingress -n exam-platform

# Get ingress details
kubectl describe ingress exam-platform-ingress -n exam-platform

# Test ingress
curl -k https://api.exam.yourdomain.com/health

# Delete ingress
kubectl delete ingress exam-platform-ingress -n exam-platform
```

### ConfigMaps and Secrets
```bash
# List configmaps
kubectl get configmaps -n exam-platform

# Create configmap
kubectl create configmap app-config --from-env-file=.env -n exam-platform

# List secrets
kubectl get secrets -n exam-platform

# Create secret from file
kubectl create secret generic app-secrets --from-env-file=.secrets -n exam-platform

# Create secret from literal
kubectl create secret generic jwt-secret --from-literal=JWT_SECRET=your-secret -n exam-platform
```

## ⛵ Helm Commands

### Repository Management
```bash
# Add repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add jetstack https://charts.jetstack.io
helm repo update

# List repositories
helm repo list

# Search charts
helm search repo postgresql
helm search repo redis
```

### Chart Management
```bash
# Install chart
helm install exam-platform ./helm/exam-platform -n exam-platform

# Upgrade release
helm upgrade exam-platform ./helm/exam-platform -n exam-platform

# List releases
helm list -n exam-platform

# Get release status
helm status exam-platform -n exam-platform

# Uninstall release
helm uninstall exam-platform -n exam-platform

# Test chart
helm template exam-platform ./helm/exam-platform --dry-run
```

### Values Management
```bash
# Show default values
helm show values ./helm/exam-platform

# Show values with custom set
helm show values ./helm/exam-platform --set frontend.replicaCount=5

# Lint chart
helm lint ./helm/exam-platform

# Package chart
helm package ./helm/exam-platform
```

## ☁️ Cloud Provider Commands

### AWS EKS
```bash
# Configure AWS CLI
aws configure
aws eks update-kubeconfig --region us-west-2 --name exam-platform

# Create cluster
eksctl create cluster \
  --name exam-platform \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --managed

# Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name exam-platform

# Delete cluster
eksctl delete cluster --name exam-platform --region us-west-2

# List clusters
eksctl get cluster
```

### Google Cloud GKE
```bash
# Configure gcloud CLI
gcloud auth login
gcloud config set project your-project-id

# Create cluster
gcloud container clusters create exam-platform \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-medium \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 5

# Get credentials
gcloud container clusters get-credentials exam-platform --zone us-central1-a

# Delete cluster
gcloud container clusters delete exam-platform --zone us-central1-a

# List clusters
gcloud container clusters list
```

### Azure AKS
```bash
# Configure Azure CLI
az login
az account set --subscription "your-subscription"

# Create resource group
az group create --name exam-platform-rg --location eastus

# Create cluster
az aks create \
  --resource-group exam-platform-rg \
  --name exam-platform \
  --node-count 3 \
  --node-vm-size Standard_D2s_v3 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group exam-platform-rg --name exam-platform

# Delete cluster
az aks delete --resource-group exam-platform-rg --name exam-platform

# List clusters
az aks list --resource-group exam-platform-rg
```

## 🔍 Testing Commands

### Frontend Testing
```bash
cd frontend

# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run specific test file
npm run test -- --testNamePattern="Auth"

# Watch mode
npm run test:watch

# Generate coverage report
npm run coverage
```

### Backend Testing
```bash
cd backend

# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run API tests
npm run test:api

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### AI Proctoring Testing
```bash
cd ai-proctoring

# Run all tests
pytest

# Run specific test file
pytest test/test_detection.py

# Run with coverage
pytest --cov=.

# Run with verbose output
pytest -v

# Run specific test
pytest test/test_detection.py::test_face_detection
```

## 📊 Monitoring Commands

### Resource Monitoring
```bash
# Get resource usage
kubectl top pods -n exam-platform
kubectl top nodes

# Get events
kubectl get events -n exam-platform --sort-by='.lastTimestamp'

# Describe node
kubectl describe node node-name
```

### Log Management
```bash
# Get all pod logs
kubectl logs -l app=exam-platform -n exam-platform

# Get specific deployment logs
kubectl logs deployment/backend -n exam-platform --since=1h

# Stream logs
kubectl logs -f deployment/frontend -n exam-platform

# Previous logs
kubectl logs deployment/backend -n exam-platform --previous
```

### Performance Testing
```bash
# Load testing backend
ab -n 1000 -c 10 http://localhost:4000/api/health

# Load testing frontend
ab -n 1000 -c 10 http://localhost:3000

# Database performance
kubectl exec -it deployment/postgres -n exam-platform -- psql -U postgres -d exam_platform -c "SELECT * FROM pg_stat_activity;"
```

## 🔧 Development Tools Commands

### Git Commands
```bash
# Initialize repository
git init
git clone https://github.com/bayarmaa01/secure-exam-platform.git

# Branch management
git checkout -b feature/new-feature
git checkout main
git merge feature/new-feature

# Commit changes
git add .
git commit -m "Add new feature"
git commit -am "Update feature"

# Push changes
git push origin main
git push origin feature/new-feature

# Status and log
git status
git log --oneline
git diff
```

### Code Quality
```bash
# Frontend linting
cd frontend
npm run lint
npm run lint:fix
npm run format

# Backend linting
cd backend
npm run lint
npm run format

# TypeScript checking
npm run type-check
npx tsc --noEmit
```

### Package Management
```bash
# Update dependencies
npm update
npm audit fix
pip install --upgrade -r requirements.txt

# Clean dependencies
npm run clean
rm -rf node_modules package-lock.json
npm install
```

## 🚀 Deployment Commands

### Production Deployment
```bash
# Deploy to Kubernetes
kubectl apply -f k8s/
kubectl rollout status deployment/backend -n exam-platform
kubectl rollout status deployment/frontend -n exam-platform

# Deploy with Helm
helm upgrade exam-platform ./helm/exam-platform -n exam-platform
helm history exam-platform -n exam-platform
```

### Rollback Commands
```bash
# Kubernetes rollback
kubectl rollout undo deployment/backend -n exam-platform
kubectl rollout history deployment/backend -n exam-platform

# Helm rollback
helm rollback exam-platform 1 -n exam-platform
helm history exam-platform -n exam-platform
```

## 🔒 Security Commands

### Secret Management
```bash
# Create TLS secret
kubectl create secret tls exam-platform-tls --cert=path/to/tls.crt --key=path/to/tls.key -n exam-platform

# Create generic secret
kubectl create secret generic db-secret --from-literal=password=secure-pass -n exam-platform

# Encode secret
echo -n 'secure-password' | base64

# Decode secret
echo 'c2VjdXJlLXBhc3N3b3JkZA==' | base64 -d
```

### Network Policies
```bash
# Apply network policy
kubectl apply -f k8s/network-policy.yaml

# List network policies
kubectl get networkpolicies -n exam-platform

# Test network connectivity
kubectl exec -it pod-a -n exam-platform -- ping pod-b
```

## 📱 API Testing Commands

### Authentication Testing
```bash
# Test registration
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User","role":"student"}'

# Test login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test refresh token
curl -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your-refresh-token"}'
```

### Health Checks
```bash
# Backend health
curl http://localhost:4000/health

# Frontend health
curl http://localhost:3000

# AI Proctoring health
curl http://localhost:5001/health
```

## 🔄 CI/CD Commands

### GitHub Actions
```bash
# Trigger workflow manually
gh workflow run deploy.yml

# List workflows
gh workflow list

# Get workflow status
gh workflow view deploy.yml
```

### GitLab CI/CD
```bash
# Trigger pipeline
git commit --allow-empty -m "Trigger CI"
git push origin main

# Check pipeline status
glab pipeline list
glab job view job-id
```

## 🛠️ Troubleshooting Commands

### Common Issues
```bash
# Check pod issues
kubectl describe pod pod-name -n exam-platform
kubectl logs pod-name -n exam-platform --previous

# Check service connectivity
kubectl exec -it deployment/backend -n exam-platform -- curl http://localhost:4000/health

# Check DNS resolution
nslookup api.exam.yourdomain.com
dig api.exam.yourdomain.com

# Check certificate
openssl s_client -connect api.exam.yourdomain.com:443 -servername api.exam.yourdomain.com

# Port connectivity
telnet api.exam.yourdomain.com 443
nc -zv api.exam.yourdomain.com 443
```

### Performance Issues
```bash
# Check resource limits
kubectl describe pod pod-name -n exam-platform | grep -A 10 Limits

# Check node resources
kubectl top nodes
kubectl describe node node-name

# Check cluster capacity
kubectl describe nodes | grep -A 5 Capacity
```

---

**Keep this file handy for quick reference during development and deployment operations.**
