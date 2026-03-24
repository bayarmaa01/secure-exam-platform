# NodePort Access Guide

## Service Configuration

All services have been converted from ClusterIP to NodePort with fixed ports:

- **Frontend**: NodePort `30010` → `http://<minikube-ip>:30010`
- **Backend**: NodePort `30011` → `http://<minikube-ip>:30011`  
- **AI Proctoring**: NodePort `30012` → `http://<minikube-ip>:30012`

## Apply Changes

```bash
# Apply all NodePort configurations
./k8s-apply-nodeport.sh

# Or apply manually
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ai-proctoring-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
```

## Verification Commands

```bash
# Check services and NodePorts
kubectl get svc -n exam-platform

# Check pod status
kubectl get pods -n exam-platform

# Get Minikube IP
minikube ip

# Check service details
kubectl describe svc frontend -n exam-platform
kubectl describe svc backend -n exam-platform
kubectl describe svc ai-proctoring -n exam-platform

# Test connectivity
curl http://$(minikube ip):30010
curl http://$(minikube ip):30011/health
curl http://$(minikube ip):30012/health
```

## Expected Output

```bash
$ kubectl get svc -n exam-platform
NAME            TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
backend         NodePort   10.96.123.45    <none>        4000:30011/TCP   1m
frontend        NodePort   10.96.123.46    <none>        80:30010/TCP     1m
ai-proctoring   NodePort   10.96.123.47    <none>        5000:30012/TCP   1m
postgres        ClusterIP  10.96.123.48    <none>        5432/TCP         1m
redis           ClusterIP  10.96.123.49    <none>        6379/TCP         1m
```

## Troubleshooting

### If Ports Still Fail:

1. **Check Minikube Status**
   ```bash
   minikube status
   minikube ip
   ```

2. **Verify NodePort Range**
   ```bash
   minikube ssh "cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep service-node-port-range"
   ```
   Default range is `30000-32767`. Our ports (30010-30012) are within range.

3. **Check Firewall**
   ```bash
   # Windows (Administrator PowerShell)
   New-NetFirewallRule -DisplayName "Minikube NodePorts" -Direction Inbound -Protocol TCP -LocalPort 30010,30011,30012 -Action Allow
   
   # Linux
   sudo ufw allow 30010:30012/tcp
   ```

4. **Restart Minikube if Needed**
   ```bash
   minikube delete
   minikube start --driver=docker
   ./k8s-apply-nodeport.sh
   ```

5. **Check Service Endpoints**
   ```bash
   kubectl get endpoints -n exam-platform
   ```

6. **Port Forwarding Alternative**
   ```bash
   kubectl port-forward svc/frontend 30010:80 -n exam-platform
   kubectl port-forward svc/backend 30011:4000 -n exam-platform
   kubectl port-forward svc/ai-proctoring 30012:5000 -n exam-platform
   ```

### Docker Driver Specific Notes

- NodePorts work with Docker driver
- No need for `minikube tunnel` with NodePort
- Services accessible directly via `<minikube-ip>:<nodeport>`

### Ingress Removal

The Ingress configuration has been completely removed:
- Deleted `k8s/ingress.yaml`
- No dependency on nginx-ingress-controller
- No need for `minikube addons enable ingress`

## Cloudflare Tunnel Alternative

If you prefer Cloudflare Tunnel (like your working project):

```bash
# Install cloudflared
brew install cloudflared  # macOS
# or download from https://github.com/cloudflare/cloudflared

# Create tunnel for each service
cloudflared tunnel --url http://$(minikube ip):30010  # Frontend
cloudflared tunnel --url http://$(minikube ip):30011  # Backend
cloudflared tunnel --url http://$(minikube ip):30012  # AI Service
```
