# mono-starter-template

基于 pnpm workspace 的全栈模板：Next.js Admin、Fastify + tRPC API、Vue / uni-app 客户端、PostgreSQL + Drizzle。默认本地开发只需要 Node 22、pnpm 10.26.2 和 Docker；云部署与原生打包按需启用。

## 已提供的闭环

- Admin 注册/登录、组织创建/切换、成员管理、组织内笔记 CRUD、平台用户禁用与会话撤销。
- App 手机号密码登录、当前用户、JWT 刷新/退出、图片上传和私有预览。
- Admin Cookie 与 App JWT 分开传输；JWT 绑定可撤销数据库会话；封禁与成员权限实时查询。
- 共享组织服务对每次业务查询限定组织范围；平台管理员不会自动绕过租户成员校验。
- Server Action 审计、敏感字段脱敏、客户端版本/平台诊断。
- PR 类型/构建/行为测试；可选 Kubernetes 发布、H5/微信发布、Android/iOS 打包与独立分发。

## 从新目录开始

```sh
node init.js --prefix=my-product
pnpm install
pnpm infra:up
pnpm db:migrate
```

初始化会重命名包、导入路径和锁文件引用，分配本地端口，生成随机凭据，创建根目录、DB、API、Admin 和 App 的环境文件。已有 `.env` 或初始化记录时会拒绝覆盖，避免意外轮换凭据。端口和项目名前缀会显示在终端；内部容器端口保持固定。

分别启动：

```sh
pnpm dev:api
pnpm dev:admin
pnpm dev:app
```

默认地址（端口冲突时以初始化输出为准）：

| 服务 | 地址 |
| --- | --- |
| Admin | http://localhost:3000 |
| API 存活 / 就绪 | http://localhost:4000/health / http://localhost:4000/ready |
| tRPC | http://localhost:4000/api/trpc |
| H5 | http://localhost:5173 |
| PostgreSQL | localhost:5342 |
| MinIO API / Console | http://127.0.0.1:9000 / http://127.0.0.1:9001 |

先在 Admin 注册账号，同一手机号和密码可登录 App。组织页可创建团队并切换，owner/admin 可编辑笔记，member 只读。添加成员需使用已注册用户的账号邮箱（手机账号为 `<手机号>@customer.example.local`，工作台可查看）。

手机号目前是登录标识，未接短信所有权验证；公开注册始终创建普通用户，不按手机号自动授予管理员。验证码/短信方案见[可选扩展](docs/optional-integrations.md)。

首次平台管理员通过显式本地维护命令创建：

```sh
pnpm bootstrap:admin '<已注册账号邮箱>'
```

该命令读取 `packages/db/.env`，事务内检查是否已有管理员，重复执行会拒绝。平台用户管理可禁用普通账号或撤销其会话，不能禁用自身或其他管理员。生产操作前确认实际 DATABASE_URL；初始化不会自动升级任何账号。

## 目录与调用边界

```text
apps/admin       Next.js 页面、Server Actions、Cookie 认证
apps/api         Fastify/tRPC、JWT 认证、附件上传
apps/app         uni-app 多端客户端
packages/db      Schema、增量迁移、数据库连接
packages/workspace  Admin/API 复用的组织权限与笔记服务
infra/k8s        可选 Kubernetes / Terraform 部署
scripts/native  可选客户端构建/分发脚本
```

Admin 的 Server Actions 和 API 的 tRPC router 都调用 `@your-project/workspace`。新增共享业务放入对应共享包，客户端只导入 `AppRouter` 类型，不能导入服务端运行时代码。模板已有 Panel/表格/表单组件，可按业务复用。

## 隐私协议与设备权限

登录页需要明确同意协议；个人页可随时重新阅读。协议正文由 Admin 的公开路径 `/app-agreement/privacy` 和 `/app-agreement/user` 提供，不需要登录或数据库连接。页面是待运营方完善的模板正文，不能直接作为已审核的正式协议。

