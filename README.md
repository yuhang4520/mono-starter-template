# mono-starter-template

一个全栈 Monorepo 启动模板，包含管理后台（Next.js）、后端 API（Fastify + tRPC）、多端应用（uni-app）和共享数据库层（Drizzle ORM）。

## 项目结构

```
.
├── apps/
│   ├── admin/     # 管理后台 (Next.js 16 + React 19)
│   ├── api/       # 后端 API (Fastify + tRPC)
│   └── app/       # 多端客户端 (uni-app + Vue 3)
├── packages/
│   ├── db/        # 数据库 Schema 和客户端 (Drizzle ORM + PostgreSQL)
│   └── tsconfig/  # 共享 TypeScript 配置
└── ...
```

## 技术栈

### 管理后台 (@your-project/admin)
- **框架**: Next.js 16, React 19
- **UI 组件**: Radix UI, shadcn/ui 风格
- **表单**: React Hook Form + Zod
- **表格**: TanStack Table
- **国际化**: next-intl
- **样式**: Tailwind CSS v4

### 后端 API (@your-project/api)
- **框架**: Fastify 5
- **RPC**: tRPC 11 (端到端类型安全)
- **认证**: Better Auth
- **验证**: Zod
- **日志**: Pino

### 多端应用 (@your-project/app)
- **框架**: uni-app + Vue 3
- **构建**: Vite 5
- **状态管理**: Pinia
- **UI**: uni-ui + UnoCSS
- **多端支持**: 微信小程序、支付宝小程序、H5 等

### 数据库 (@your-project/db)
- **ORM**: Drizzle ORM
- **数据库**: PostgreSQL
- **迁移**: Drizzle Kit

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

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

```bash
cd packages/db
pnpm drizzle-kit push
```

### 5. 启动开发服务

```bash
# 终端 1: API 服务
pnpm --filter @your-project/api dev

# 终端 2: 管理后台
pnpm --filter @your-project/admin dev

# 终端 3: 多端应用 (微信小程序示例)
pnpm --filter @your-project/app dev:mp-weixin
```

## 访问地址

| 服务 | URL |
|------|-----|
| 管理后台 | http://localhost:3000 |
| API 服务 | http://localhost:4000 |
| tRPC Playground | http://localhost:4000/api/trpc |
| Health Check | http://localhost:4000/health |

## 自定义包名

本项目使用 `@your-project/*` 作为包名占位符。使用前请全局替换：

```bash
# macOS/Linux
find . -type f -name "*.json" -o -name "*.ts" -o -name "*.tsx" | \
  xargs sed -i '' 's/@your-project/@your-actual-prefix/g'

# 或手动替换以下文件：
# - pnpm-workspace.yaml
# - apps/*/package.json
# - apps/*/README.md
```

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
