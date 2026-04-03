# mono-starter-template

一个全栈 Monorepo 启动模板，包含管理后台（Next.js）、后端 API（Fastify + tRPC）、多端应用（uni-app）和共享数据库层（Drizzle ORM）。

## 核心特性

- 🔐 **权限管理系统** - Better Auth 内置平台级权限（admin/user）和多租户权限（owner/admin/member），支持细粒度权限控制
- 🏢 **多租户支持** - 基于 Organization 插件实现租户隔离
- 📱 **多端应用** - uni-app 支持微信小程序、H5、App
- 🔒 **认证系统** - 手机号/用户名登录，自动管理员分配

## 技术架构

**Monorepo 结构**（pnpm workspaces）：

```
apps/
  admin/  - Next.js 16 + React 19 管理后台
            ├── Better Auth 认证与权限管理
            ├── shadcn/ui 组件库
            └── TanStack Table + React Hook Form
  api/    - Fastify 5 + tRPC 11 后端服务
            ├── Better Auth 服务端 + 权限验证
            └── tRPC Router（类型安全 API）
  app/    - uni-app + Vue 3 多端客户端
            └── 微信小程序/H5/App 多端支持
packages/
  db/     - Drizzle ORM + PostgreSQL Schema
            └── 认证表 + 业务表定义
```

**数据流**: admin/app → tRPC Client → Fastify/tRPC Server → Drizzle → PostgreSQL

## 快速开始

### 0. 初始化项目（可选）

如果需要自定义项目前缀或自动配置端口，运行初始化脚本：

```bash
node init.js
```

脚本会自动：
- 替换包名前缀（默认 `@your-project` → 自定义）
- 检测并分配可用端口（避免冲突）
- 生成随机密钥
- 创建 `.env` 文件

### 1. 安装依赖

```bash
pnpm install
```

### 2. 手动配置（如果不使用 init 脚本）

```bash
# 复制示例环境文件
cp apps/admin/.env.example apps/admin/.env
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/app/env/.env.example apps/app/env/.env.local

# 生成密钥
openssl rand -base64 32  # 用于 BETTER_AUTH_SECRET
```

### 3. 启动本地基础设施

```bash
# 启动 PostgreSQL 和 MinIO (S3 兼容)
docker compose up -d
```

### 4. 数据库迁移

如果使用了 `docker-init` 初始化脚本（默认已配置），数据库会在首次启动时自动创建表结构。

否则手动执行迁移：

```bash
cd packages/db
pnpm drizzle-kit push
```

### 5. 启动开发服务

```bash
# 终端 1: API 服务
pnpm --filter @your-project/api dev

# 终端 2: 管理后台（含权限管理功能）
pnpm --filter @your-project/admin dev

# 终端 3: 多端应用 (微信小程序示例)
pnpm --filter @your-project/app dev:mp-weixin
```

> 💡 **提示**: 运行 `node init.js` 可自动将包名 `@your-project` 替换为你自定义的前缀

## 访问地址

| 服务 | URL | 说明 |
|------|-----|------|
| 管理后台 | http://localhost:3000 | Next.js Admin Dashboard（含权限管理） |
| API 服务 | http://localhost:4000 | Fastify + tRPC |
| tRPC Playground | http://localhost:4000/api/trpc | tRPC 调试 |
| Health Check | http://localhost:4000/health | 健康检查 |
| App H5 | http://localhost:5173 | uni-app H5 |
| PostgreSQL | localhost:5342 | 数据库 |
| MinIO Console | http://localhost:9001 | 对象存储管理 |

> 💡 **提示**: 首次登录时，使用 `ADMIN_PHONE` 环境变量中配置的手机号登录会自动成为管理员，可进行用户管理和角色分配。

## 故障排查

### 端口冲突

如果端口被占用，可使用初始化脚本自动检测并分配可用端口：

```bash
node init.js
```

或手动修改：
- `docker-compose.yaml` - 修改容器端口映射
- `apps/*/.env*` - 修改应用监听端口

## 自定义包名

推荐使用初始化脚本自动替换：

```bash
node init.js
```

或手动全局替换 `@your-project` 为你的包名前缀：

```bash
# macOS/Linux
find . -type f -name "*.json" -o -name "*.ts" -o -name "*.tsx" | \
  xargs sed -i '' 's/@your-project/@your-actual-prefix/g'
```

## 初始化脚本 (init.js)

`init.js` 是一个交互式初始化向导，会帮助你：

1. **自定义包名前缀** - 将 `@your-project/*` 替换为你的组织前缀
2. **自动检测可用端口** - 避免与现有服务冲突
3. **生成安全密钥** - 为 BETTER_AUTH_SECRET 和 AUTH_SECRET 生成随机值
4. **创建环境文件** - 自动复制并配置所有 `.env` 文件

运行一次即可，之后无需再次执行。

## Docker 构建

```bash
# 构建管理后台
docker build -f apps/admin/Dockerfile -t your-project/admin .

# 构建 API 服务
docker build -f apps/api/Dockerfile -t your-project/api .
```

## 发布到 GitHub

```bash
git init
git add .
git commit -m "init: monorepo starter template"
git branch -M main
git remote add origin git@github.com:your-username/your-repo.git
git push -u origin main
```

## 项目约定

### 目录结构
- `apps/` - 独立应用，每个都有自己的启动入口
- `packages/` - 共享包，被多个 apps 引用
- `.localdata/` - 本地运行时数据（已 gitignore）

### 开发规范
- 使用 `pnpm --filter <package> <command>` 运行单个包的脚本
- 数据库迁移在 `packages/db/drizzle/` 中管理
- 环境变量以 `.env.example` 为模板

## License

MIT