- App 配置 `VITE_PRIVACY_URL`、`VITE_AGREEMENT_URL`、`VITE_LEGAL_VERSION`；初始化会让本地协议地址跟随 Admin 实际端口。已有项目需手动补入 App 环境文件，初始化不会覆盖既有配置。
- Admin 配置 `LEGAL_APP_NAME`、`LEGAL_OPERATOR_NAME`、`LEGAL_CONTACT_EMAIL`、`LEGAL_VERSION`。将服务端 `LEGAL_VERSION` 与客户端版本保持一致。生产放入 `ADMIN_CONFIG_JSON`，更新会触发滚动部署。
- 正式客户端必须配置有效 HTTPS 地址；本地开发和显式 `VITE_DEPLOY_ENV=local` 的本地构建允许 loopback HTTP 协议地址。云发布强制 `VITE_DEPLOY_ENV=production`，使用 `client-production` Variables `PRIVACY_URL`、`AGREEMENT_URL`、`LEGAL_VERSION`，同时生成客户端配置与 Android 原生弹窗版本。手工 HBuilderX 正式打包也须设置 production 并同步 `androidPrivacy.json`，不能发布其中的示例地址。
- 同意记录保存在当前设备，绑定协议版本、两个地址和同意时间；不把旧布尔标记当成新协议授权。所有平台已有登录会话在协议变更后须重新确认；鸿蒙匿名首次启动也进入门禁，其他平台匿名用户在登录时勾选。门禁期间不刷新登录状态、不读取账号、不选择或上传图片，拒绝后仍可阅读协议。
- 协议阅读使用专用公开页面，只接受 `privacy` / `user` 两种类型；任意 URL 的通用 WebView 仍需登录。H5 正文使用 iframe，外部协议站点须允许嵌入；微信小程序需在平台配置协议域名为可用的业务域名，并确认账号具备 WebView 能力。
- 图片选择取消不提示错误；明确权限拒绝时引导设置，无法打开设置时给出手动说明。不会为选择图片申请“保存到相册”权限，也不会预先申请录音或摄像头权限。

记录仅用于客户端流程控制，不是服务端协议签署审计。需要可追溯的服务端协议记录时，应另建版本/用户/同意事件模型。本轮不涉及账号注销或业务数据库迁移。

## 配置与数据库

正常使用初始化命令，不提交生成的 `.env`。手动配置时复制各 `.env.example`，替换所有占位值，并保持 DB 密码、MinIO 密码、端口、URL 一致。API 启动要求有效的 `AUTH_SECRET` / `AUTH_URL`，生产配置还需 `BETTER_AUTH_SECRET` 和精确的 `ALLOWED_ORIGINS`。

Compose 仅创建空数据库和私有 bucket，不自动建业务表。数据库变更使用：

```sh
pnpm db:generate  # 生成并审查 SQL，不执行数据库变更
pnpm db:migrate   # 对显式目标库执行已有 migration
```

不要把 `db push` 当作生产发布流程。旧版模板通过 docker-init 建表但没有迁移记录的数据库，需要先按[迁移说明](docs/database.md)处理，不能直接重放首次建表 SQL。

## 验证

```sh
pnpm type-check
pnpm test:scripts
pnpm --dir apps/app test
pnpm --dir apps/admin lint
pnpm --dir apps/app lint
pnpm build
```

API/Admin 集成测试仅接受显式 `TEST_DATABASE_URL`，缺少时明确跳过，不能把跳过当作完整验收。运行隔离测试库时先迁移，设置 `DATABASE_URL` 与 `TEST_DATABASE_URL` 为同一测试库，再运行 `pnpm test`。MinIO 集成测试另需 `TEST_S3_ENDPOINT` 和 `S3_*` 配置。CI 自动提供一次性 PostgreSQL/MinIO。

原生资源编译：`pnpm --dir apps/app build:app`、`pnpm --dir apps/app build:app-harmony`。资源编译通过不代表云签名、商店发布或真机验收。

## 发布

- [服务端发布、变量、回滚](docs/deployment.md)
- [客户端发布与签名配置](scripts/native/README.md)
- [数据库兼容性与迁移](docs/database.md)
- [第四批可选能力接入说明](docs/optional-integrations.md)
- [本次升级验收记录](docs/template-upgrade-plan.md)

云发布默认关闭；本地初始化不创建任何云资源。构建镜像：

```sh
docker build -f apps/api/Dockerfile -t my-product/api .
docker build -f apps/admin/Dockerfile -t my-product/admin .
docker build -f packages/db/Dockerfile -t my-product/migration .
```

镜像中不包含本地环境文件，运行时由部署环境注入配置。正式项目应按自身维护策略固定、更新基础镜像，并在更新后验证三种镜像。

## License

MIT
