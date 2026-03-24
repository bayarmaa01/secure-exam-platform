# 🔥 COMPLETE END-TO-END FIX GUIDE

## ✅ PART 1: APPLICATION ACCESS (NODEPORT)

**Status**: ✅ FIXED - All services converted to NodePort

### Service URLs:
- **Frontend**: `http://<minikube-ip>:30010`
- **Backend**: `http://<minikube-ip>:30011`
- **AI Proctoring**: `http://<minikube-ip>:30012`

### Apply Changes:
```bash
# Apply updated services
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ai-proctoring-deployment.yaml

# Verify NodePorts
kubectl get svc -n exam-platform
```

---

## ✅ PART 2: ARGOCD SYNC FIX

**Status**: ✅ FIXED - Updated ArgoCD Application

### Issues Fixed:
- ✅ Corrected repoURL to your actual GitHub repo
- ✅ Added `CreateNamespace=true` option
- ✅ Added retry configuration
- ✅ Auto-sync enabled (prune: true, selfHeal: true)

### Apply Fixed ArgoCD:
```bash
# Delete old application
kubectl delete application exam-platform -n argocd

# Apply fixed configuration
kubectl apply -f argocd/application-fixed.yaml

# Check sync status
argocd app get exam-platform
argocd app sync exam-platform
```

---

## ✅ PART 3: BACKEND METRICS ENDPOINT

**Status**: ✅ FIXED - Added Prometheus metrics

### Changes Made:
- ✅ Created `backend/src/metrics.ts` with AI proctoring metrics
- ✅ Added `/metrics` endpoint to `backend/src/index.ts`
- ✅ Metrics include: suspicious_events_total, face_not_detected, multiple_faces_detected, tab_switch_count

### Install prom-client:
```bash
cd backend
npm install prom-client @types/prom-client
```

### Test Metrics:
```bash
# Port forward to test locally
kubectl port-forward svc/backend -n exam-platform 4000:4000

# Test metrics endpoint
curl http://localhost:4000/metrics
```

---

## ✅ PART 4: PROMETHEUS SCRAPING FIX

**Status**: ✅ FIXED - Added ServiceMonitor

### Apply ServiceMonitor:
```bash
kubectl apply -f monitoring/servicemonitor.yaml
```

### Alternative: Static Config (if ServiceMonitor fails)
```bash
# Edit Prometheus config
kubectl edit configmap prometheus-server -n monitoring

# Add to scrape_configs:
# - job_name: 'backend'
#   static_configs:
#   - targets: ['backend.exam-platform.svc.cluster.local:4000']
# - job_name: 'ai-proctoring'
#   static_configs:
#   - targets: ['ai-proctoring.exam-platform.svc.cluster.local:5000']
```

### Verify Prometheus Targets:
```bash
kubectl port-forward svc/prometheus-server -n monitoring 9090:80
# Visit http://localhost:9090/targets
```

---

## ✅ PART 5: GRAFANA DASHBOARD FIX

**Status**: ✅ FIXED - Created dashboard with PromQL queries

### Import Dashboard:
```bash
# Port forward to Grafana
kubectl port-forward svc/prometheus-grafana -n monitoring 3002:80

# Visit http://localhost:3002
# Import: monitoring/grafana-dashboard.json
```

### Key PromQL Queries:
```promql
# Suspicious events rate
sum(rate(suspicious_events_total[5m])) by (event_type)

# Face detection issues
sum(rate(face_not_detected_total[5m]))
sum(rate(multiple_faces_detected_total[5m]))

# Tab switches
sum(rate(tab_switch_count_total[5m])) by (student_id)

# Active sessions
exam_sessions_active
```

---

## 🚀 PART 6: ACCESS COMMANDS

### Application Access:
```bash
# Get Minikube IP
minikube ip

# Access URLs
http://<minikube-ip>:30010  # Frontend
http://<minikube-ip>:30011  # Backend
http://<minikube-ip>:30012  # AI Proctoring
```

### Grafana Access:
```bash
kubectl port-forward svc/prometheus-grafana -n monitoring 3002:80
# Visit: http://localhost:3002
```

