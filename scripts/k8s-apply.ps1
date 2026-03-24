# PowerShell script for Windows
Write-Host "Applying Kubernetes manifests..."
kubectl apply -f k8s/
Write-Host "Done. Check status: kubectl get all -n exam-platform"
