#!/bin/bash
set -e
echo "Applying Kubernetes manifests..."
kubectl apply -f k8s/
echo "Done. Check status: kubectl get all -n exam-platform"
