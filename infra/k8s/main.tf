terraform {
  required_version = ">= 1.8"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.38"
    }
  }
  # State is a cluster Secret; initialize with config_path / namespace / secret_suffix.
  backend "kubernetes" {}
}

provider "kubernetes" {
  config_path = var.kubeconfig
}

variable "kubeconfig" { type = string }
variable "namespace" { type = string }
variable "name" {
  type    = string
  default = "starter"
}
variable "images" { type = map(string) }
variable "config" { type = map(map(string)) }
variable "secret_revisions" { type = map(string) }
variable "image_pull_secret" {
  type    = string
  default = ""
}
variable "replicas" {
  type    = number
  default = 1
}
variable "hosts" {
  type    = map(string)
  default = {}
}
variable "ingress_class" {
  type    = string
  default = "nginx"
}
variable "tls_secret" {
  type    = string
  default = ""
}

locals {
  apps = {
    api   = { port = 4000, health = "/health", memory = "512Mi" }
    admin = { port = 3000, health = "/api/health", memory = "768Mi" }
  }
}

resource "kubernetes_config_map_v1" "app" {
  for_each = local.apps
  metadata {
    name      = "${var.name}-${each.key}"
    namespace = var.namespace
  }
  data = merge(var.config[each.key], {
    NODE_ENV = "production", HOSTNAME = "0.0.0.0", PORT = tostring(each.value.port)
  })
}

resource "kubernetes_deployment_v1" "app" {
  for_each = local.apps
  metadata {
    name      = "${var.name}-${each.key}"
    namespace = var.namespace
  }
  wait_for_rollout = true
  timeouts {
    create = "10m"
    update = "10m"
  }
  spec {
    replicas                  = var.replicas
    progress_deadline_seconds = 300
    selector { match_labels = { app = "${var.name}-${each.key}" } }
    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "1"
        max_unavailable = "0"
      }
    }
    template {
      metadata {
        labels = { app = "${var.name}-${each.key}" }
        annotations = {
          "config-sha256" = sha256(jsonencode(kubernetes_config_map_v1.app[each.key].data))
          "secret-sha256" = var.secret_revisions[each.key]
        }
      }
      spec {
        termination_grace_period_seconds = 30
        dynamic "image_pull_secrets" {
          for_each = var.image_pull_secret == "" ? [] : [var.image_pull_secret]
          content { name = image_pull_secrets.value }
        }
        security_context {
          run_as_non_root = true
          run_as_user     = 1001
          fs_group        = 1001
          seccomp_profile { type = "RuntimeDefault" }
        }
        container {
          name  = each.key
          image = var.images[each.key]
          port { container_port = each.value.port }
          env_from {
            config_map_ref { name = kubernetes_config_map_v1.app[each.key].metadata[0].name }
          }
          env_from {
            secret_ref { name = "${var.name}-${each.key}" }
          }
          resources {
            requests = { cpu = "100m", memory = "128Mi" }
            limits   = { cpu = "1", memory = each.value.memory }
          }
          readiness_probe {
            http_get {
              path = each.key == "api" ? "/ready" : each.value.health
              port = each.value.port
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
          liveness_probe {
            http_get {
              path = each.value.health
              port = each.value.port
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }
          security_context {
            allow_privilege_escalation = false
            capabilities { drop = ["ALL"] }
          }
        }
      }
    }
  }
}

resource "kubernetes_service_v1" "app" {
  for_each = local.apps
  metadata {
    name      = "${var.name}-${each.key}"
    namespace = var.namespace
  }
  spec {
    selector = { app = "${var.name}-${each.key}" }
    port {
      port        = 80
      target_port = each.value.port
    }
  }
}

resource "kubernetes_ingress_v1" "app" {
  for_each = var.hosts
  metadata {
    name      = "${var.name}-${each.key}"
    namespace = var.namespace
    # Allow the API's 10 MiB file plus multipart overhead through ingress-nginx.
    annotations = each.key == "api" && var.ingress_class == "nginx" ? {
      "nginx.ingress.kubernetes.io/proxy-body-size" = "11m"
    } : {}
  }
  spec {
    ingress_class_name = var.ingress_class
    dynamic "tls" {
      for_each = var.tls_secret == "" ? [] : [var.tls_secret]
      content {
        hosts       = [each.value]
        secret_name = tls.value
      }
    }
    rule {
      host = each.value
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service_v1.app[each.key].metadata[0].name
              port { number = 80 }
            }
          }
        }
      }
    }
  }
}
