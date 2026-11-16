ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/ ./apps/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile
# Build-time placeholders only: production credentials are injected when the container starts.
RUN DATABASE_URL=postgres://build:build@127.0.0.1:5432/build BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=build-only-placeholder-at-least-32-characters pnpm --dir apps/admin build

FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production TZ=Asia/Shanghai HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
