resource "kubernetes_config_map_v1" "api" {
  metadata {
    name = "api-config"
  }

  data = {
    MINIO_BUCKET   = var.minio_bucket
    MINIO_ENDPOINT = var.minio_endpoint
    # Add your custom config values here
  }
}
