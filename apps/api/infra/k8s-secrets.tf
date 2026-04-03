resource "kubernetes_secret_v1" "api" {
  metadata {
    name = "api-secrets"
  }

  type = "Opaque"

  data = {
    ACCESS_KEY_ID     = var.access_key_id
    ACCESS_KEY_SECRET = var.access_key_secret
    AUTH_SECRET       = var.auth_secret
    AUTH_URL          = var.auth_url
    DATABASE_URL      = var.database_url
    # Add your custom secrets here, e.g.:
    # LLM_API_KEY = var.llm_api_key
  }
}
