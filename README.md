# Cloud-Based Secure Online Exam Platform

Production-ready cloud-native exam platform with AI proctoring, supporting 10,000+ concurrent students.

## Architecture

- **Frontend**: React.js + TailwindCSS + JWT
- **Backend**: Node.js Express + REST API + RBAC
- **AI Proctoring**: Python FastAPI + OpenCV + Face Detection
- **Database**: PostgreSQL
- **Cache**: Redis
- **Infrastructure**: Kubernetes + Helm + Terraform + ArgoCD

## Quick Start (Local Development)

```bash
# Install dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd ai-proctoring && pip install -r requirements.txt && cd ..

# Run with Docker Compose
docker-compose up --build
```

Access: http://localhost:3000

## Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f k8s/

# Or use Helm
helm install exam-platform ./helm/exam-platform -n exam-platform --create-namespace
```

## Software Installation Links

| Software | Official Link |
|----------|---------------|
| Docker | https://docs.docker.com/get-docker/ |
| Node.js | https://nodejs.org/ (LTS 20.x) |
| Python | https://www.python.org/downloads/ (3.11+) |
| Minikube | https://minikube.sigs.k8s.io/docs/start/ |
| kubectl | https://kubernetes.io/docs/tasks/tools/ |
| Helm | https://helm.sh/docs/intro/install/ |
| Terraform | https://www.terraform.io/downloads |
| Argo CD | https://argo-cd.readthedocs.io/en/stable/getting_started/ |
| SonarQube | https://docs.sonarqube.org/latest/setup/install-server/ |
