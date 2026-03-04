# Deployment Guide - Secure Online Exam Platform

## Prerequisites & Installation Links

| Software | Version | Official Link |
|----------|---------|---------------|
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| Node.js | 20 LTS | https://nodejs.org/ |
| Python | 3.11+ | https://www.python.org/downloads/ |
| Minikube | latest | https://minikube.sigs.k8s.io/docs/start/ |
| kubectl | latest | https://kubernetes.io/docs/tasks/tools/ |
| Helm | 3.x | https://helm.sh/docs/intro/install/ |
| Terraform | 1.x | https://www.terraform.io/downloads |
| Argo CD | latest | https://argo-cd.readthedocs.io/en/stable/getting_started/ |
| SonarQube | 10+ | https://docs.sonarqube.org/latest/setup/install-server/ |

## Local Development

```bash
# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd ai-proctoring && pip install -r requirements.txt && cd ..

# Run with Docker Compose
docker-compose up --build

# Access
# Frontend: http://localhost:3000
# Backend API: http://localhost:4000
# AI Proctoring: http://localhost:5000
```

## Kubernetes Deployment

```bash
# Create namespace and resources
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ai-proctoring-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Or apply all at once
kubectl apply -f k8s/
```

## Install NGINX Ingress

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

## Install Argo CD (GitOps)

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

## Monitoring

```bash
# Install Prometheus + Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace -f monitoring/prometheus-values.yaml
```

## Terraform (Infrastructure)

```bash
cd terraform
terraform init
terraform plan
terraform apply -var="db_password=YOUR_SECURE_PASSWORD"
```

## Access Application

```bash
# Get Ingress host
kubectl get ingress -n exam-platform

# Add to /etc/hosts (or C:\Windows\System32\drivers\etc\hosts on Windows):
# <INGRESS_IP> exam-platform.local

# Access: http://exam-platform.local
```
