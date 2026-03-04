# Quick Reference - Secure Exam Platform

## Local Development

```bash
# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd ai-proctoring && pip install -r requirements.txt && cd ..

# Run with Docker Compose
docker-compose up --build

# Access: http://localhost:3000
```

## Kubernetes Deployment

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or use the script
./scripts/k8s-apply.sh   # Linux/Mac
.\scripts\k8s-apply.ps1  # Windows
```

## Install Argo CD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

## Install NGINX Ingress

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

## Monitoring (Prometheus + Grafana)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace -f monitoring/prometheus-values.yaml
```

## Terraform

```bash
cd terraform
terraform init
terraform apply -var="db_password=YOUR_SECURE_PASSWORD"
```

## Access Application

```bash
kubectl get ingress -n exam-platform
# Add host to /etc/hosts (or C:\Windows\System32\drivers\etc\hosts)
# Access: http://exam-platform.local
```
