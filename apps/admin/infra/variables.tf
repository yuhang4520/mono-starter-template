variable "region" {
  type        = string
  description = "Region, e.g. cn-chengdu"
  default     = "cn-chengdu"
}

variable "cluster_name" {
  type    = string
  default = "your-k8s-cluster"
}

variable "acr_repo" {
  type    = string
  default = "registry.example.com/your-namespace/admin"
}

variable "acr_repo_tag" {
  type    = string
  default = "latest"
}

variable "minio_bucket" {
  type    = string
  default = "your-bucket-name"
}

variable "admin_phone" {
  type    = string
  default = "13800000000"
  description = "Admin phone number for auto-role assignment"
}

variable "better_auth_url" {
  type    = string
  default = "https://admin.example.com"
}

variable "minio_endpoint" {
  type    = string
  default = "oss-cn-chengdu.aliyuncs.com"
}

variable "access_key_id" {
  type      = string
  sensitive = true
}

variable "access_key_secret" {
  type      = string
  sensitive = true
}

variable "better_auth_secret" {
  type      = string
  sensitive = true
}

variable "database_url" {
  type      = string
  sensitive = true
}

variable "llm_api_key" {
  type      = string
  sensitive = true
  default   = ""
  description = "LLM API Key for AI features (optional)"
}
