#!/bin/bash

echo "🚀 Starting DevOps Stack..."

echo "Starting Minikube..."
minikube start

echo "Checking Kubernetes nodes..."
kubectl get nodes

echo "Checking all pods..."
kubectl get pods -A

echo "Starting ArgoCD UI..."
kubectl port-forward svc/argocd-server -n argocd 9091:443 &
ARGO_PID=$!

echo "Starting Grafana UI..."
kubectl port-forward svc/grafana -n monitoring 3001:80 &
GRAFANA_PID=$!

echo "Checking exam platform pods..."
kubectl get pods -n exam-platform

echo ""
echo "✅ DevOps Stack Started"
echo ""
echo "ArgoCD: https://localhost:9091"
echo "Grafana: http://localhost:3001"
echo ""
echo "Press CTRL+C to stop..."

wait