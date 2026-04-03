resource "kubernetes_secret_v1" "admin" {
  metadata {
    name = "admin-secrets"
  }

  type = "Opaque"

  data = {
    ACCESS_KEY_ID     = var.access_key_id
    ACCESS_KEY_SECRET = var.access_key_secret
    BETTER_AUTH_SECRET = var.better_auth_secret
    DATABASE_URL      = var.database_url
    # Add your custom secrets here, e.g.:
    # LLM_API_KEY       = var.llm_api_key
  }
}
