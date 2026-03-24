#!/bin/bash

# Secure Exam Platform - NodePort Deployment Script
# This script applies all Kubernetes manifests with NodePort configuration

echo "🚀 Deploying Secure Exam Platform with NodePort services..."

# Apply namespace first
echo "📦 Creating namespace..."
kubectl apply -f k8s/namespace.yaml

# Apply configurations
echo "⚙️ Applying configurations..."
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# Apply database services
echo "🗄️ Deploying databases..."
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n exam-platform --timeout=300s

# Apply application services with NodePort
echo "🎯 Deploying application services with NodePort..."
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ai-proctoring-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# Wait for all services to be ready
echo "⏳ Waiting for all services to be ready..."
kubectl wait --for=condition=ready pod -l app=backend -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=ai-proctoring -n exam-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n exam-platform --timeout=300s

echo "✅ Deployment completed!"
echo ""
echo "🌐 Access URLs:"
echo "Frontend: http://$(minikube ip):30010"
echo "Backend:  http://$(minikube ip):30011"
echo "AI Service: http://$(minikube ip):30012"
echo ""
echo "🔍 Verification commands:"
echo "kubectl get svc -n exam-platform"
echo "kubectl get pods -n exam-platform"
echo "minikube ip"
