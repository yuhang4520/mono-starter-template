provider "alicloud" {
  region        = "cn-chengdu"
  ecs_role_name = "githubactionsrole"
}

provider "kubernetes" {
  host                   = local.host
  cluster_ca_certificate = local.ca

  # IMPORTANT: to make the k8s identity be RAM role mapping githubactionsrole,
  # use exec-token auth (ack-ram-tool) rather than client certs.
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "ack-ram-tool"
    args = [
      "credential-plugin", "get-token",
      "--cluster-id", local.cluster_id,
      "--api-version", "v1beta1",
      "--log-level", "error",
      # optional but recommended to avoid default cn-hangzhou surprises:
      "--region-id", var.region,
    ]
  }
}
