# 可选服务端发布

本地开发不依赖 Kubernetes。`.github/workflows/deploy.yaml` 默认关闭，只有 main 且仓库 Variable `DEPLOY_ENABLED=true` 时执行。首次发布使用手动触发 `force=true`。配置变更或密钥轮换也用 force=true；仅修改 GitHub Variables/Secrets 不会自动触发 push。

## 请求与发布链路

客户端 → HTTPS Ingress → ClusterIP Service → Admin(:3000)/API(:4000) → PostgreSQL/对象存储。

默认 ingressClass 为 nginx 时，API Ingress 配置 11 MiB 请求体上限，给 10 MiB 附件留出 multipart 开销，避免请求先被代理拒绝。使用其他 ingressClass/controller 时，需同步配置其请求体限制。参见 [ingress-nginx 的 body-size 配置](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#custom-max-body-size)。

发布顺序：检查 → 根据上次成功 rollout 的提交计算影响范围 → 构建所需 API/Admin/migration 镜像 → 记录 digest → 迁移 Job 成功 → 更新应用 Secret/ConfigMap → Terraform 更新 Deployment → 等待 rollout。

失败的发布不能作为下一次增量基线；没有可信基线时全量构建。较旧提交的重跑会在修改集群前被拒绝。所有发布共享并发组且不会取消正在运行的迁移。共享服务变更触发 API/Admin，DB/锁文件/部署配置变更还会运行 migration。镜像以提交 SHA 标记，以 registry digest 实际部署；不会使用 latest。

## 一次性准备

1. 准备 Kubernetes 集群和目标 namespace。模板不创建集群、数据库、Ingress Controller 或 TLS 证书。
2. 准备 GitHub Environment `production`，按团队要求配置分支和人工审批规则。
3. 准备 kubeconfig 与最小权限：目标 namespace 的 ConfigMap、Secret、Deployment、Service、Ingress、Job、Pod 日志和 rollout；Terraform Kubernetes backend 还需要状态 Secret 与锁所需的 Lease 权限。读取 namespace 需要相应权限。
4. 镜像默认发布到 `ghcr.io/<owner>/<repo>/<component>`。私有包需在 namespace 创建 imagePullSecret，设置 `K8S_IMAGE_PULL_SECRET`；registry 凭据由维护者配置，模板不持久化 GitHub 临时令牌到集群。
5. 配置以下 Variables/Secrets，完成检查后显式开启 `DEPLOY_ENABLED`。

## GitHub 配置

仓库 Variable `DEPLOY_ENABLED=true` 控制是否运行。其余 Variables 放 `production` Environment：

| 名称 | 用途 |
| --- | --- |
| `K8S_NAMESPACE` | 已存在的目标 namespace |
| `APP_NAME` | 资源前缀，默认 starter，DNS label，最多40字符 |
| `K8S_IMAGE_PULL_SECRET` | 已存在的私有 registry Secret，公开镜像可空 |
| `API_CONFIG_JSON` | API 普通环境变量，JSON对象，所有值为字符串 |
| `ADMIN_CONFIG_JSON` | Admin 普通环境变量，JSON对象，所有值为字符串 |
| `K8S_HOSTS_JSON` | 可选 `{"api":"api.example.com","admin":"admin.example.com"}`；值为不同的有效 DNS 主机名，不带协议、端口或通配符 |
| `K8S_INGRESS_CLASS` | 默认 nginx |
| `K8S_TLS_SECRET` | 已存在TLS证书Secret；正式公网入口应配置HTTPS |
| `ALIYUN_ROLE_ARN` / `ALIYUN_OIDC_PROVIDER_ARN` | 可选 ACK 的 GitHub OIDC 角色与提供方 |

脚本在连接集群前验证 API 的 AUTH_URL、BETTER_AUTH_URL、ALLOWED_ORIGINS、S3_BUCKET，以及 Admin 的 BETTER_AUTH_URL；静态 S3 凭据须成对配置。ALLOWED_ORIGINS 使用逗号分隔的精确 origin，不包含路径或通配符。无效配置不会先运行迁移或覆盖 Secret；Secret 提交错误不输出可能包含 stringData 的原始 stderr。

普通配置示例（按实际域名和对象存储修改）：

```json
{
  "AUTH_URL": "https://api.example.com",
  "BETTER_AUTH_URL": "https://api.example.com",
  "ALLOWED_ORIGINS": "https://admin.example.com,https://app.example.com",
  "S3_REGION": "us-east-1",
  "S3_BUCKET": "my-product-private-files",
  "LOG_LEVEL": "info"
}
```

Admin 至少配置 `BETTER_AUTH_URL=https://admin.example.com`。公开协议页的 `LEGAL_APP_NAME`、`LEGAL_OPERATOR_NAME`、`LEGAL_CONTACT_EMAIL`、`LEGAL_VERSION` 也放入 `ADMIN_CONFIG_JSON`；版本应与客户端发布的 `LEGAL_VERSION` 一致。自建 S3/MinIO/OSS 使用可选 `S3_ENDPOINT`；签名下载 URL 必须能被客户端访问，不能指向仅集群内部可达地址。

Secrets 放同一 Environment：

| 名称 | 用途 |
| --- | --- |
| `KUBE_CONFIG_BASE64` | kubeconfig 的 base64内容；临时文件在任务结束删除 |
| `DATABASE_URL` | 此次迁移、API、Admin统一使用的数据库 |
| `API_ENV_JSON` | AUTH_SECRET、BETTER_AUTH_SECRET，以及可选S3凭据 |
| `ADMIN_ENV_JSON` | BETTER_AUTH_SECRET |

密钥至少32字符，使用独立随机值。API 的静态对象存储凭据字段为 `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`；使用云环境默认凭据链时可不提供这两个字段。默认模板没有接入阿里云 RRSA 专有凭据适配器，相关扩展见 optional-integrations.md。

`PORT/HOSTNAME/NODE_ENV` 由部署控制，Secret 不允许覆盖；敏感变量不允许放 ConfigMap。ConfigMap 全部内容与应用 Secret 摘要进入 Pod template，配置变化会触发新 Pod，即使镜像不变。

## ACK OIDC

不设置阿里云变量时使用 kubeconfig 中原有身份，适用于其他 Kubernetes 环境。设置角色和提供方 ARN 时，workflow 获取临时阿里云凭据并安装 `ack-ram-tool`。这时 kubeconfig 的 user 应使用 exec 插件，不应保留长期 client-key/token；示例 user 部分：

```yaml
users:
  - name: github-oidc
    user:
      exec:
        apiVersion: client.authentication.k8s.io/v1beta1
        command: ack-ram-tool
        args:
          - credential-plugin
          - get-token
          - --cluster-id
          - <cluster-id>
          - --region-id
          - <region>
          - --api-version
          - client.authentication.k8s.io/v1beta1
```

角色信任策略应限定仓库、分支/Environment和 audience；集群内的 RBAC 映射单独配置。模板不包含 Wabash 的账户、集群或跨账户 role chaining。OIDC 只解决 CI 身份，不自动授予 Pod 对云服务的权限。

## Terraform 与运行时

统一入口 `infra/k8s`，原应用目录的不完整 Terraform 已移除。backend 使用目标集群中的 Secret 保存状态，以 namespace+APP_NAME隔离；state可能包含敏感运行信息，严格控制其读权限并备份，不提交state或本地kubeconfig。

API readiness `/ready` 验证数据库可用，liveness `/health` 只验证进程；Admin `/api/health` 无需登录且不访问数据库。应用和迁移 Job 均显式配置非root、禁止提权、移除capabilities并使用RuntimeDefault seccomp；应用容器设定资源request/limit；按实际负载调整。服务默认一个副本，滚动更新保留可用实例。日志输出stdout，API有request id，客户端诊断字段限长；Admin审计记录操作者/组织/动作/结果并脱敏。

迁移使用独立Job、专用临时DB Secret、10分钟deadline和零自动重试。确认成功后才更新正式应用Secret，失败会保留Job用于诊断并清理临时Secret。Job历史保留一天；应额外用平台日志系统收集长期诊断。迁移、查询状态或日志命令失败均阻断发布。

本地无集群校验：

```sh
terraform -chdir=infra/k8s init -backend=false
terraform -chdir=infra/k8s validate
node scripts/check-workflows.cjs
node --test scripts/deployment*.test.cjs scripts/deploy-k8s*.test.cjs
```

## 回滚与失败处理

镜像失败时保留失败日志，恢复兼容schema的已知digest；数据库迁移不自动反向执行。修改正式Secret后若Terraform失败，已有Pod不会立即更新其环境，但重建Pod会使用新Secret，因此需要按发布记录恢复配套配置后再恢复镜像，不能仅执行镜像回滚。

推荐修复后在main提交回退变更，再执行force发布，以保持基线、镜像与配置可追溯。紧急手动操作需同时记录旧digest、配置版本与数据库兼容情况，之后修正声明配置防止下一次apply覆盖。绝不通过重新运行旧提交来绕过主干检查。

此模板验证脚本控制流与配置语法；真实集群RBAC、域名、TLS、云身份、镜像拉取和生产数据迁移必须在项目环境验收。
