ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/ ./apps/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile
RUN pnpm --dir apps/api build

FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production TZ=Asia/Shanghai HOSTNAME=0.0.0.0 PORT=4000
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
USER nodejs
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
