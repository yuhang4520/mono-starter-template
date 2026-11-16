ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production TZ=Asia/Shanghai
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/ ./packages/
# drizzle-kit is intentionally retained: this image runs migrations, not an application bundle.
RUN pnpm install --frozen-lockfile --prod=false && chown -R nodejs:nodejs /app
USER nodejs
WORKDIR /app/packages/db
CMD ["node", "node_modules/drizzle-kit/bin.cjs", "migrate"]
