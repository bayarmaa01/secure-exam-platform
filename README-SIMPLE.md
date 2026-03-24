# 🚀 Secure Exam Platform - Simple Setup

## 📋 **ONLY TWO SCRIPTS NEEDED**

### 🎯 **First-Time Setup**
```bash
./deploy-simple.sh
```
- ✅ Starts Minikube
- ✅ Deploys all services
- ✅ Configures monitoring
- ✅ Shows access URLs

### 🏃 **Daily Usage**
```bash
./run.sh start    # Start all services
./run.sh access   # Show access URLs
./run.sh status   # Check status
./run.sh stop     # Stop all services
```

---

## 🌐 **Access URLs**

After running `./run.sh access`:

### **Direct Access (NodePort)**
- **Frontend**: `http://<minikube-ip>:30010`
- **Backend**: `http://<minikube-ip>:30011`
- **AI Service**: `http://<minikube-ip>:30012`

### **Local Access (Port Forward)**
- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:4000`
- **AI Service**: `http://localhost:5000`
- **ArgoCD**: `https://localhost:8081`
- **Grafana**: `http://localhost:3002`

---

## 🔧 **Quick Commands**

```bash
# Check everything is running
./run.sh status

# Start services
./run.sh start

# View access URLs
./run.sh access

# Watch logs
./run.sh logs

# Stop everything
./run.sh stop

# Restart everything
./run.sh restart
```

---

## 🆓 **Free AI Setup**

The platform uses 100% free AI models:

```bash
# Test free AI locally
cd ai-proctoring
python main-free.py
python test-free-ai.py
```

**Benefits:**
- 💰 Zero cost (no API fees)
- 🔐 Complete privacy (local processing)
- 🚀 Fast performance (sub-second)
- 🛡️ Secure (no data leaves your server)

---

## 📊 **What's Included**

✅ **Frontend** - React + TypeScript  
✅ **Backend** - Node.js + Express + PostgreSQL  
✅ **AI Proctoring** - Python + OpenCV (Free)  
✅ **Database** - PostgreSQL + Redis  
✅ **Monitoring** - Prometheus + Grafana  
✅ **Automation** - ArgoCD auto-sync  
✅ **Privacy** - 100% local AI processing  

---

## 🛠️ **Troubleshooting**

```bash
# If Minikube isn't running
minikube start --driver=docker

# If services aren't ready
kubectl get pods -n exam-platform

# If something is broken
./run.sh restart

# View detailed logs
kubectl logs -f deployment/<name> -n exam-platform
```

---

## 🎉 **That's It!**

Your secure exam platform is now:
- ✅ **Simple** - Only 2 scripts needed
- ✅ **Clean** - No unnecessary files
- ✅ **Automated** - One-command deployment
- ✅ **Free** - Zero AI costs
- ✅ **Private** - Local processing only

**🚀 Ready to go in 5 minutes!**
