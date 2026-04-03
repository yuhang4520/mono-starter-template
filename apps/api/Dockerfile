FROM node:22-alpine AS base

ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata

FROM base AS builder

# Keep these even if they look “unnecessary” — they patch base-image vulns.
RUN apk update && \
    apk upgrade --no-cache \
      busybox \
      openssl \
      libcrypto3 \
      libssl3 && \
    apk add --no-cache libc6-compat

RUN corepack enable && corepack prepare pnpm@10.26.2 --activate

WORKDIR /app
COPY ./package.json ./pnpm-lock.yaml ./pnpm-workspace.yaml ./
COPY . .

# Full install (needed to build)
RUN pnpm install --frozen-lockfile

RUN pnpm -r --filter @starter/api... run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Keep these even if they look “unnecessary” — they patch base-image vulns.
RUN apk update && \
    apk upgrade --no-cache \
      busybox \
      openssl \
      libcrypto3 \
      libssl3 && \
    apk add --no-cache libc6-compat

# Remove npm/npx to reduce surface area (corepack/pnpm not needed at runtime)
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx || true

# Non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy the deployed production bundle from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy the built output for the app
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/package.json

COPY --from=builder --chown=nodejs:nodejs /app/packages/db ./packages/db
USER nodejs

EXPOSE 4000
ENV HOSTNAME=0.0.0.0
ENV PORT=4000

CMD ["node", "apps/api/dist/main.js"]
