terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
}

provider "kubernetes" {
  config_path = "~/.kube/config"
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

resource "kubernetes_namespace" "exam_platform" {
  metadata {
    name = "exam-platform"
    labels = {
      "app.kubernetes.io/name" = "exam-platform"
    }
  }
}

resource "helm_release" "exam_platform" {
  name       = "exam-platform"
  repository = "https://charts.bitnami.com/bitnami"
  chart      = "postgresql"
  namespace  = kubernetes_namespace.exam_platform.metadata[0].name
  wait       = true

  set {
    name  = "auth.username"
    value = "postgres"
  }

  set_sensitive {
    name  = "auth.password"
    value = var.db_password
  }

  set {
    name  = "auth.database"
    value = "exam_platform"
  }
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = "changeme"
}
