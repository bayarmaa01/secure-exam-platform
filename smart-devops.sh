#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="exam-platform"
MON_NS="exam-monitoring"
ARGO_NS="argocd"

FRONTEND_IMAGE="exam-platform-frontend:local"
BACKEND_IMAGE="exam-platform-backend:local"
AI_IMAGE="exam-platform-ai-proctoring:local"

FRONTEND_PORT=3005
BACKEND_PORT=4005
AI_PORT=5005
GRAFANA_PORT=3002
PROM_PORT=9092
ARGO_PORT=18081

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="${ROOT_DIR}/.smart-devops-pids"
mkdir -p "${PID_DIR}"

log() { printf '%s\n' "$1"; }

retry_cmd() {
  local attempts="$1"
  shift
  local n=1
  until "$@"; do
    if [ "${n}" -ge "${attempts}" ]; then
      return 1
    fi
    n=$((n + 1))
    sleep 5
  done
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

cleanup_port_forwards() {
  rm -f "${PID_DIR}"/*.pid 2>/dev/null || true
  pkill -f "kubectl port-forward" 2>/dev/null || true
}

trap cleanup_port_forwards EXIT INT TERM

wait_for_rollout() {
  local kind="$1"
  local name="$2"
  local ns="$3"
  kubectl rollout status "${kind}/${name}" -n "${ns}" --timeout=240s
}

start_port_forward() {
  local ns="$1"
  local svc="$2"
  local from="$3"
  local to="$4"

  kubectl port-forward -n "${ns}" "svc/${svc}" "${from}:${to}" >/dev/null 2>&1 &
  local pid=$!
  echo "${pid}" > "${PID_DIR}/${ns}-${svc}.pid"
}

main() {
  cd "${ROOT_DIR}"

  require_cmd minikube
  require_cmd kubectl
  require_cmd docker
  require_cmd curl

  log "Starting Minikube..."
  minikube start --cpus=2 --memory=4096 --driver=docker
  eval "$(minikube docker-env)"

  log "Building Docker images..."
  retry_cmd 3 docker build -t "${FRONTEND_IMAGE}" ./frontend
  retry_cmd 3 docker build -t "${BACKEND_IMAGE}" ./backend
  retry_cmd 3 docker build -t "${AI_IMAGE}" ./ai-proctoring

  log "Ensuring namespaces..."
  kubectl apply -f k8s/namespace.yaml
  kubectl get ns "${MON_NS}" >/dev/null 2>&1 || kubectl create ns "${MON_NS}"
  kubectl get ns "${ARGO_NS}" >/dev/null 2>&1 || kubectl create ns "${ARGO_NS}"

  log "Deploying core application stack..."
  kubectl apply -f k8s/postgres.yaml
  kubectl apply -f k8s/redis.yaml
  kubectl apply -f k8s/backend.yaml
  kubectl apply -f k8s/frontend.yaml
  kubectl apply -f k8s/ai-proctoring.yaml
  kubectl apply -f k8s/prometheus.yaml
  kubectl apply -f k8s/grafana.yaml

  kubectl set image deployment/frontend frontend="${FRONTEND_IMAGE}" -n "${NAMESPACE}"
  kubectl set image deployment/backend backend="${BACKEND_IMAGE}" -n "${NAMESPACE}"
  kubectl set image deployment/ai-proctoring ai-proctoring="${AI_IMAGE}" -n "${NAMESPACE}"

  log "Waiting for pods..."
  wait_for_rollout deployment postgres "${NAMESPACE}"
  wait_for_rollout deployment redis "${NAMESPACE}"
  wait_for_rollout deployment backend "${NAMESPACE}"
  wait_for_rollout deployment frontend "${NAMESPACE}"
  wait_for_rollout deployment ai-proctoring "${NAMESPACE}"
  wait_for_rollout deployment prometheus "${MON_NS}"
  wait_for_rollout deployment grafana "${MON_NS}"

  log "Installing ArgoCD..."
  retry_cmd 3 kubectl apply -n "${ARGO_NS}" -f "https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml"
  wait_for_rollout deployment argocd-server "${ARGO_NS}"
  kubectl apply -f argocd/application.yaml

  cleanup_port_forwards
  log "Starting port-forwards..."
  start_port_forward "${NAMESPACE}" frontend "${FRONTEND_PORT}" 80
  start_port_forward "${NAMESPACE}" backend "${BACKEND_PORT}" 4000
  start_port_forward "${NAMESPACE}" ai-proctoring "${AI_PORT}" 8000
  start_port_forward "${MON_NS}" grafana "${GRAFANA_PORT}" 3000
  start_port_forward "${MON_NS}" prometheus "${PROM_PORT}" 9090
  start_port_forward "${ARGO_NS}" argocd-server "${ARGO_PORT}" 80

  sleep 5

  log ""
  log "Frontend:    http://localhost:${FRONTEND_PORT}"
  log "Backend:     http://localhost:${BACKEND_PORT}/api/health"
  log "AI Service:  http://localhost:${AI_PORT}/health"
  log "Grafana:     http://localhost:${GRAFANA_PORT} (admin/admin123)"
  log "Prometheus:  http://localhost:${PROM_PORT}"
  log "ArgoCD:      http://localhost:${ARGO_PORT} (admin / run: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode)"
  log ""
  log "System is up. Press Ctrl+C to stop."

  while true; do sleep 60; done
}

main "$@"
