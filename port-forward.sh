#!/bin/bash
echo "🔧 Starting port forwarding..."

# Kill existing port forwards
pkill -f "kubectl port-forward" 2>/dev/null || true
sleep 3

# Set up port forwards with correct namespaces
kubectl port-forward -n exam-platform svc/frontend 3005:80 &
kubectl port-forward -n exam-platform svc/backend 4005:4000 &
kubectl port-forward -n exam-platform svc/ai-proctoring 5005:8000 &
kubectl port-forward -n exam-monitoring svc/grafana 3002:3000 &
kubectl port-forward -n exam-monitoring svc/prometheus 9092:9090 &
kubectl port-forward -n argocd svc/argocd-server 18081:80 &

echo "✅ All port forwards started"
