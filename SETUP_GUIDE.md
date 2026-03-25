# 🚀 Secure Exam Platform - Complete Setup Guide

## 📋 Overview

Production-ready Kubernetes deployment with:
- **Frontend**: React + TypeScript (port 3005)
- **Backend**: Node.js + Express (port 4005) 
- **AI Proctoring**: Python + FastAPI (port 5005)
- **Monitoring**: Prometheus + Grafana (port 3002)
- **GitOps**: ArgoCD (port 18081)

## 🎯 One-Command Deployment

### First-Time Setup
```bash
./deploy-simple.sh
```

### Daily Usage
```bash
./run.sh
```

## 📱 Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3005 | - |
| Backend API | http://localhost:4005 | - |
| AI Proctoring | http://localhost:5005 | - |
| Grafana | http://localhost:3002 | admin / admin123 |
| ArgoCD | https://localhost:18081 | admin / <auto-password> |

## 🔧 Prerequisites

```bash
# Required Tools
kubectl          # Kubernetes CLI
minikube         # Local Kubernetes
helm             # Package manager
docker           # Container runtime

# Verify Installation
kubectl version --client
minikube version
helm version
docker --version
```

## 🚀 Step-by-Step Deployment

### 1. Environment Setup
```bash
# Clone repository
git clone https://github.com/bayarmaa01/secure-exam-platform.git
cd secure-exam-platform

# Make scripts executable
chmod +x deploy-simple.sh run.sh
```

### 2. First-Time Deployment
```bash
# Run complete setup
./deploy-simple.sh
```

**What happens:**
- ✅ Starts Minikube (Docker driver)
- ✅ Creates namespaces (exam-platform, monitoring, argocd)
- ✅ Installs ArgoCD from official manifest
- ✅ Installs Prometheus stack via Helm
- ✅ Deploys all application services
- ✅ Configures port-forwards
- ✅ Shows all access URLs + credentials

### 3. Daily Operations
```bash
# Quick restart
./run.sh
```

**What happens:**
- ✅ Restarts application deployments
- ✅ Updates Kubernetes manifests
- ✅ Starts port-forwards
- ✅ Shows service URLs

## 📊 Grafana Setup

### Login
1. Access: http://localhost:3002
2. Username: `admin`
3. Password: `admin123`

### Configure Dashboard

#### Add Prometheus Data Source
1. Go to **Configuration > Data Sources**
2. Click **Add data source**
3. Select **Prometheus**
4. URL: `http://prometheus-operated.monitoring:9090`
5. Click **Save & Test**

#### Import AI Proctoring Dashboard
1. Go to **Dashboards > Import**
2. Paste this JSON:

```json
{
  "dashboard": {
    "title": "AI Proctoring Metrics",
    "panels": [
      {
        "title": "Cheating Score",
        "type": "stat",
        "targets": [
          {
            "expr": "ai_proctoring_cheating_score",
            "legendFormat": "{{exam_id}}"
          }
        ],
        "gridPos": { "x": 0, "y": 0 }
      },
      {
        "title": "Multiple Faces Detected",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(ai_proctoring_multiple_faces_detected_total[5m])",
            "legendFormat": "{{exam_id}}"
          }
        ],
        "gridPos": { "x": 12, "y": 0 }
      },
      {
        "title": "Tab Switches",
        "type": "stat", 
        "targets": [
          {
            "expr": "rate(ai_proctoring_tab_switch_total[5m])",
            "legendFormat": "{{exam_id}}"
          }
        ],
        "gridPos": { "x": 24, "y": 0 }
      }
    ],
    "refresh": "5s"
  }
}
```

### Create Alert Rules
1. Go to **Alerting > Alert rules**
2. Create new rule group
3. Add rule:
```
- Alert: HighCheatingScore
  Expr: ai_proctoring_cheating_score > 0.8
  For: 10s
  Labels:
    severity: warning
  Annotations:
    summary: "High cheating score detected"
```

## 🚢 ArgoCD Setup

### Login
1. Access: https://localhost:18081
2. Username: `admin`
3. Password: Auto-fetched from deployment

### Configure Application
1. Go to **Settings > Repositories**
2. Connect your Git repository
3. Create **Application**:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: secure-exam-platform
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/bayarmaa01/secure-exam-platform.git
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: exam-platform
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

## 🔍 Testing

### Health Checks
```bash
# Test all services
curl http://localhost:3005/health      # Frontend
curl http://localhost:4005/health      # Backend  
curl http://localhost:5005/health      # AI Proctoring
curl http://localhost:3002/api/health  # Grafana API
curl https://localhost:18081/health     # ArgoCD
```

### Load Testing
```bash
# Test backend API
curl -X POST http://localhost:4005/api/exams \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Exam", "duration": 60}'

# Test AI proctoring
curl -X POST http://localhost:5005/ai/analyze \
  -F "image=@test-image.jpg"
```

