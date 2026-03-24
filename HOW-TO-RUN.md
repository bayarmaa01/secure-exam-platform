# 🚀 How to Run the Secure Exam Platform Scripts

## 📋 Available Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `setup-all.sh` | Complete setup from scratch | First time, full environment |
| `start-dev.sh` | Daily development startup | Every day for development |
| `deploy.sh` | Application only deployment | When cluster is ready |

## 🔧 Prerequisites

### Required Tools:
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz | tar xz
sudo install linux-amd64/helm /usr/local/bin/helm
```

## 🚀 Running Instructions

### 1️⃣ First Time Setup (Complete Environment)

```bash
# Make executable
chmod +x setup-all.sh

# Run complete setup
./setup-all.sh
```

**What it does:**
- ✅ Checks all prerequisites
- ✅ Sets up Minikube cluster
- ✅ Deploys databases (PostgreSQL, Redis)
- ✅ Deploys application (Frontend, Backend, AI)
- ✅ Sets up monitoring (Grafana)
- ✅ Installs ArgoCD GitOps
- ✅ Starts all access services
- ✅ Provides URLs and credentials

### 2️⃣ Daily Development Startup

```bash
# Make executable
chmod +x start-dev.sh

# Quick daily startup
./start-dev.sh
```

**What it does:**
- ⚡ Fast startup (< 10 seconds)
- 🔄 Starts Minikube if stopped
- 🌐 Starts Cloudflare Tunnel
- 🛠️ Auto-recovers crashing pods
- 📋 Shows all access URLs

### 3️⃣ Application Only Deployment

```bash
# Make executable
chmod +x deploy.sh

# Deploy application only
./deploy.sh
```

**What it does:**
- 📦 Deploys application services
- 🗄️ Assumes cluster is ready
- ⚡ Quick app redeployment

## 🔍 Script Features

### `setup-all.sh` Features:
- 🔧 **Prerequisites validation**
- 🏗️ **Automatic cluster setup**
- 📊 **Complete monitoring stack**
- ⚙️ **ArgoCD GitOps integration**
- 🌐 **Smart port detection**
- 🛡️ **Error handling and recovery**

### `start-dev.sh` Features:
- ⚡ **Lightning fast startup**
- 🔄 **Auto-recovery system**
- 🌐 **Cloudflare Tunnel support**
- 📊 **Service health checks**

### `deploy.sh` Features:
- 📦 **Application focused**
- 🚀 **Quick deployment**
- 🛡️ **Production ready**

## 📱 Access URLs After Setup

### Platform Access:
- **🌐 Main Platform**: `http://exam-platform.local`

### Monitoring Access:
- **📊 Grafana**: `http://localhost:3002` (or available port)
  - Username: `admin`
  - Password: `prom-operator`

### GitOps Access:
- **⚙️ ArgoCD**: `https://localhost:8081` (or available port)
  - Username: `admin`
  - Password: [auto-generated]

## 🛠️ Common Commands

### Check Status:
```bash
# Check all pods
kubectl get pods -n exam-platform
kubectl get pods -n monitoring
kubectl get pods -n argocd

# Check services
kubectl get svc -n exam-platform
kubectl get ingress -n exam-platform
```

### Stop Services:
```bash
# Stop all access services
pkill -f "minikube tunnel"
pkill -f "kubectl port-forward"

# Stop cluster
minikube stop
```

### Restart Services:
```bash
# Restart application
./deploy.sh

# Full restart
./setup-all.sh
```

## 🔧 Troubleshooting

### Port Conflicts:
```bash
# Check what's using ports
netstat -tlnp | grep :3000
netstat -tlnp | grep :8080

# Kill conflicting processes
sudo lsof -ti:3000 | xargs kill -9
```

### Pod Issues:
```bash
# Check pod status
kubectl get pods -n exam-platform -o wide

# Check pod logs
kubectl logs -f deployment/backend -n exam-platform

# Restart deployment
kubectl rollout restart deployment/backend -n exam-platform
```

### Cluster Issues:
```bash
# Check cluster status
minikube status

# Restart cluster
minikube delete
minikube start --cpus=4 --memory=8192
```

## 🎯 Recommended Workflow

### First Time:
```bash
./setup-all.sh
```

### Daily Development:
```bash
./start-dev.sh
```

### Application Updates:
```bash
./deploy.sh
```

### Full Reset:
```bash
minikube delete
./setup-all.sh
```

## 📞 Help

If you encounter issues:

1. **Check prerequisites**: Make sure all tools are installed
2. **Check resources**: Ensure sufficient RAM/CPU (8GB+ RAM recommended)
3. **Check network**: Ensure internet connectivity for image pulls
4. **Check permissions**: Make sure user is in docker group

## 🎉 Success!

After running `setup-all.sh`, you'll have:
- ✅ Complete Secure Exam Platform
- ✅ Grafana monitoring
- ✅ ArgoCD GitOps
- ✅ All services accessible
- ✅ Production-ready deployment

Enjoy your Secure Exam Platform! 🚀
