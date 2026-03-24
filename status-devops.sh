#!/bin/bash

# DevOps Status Script
# This script shows the status of the entire Kubernetes DevOps stack

set -e  # Exit on any error

echo "📊 DevOps Environment Status"
echo "=========================="
echo ""

# 1. Minikube status
echo "🏗️  Minikube Status"
echo "-------------------"
if command -v minikube &>/dev/null; then
    if minikube status 2>/dev/null | grep -q "Running"; then
        echo "   ✅ Minikube is Running"
        minikube status | head -5
    else
        echo "   ❌ Minikube is Not Running"
        echo "   💡 Start with: minikube start"
    fi
else
    echo "   ❌ Minikube is Not Installed"
fi
echo ""

# 2. Kubernetes nodes
echo "🖥️  Kubernetes Nodes"
echo "---------------------"
if kubectl cluster-info &>/dev/null; then
    kubectl get nodes -o wide
    echo ""
else
    echo "   ❌ Cannot connect to Kubernetes cluster"
fi

# 3. All running pods across namespaces
echo "📦 All Pods (All Namespaces)"
echo "------------------------------"
if kubectl get pods -A &>/dev/null; then
    kubectl get pods -A --no-headers | awk '{print "   " $1 "/" $2 "/" $3}' | column -t
    echo ""
else
    echo "   ❌ Cannot access pods"
fi

# 4. Services across namespaces
echo "🔗 Services (All Namespaces)"
echo "---------------------------"
if kubectl get svc -A &>/dev/null; then
    kubectl get svc -A --no-headers | awk '{print "   " $1 "/" $2 "/" $3}' | column -t
    echo ""
else
    echo "   ❌ Cannot access services"
fi

# 5. Ingress resources
echo "🌐 Ingress Resources"
echo "-------------------"
if kubectl get ingress -A &>/dev/null; then
    kubectl get ingress -A --no-headers | awk '{print "   " $1 "/" $2 "/" $3}' | column -t
    echo ""
else
    echo "   ❌ Cannot access ingress resources"
fi

# 6. ArgoCD pods in namespace argocd
echo "🚢 ArgoCD Pods (argocd namespace)"
echo "-----------------------------------"
if kubectl get pods -n argocd &>/dev/null; then
    argocd_pods=$(kubectl get pods -n argocd --no-headers 2>/dev/null | wc -l)
    if [ "$argocd_pods" -gt 0 ]; then
        echo "   ✅ ArgoCD namespace exists"
        kubectl get pods -n argocd
    else
        echo "   ❌ No ArgoCD pods found"
    fi
else
    echo "   ❌ ArgoCD namespace not accessible"
fi
echo ""

# 7. Monitoring stack pods (Prometheus and Grafana) in namespace monitoring
echo "📈 Monitoring Stack (monitoring namespace)"
echo "----------------------------------------"
if kubectl get pods -n monitoring &>/dev/null; then
    monitoring_pods=$(kubectl get pods -n monitoring --no-headers 2>/dev/null | wc -l)
    if [ "$monitoring_pods" -gt 0 ]; then
        echo "   ✅ Monitoring namespace exists"
        kubectl get pods -n monitoring
    else
        echo "   ❌ No monitoring pods found"
    fi
else
    echo "   ❌ Monitoring namespace not accessible"
fi
echo ""

# 8. Application pods in namespace exam-platform
echo "🎯 Application Pods (exam-platform namespace)"
echo "------------------------------------------"
if kubectl get pods -n exam-platform &>/dev/null; then
    app_pods=$(kubectl get pods -n exam-platform --no-headers 2>/dev/null | wc -l)
    if [ "$app_pods" -gt 0 ]; then
        echo "   ✅ Application namespace exists"
        kubectl get pods -n exam-platform
    else
        echo "   ❌ No application pods found"
    fi
else
    echo "   ❌ Application namespace not accessible"
fi
echo ""

# Summary section
echo "📋 Quick Summary"
echo "================"
echo ""

# Count total pods
if kubectl get pods -A &>/dev/null; then
    total_pods=$(kubectl get pods -A --no-headers | wc -l)
    running_pods=$(kubectl get pods -A --no-headers | grep "Running" | wc -l)
    echo "   📦 Total Pods: $total_pods"
    echo "   ✅ Running Pods: $running_pods"
    echo "   ⚠️  Failed/Pending Pods: $((total_pods - running_pods))"
else
    echo "   ❌ Cannot access cluster"
fi

# Check Minikube addons
if command -v minikube &>/dev/null && minikube status 2>/dev/null | grep -q "Running"; then
    echo ""
    echo "🔧 Minikube Addons Status:"
    minikube addons list | head -10
fi

echo ""
echo "🎉 Status Check Complete!"
echo ""
echo "💡 Useful Commands:"
echo "   • Start DevOps: ./start-devops.sh"
echo "   • Stop DevOps: ./stop-devops.sh"
echo "   • Access apps: minikube service list"
echo "   • Dashboard: minikube dashboard"
echo ""