### ArgoCD Access:
```bash
kubectl port-forward svc/argocd-server -n argocd 8081:443
# Visit: https://localhost:8081
```

---

## 🔐 PART 7: CREDENTIALS

### ArgoCD Admin Password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### Grafana Login:
```bash
Username: admin
Password: prom-operator
```

---

## 🔍 PART 8: END-TO-END DEBUG COMMANDS

### System Status:
```bash
kubectl get pods -A
kubectl get svc -A
kubectl get applications -n argocd
```

### Application Debug:
```bash
# Backend logs
kubectl logs deployment/backend -n exam-platform

# Test metrics endpoint
kubectl port-forward svc/backend -n exam-platform 4000:4000 &
curl http://localhost:4000/metrics

# Test health endpoint
curl http://localhost:4000/health
```

### ArgoCD Debug:
```bash
# Check application status
argocd app get exam-platform

# Force sync
argocd app sync exam-platform

# Check sync history
argocd app history exam-platform
```

### Prometheus Debug:
```bash
# Check targets
kubectl port-forward svc/prometheus-server -n monitoring 9090:80 &
curl http://localhost:9090/api/v1/targets

# Check metrics
curl http://localhost:9090/api/v1/query?query=up
```

---

## 🚨 PART 9: COMMON FAILURE FIXES

### 1. ArgoCD NOT Syncing:
**Problem**: Wrong repo URL or missing namespace
**Fix**:
```bash
# Check actual repo URL in argocd/application-fixed.yaml
# Ensure namespace exists:
kubectl create namespace exam-platform --dry-run=client -o yaml | kubectl apply -f -

# Manual sync:
argocd app sync exam-platform --force
```

### 2. Prometheus Target DOWN:
**Problem**: Wrong service name or missing /metrics endpoint
**Fix**:
```bash
# Check service labels
kubectl get svc backend -n exam-platform --show-labels

# Test metrics directly
kubectl port-forward svc/backend -n exam-platform 4000:4000
curl http://localhost:4000/metrics

# If no metrics, rebuild backend image with prom-client
```

### 3. Grafana NO DATA:
**Problem**: Wrong PromQL or Prometheus not connected
**Fix**:
```bash
# Check Prometheus datasource in Grafana
# Verify metrics exist in Prometheus:
curl "http://localhost:9090/api/v1/query?query=suspicious_events_total"

# Use simpler query first:
up{job="backend"}
```

### 4. NodePort Not Accessible:
**Problem**: Firewall or Minikube driver issue
**Fix**:
```bash
# Check Minikube status
minikube status

# Restart if needed
minikube delete && minikube start --driver=docker

# Check NodePort range
minikube ssh "cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep service-node-port-range"
```

---

## 🎯 FINAL VERIFICATION CHECKLIST

### ✅ Application:
- [ ] Frontend accessible at http://<minikube-ip>:30010
- [ ] Backend health check: http://<minikube-ip>:30011/health
- [ ] Backend metrics: http://<minikube-ip>:30011/metrics
- [ ] AI service accessible at http://<minikube-ip>:30012

### ✅ ArgoCD:
- [ ] Application status: Synced
- [ ] Auto-sync enabled
- [ ] GitHub changes reflect in cluster

### ✅ Monitoring:
- [ ] Prometheus targets: UP
- [ ] Metrics visible in Prometheus
- [ ] Grafana dashboard shows data
- [ ] Alerts working (if configured)

---

## 🚀 QUICK START COMMANDS

```bash
# 1. Apply all fixes
kubectl apply -f argocd/application-fixed.yaml
kubectl apply -f monitoring/servicemonitor.yaml

# 2. Rebuild backend with metrics
cd backend && npm install prom-client @types/prom-client
docker build -t bayarmaa/exam-platform-backend:latest .
kubectl rollout restart deployment/backend -n exam-platform

# 3. Access everything
echo "Minikube IP: $(minikube ip)"
echo "Frontend: http://$(minikube ip):30010"
echo "ArgoCD: https://localhost:8081"
echo "Grafana: http://localhost:3002"

# 4. Get credentials
echo "ArgoCD Password:"
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo "Grafana: admin / prom-operator"
```

**🎉 Your secure-exam-platform should now be fully functional with monitoring!**