### Metrics Verification
```bash
# Check Prometheus targets
kubectl port-forward svc/prometheus-operated -n monitoring 9090:9090 &
curl http://localhost:9090/api/v1/targets

# Check AI metrics
curl http://localhost:5005/metrics
```

## 🐛 Troubleshooting

### Common Issues

#### Port Forward Conflicts
```bash
# Kill all port-forwards
pkill -f "port-forward"

# Check what's using ports
lsof -i :3005
lsof -i :4005
lsof -i :5005
```

#### Pod Issues
```bash
# Check pod status
kubectl get pods -A

# View pod logs
kubectl logs -f deployment/backend -n exam-platform
kubectl logs -f deployment/ai-proctoring -n exam-platform
kubectl logs -f deployment/frontend -n exam-platform

# Restart deployments
kubectl rollout restart deployment/backend -n exam-platform
kubectl rollout restart deployment/ai-proctoring -n exam-platform
kubectl rollout restart deployment/frontend -n exam-platform
```

#### ArgoCD Issues
```bash
# Check ArgoCD status
kubectl get pods -n argocd
kubectl logs -f deployment/argocd-server -n argocd

# Reset ArgoCD
kubectl delete crd applications.argoproj.io
kubectl delete crd appprojects.argoproj.io
./deploy-simple.sh  # Reinstall clean
```

#### Grafana Issues
```bash
# Check Grafana
kubectl get pods -n monitoring
kubectl logs -f deployment/prometheus-grafana -n monitoring

# Reset Grafana password
kubectl patch secret prometheus-grafana -n monitoring \
  -p '{"data": {"admin-password": "'$(echo -n 'newpassword' | base64)'"}}'

# Check Prometheus
kubectl port-forward svc/prometheus-operated -n monitoring 9090:9090 &
curl http://localhost:9090/targets
```

#### Minikube Issues
```bash
# Check Minikube status
minikube status

# Restart Minikube
minikube stop
minikube start --driver=docker

# Check resources
minikube ssh -- docker stats
```

### Performance Issues
```bash
# Check resource usage
kubectl top pods -A

# Check node resources
kubectl describe node

# Scale services
kubectl scale deployment backend --replicas=3 -n exam-platform
kubectl scale deployment ai-proctoring --replicas=3 -n exam-platform
```

## 🔄 Maintenance

### Updates
```bash
# Update application
git pull origin main
./run.sh

# Update monitoring
helm upgrade prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=newpassword

# Update ArgoCD
kubectl apply -f https://raw.githubusercontent.com/argoproj/argo-cd/v2.11.3/manifests/install.yaml
```

### Backup
```bash
# Backup configurations
kubectl get all -n exam-platform -o yaml > backup-exam-platform.yaml
helm get values prometheus -n monitoring > backup-monitoring.yaml

# Backup data
kubectl exec -n exam-platform deployment/postgres -- pg_dump exam_db > backup.sql
```

## 📚 Advanced Configuration

### Custom Domains
```bash
# Update frontend environment
# In frontend-deployment.yaml
env:
- name: VITE_API_URL
  value: "https://api.yourdomain.com/api"

# Setup Ingress
kubectl apply -f ingress/
```

### SSL/TLS
```bash
# Generate certificates
mkcert -install
mkcert -cert-file tls.crt -key-file tls.key localhost

# Apply to services
kubectl create secret tls ssl-secret --cert=tls.crt --key=tls.key
```

### High Availability
```bash
# Enable HA
kubectl scale deployment backend --replicas=3 -n exam-platform
kubectl scale deployment ai-proctoring --replicas=3 -n exam-platform
kubectl scale deployment frontend --replicas=3 -n exam-platform

# Enable pod anti-affinity
# Add to deployment spec:
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        - labelSelector:
            matchExpressions:
            - key: app
              operator: In
              values:
              - backend
        topologyKey: kubernetes.io/hostname
```

## ✅ Success Checklist

After running `./deploy-simple.sh`:

- [ ] Minikube running
- [ ] All namespaces created
- [ ] ArgoCD accessible at https://localhost:18081
- [ ] Grafana accessible at http://localhost:3002
- [ ] Frontend accessible at http://localhost:3005
- [ ] Backend API accessible at http://localhost:4005
- [ ] AI Proctoring accessible at http://localhost:5005
- [ ] Prometheus metrics available
- [ ] Grafana dashboards configured
- [ ] Alert rules created
- [ ] All pods in Ready state

## 🎉 Production Ready!

Your Secure Exam Platform is now running with:
- **Zero Manual Steps** after deployment
- **Complete Monitoring** with Prometheus + Grafana
- **GitOps Automation** via ArgoCD
- **AI Proctoring** with real-time metrics
- **Production Security** and best practices

For support, check the troubleshooting section or view logs with:
```bash
./run.sh logs
```
