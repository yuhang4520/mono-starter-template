resource "kubernetes_config_map_v1" "admin" {
  metadata {
    name = "admin-config"
  }

  data = {
    ADMIN_PHONE      = var.admin_phone
    BETTER_AUTH_URL  = var.better_auth_url
    MINIO_BUCKET     = var.minio_bucket
    MINIO_ENDPOINT   = var.minio_endpoint
    # Add your custom config values here
  }
}
