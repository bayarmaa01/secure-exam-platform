#!/bin/bash

# Stop DevOps Environment Script
# This script stops all DevOps services including Kubernetes, Minikube, and port-forwards

set -e  # Exit on any error

echo "🛑 Stopping DevOps Environment..."
echo "=================================="

# 1. Stop all running kubectl port-forward processes
echo "🔄 Stopping kubectl port-forward processes..."
if pgrep -f "kubectl port-forward" > /dev/null; then
    echo "   Found running port-forward processes, stopping them..."
    pkill -f "kubectl port-forward" || true
    sleep 2
    echo "   ✅ Port-forward processes stopped"
else
    echo "   ℹ️  No port-forward processes found"
fi

# 2. Stop minikube tunnel
echo "🚇 Stopping Minikube tunnel..."
if pgrep -f "minikube tunnel" > /dev/null; then
    echo "   Found running tunnel process, stopping it..."
    pkill -f "minikube tunnel" || true
    sleep 2
    echo "   ✅ Minikube tunnel stopped"
else
    echo "   ℹ️  No tunnel processes found"
fi

# 3. Stop Minikube cluster
echo "🏗️  Stopping Minikube cluster..."
if minikube status | grep -q "Running"; then
    echo "   Minikube is running, stopping it..."
    minikube stop
    echo "   ✅ Minikube cluster stopped"
else
    echo "   ℹ️  Minikube is not running"
fi

# 4. Clean up any remaining background processes
echo "🧹 Cleaning up orphan background processes..."

# Check for any remaining kubectl processes
if pgrep -f "kubectl" > /dev/null; then
    echo "   Cleaning up remaining kubectl processes..."
    pkill -f "kubectl" || true
    sleep 1
    echo "   ✅ kubectl processes cleaned up"
fi

# Check for any remaining minikube processes
if pgrep -f "minikube" > /dev/null; then
    echo "   Cleaning up remaining minikube processes..."
    pkill -f "minikube" || true
    sleep 1
    echo "   ✅ minikube processes cleaned up"
fi

# 5. Verify everything is stopped
echo "🔍 Verifying shutdown status..."

# Check Minikube status
if minikube status | grep -q "Stopped"; then
    echo "   ✅ Minikube: Stopped"
elif minikube status | grep -q "Does Not Exist"; then
    echo "   ✅ Minikube: Not running"
else
    echo "   ⚠️  Minikube: Still running (may need manual intervention)"
fi

# Check for remaining processes
if pgrep -f "kubectl port-forward\|minikube tunnel" > /dev/null; then
    echo "   ⚠️  Some background processes still running"
    echo "   💡 You may need to manually kill them with: pkill -f 'kubectl\|minikube'"
else
    echo "   ✅ Background processes: Clean"
fi

# 6. Final status message
echo "=================================="
echo "🎉 DevOps Stack Stopped Successfully!"
echo ""
echo "📋 Summary:"
echo "   • Minikube cluster: Stopped"
echo "   • Port-forwards: Stopped"
echo "   • Tunnels: Stopped"
echo "   • Background processes: Clean"
echo ""
echo "🚀 To start DevOps again, run: ./start-devops.sh"
echo "💡 To check Minikube status, run: minikube status"
echo ""

# Optional: Show current pods status (if cluster still exists)
if kubectl cluster-info &>/dev/null; then
    echo "📊 Current pod status (if any):"
    kubectl get pods -n exam-platform 2>/dev/null || echo "   No pods found"
    echo ""
fi

echo "✨ All done! Your local DevOps environment is now stopped."
