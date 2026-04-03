FROM node:22-alpine AS base

ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata

FROM base AS builder

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
RUN pnpm install --frozen-lockfile

WORKDIR /app/apps/admin
ARG BETTER_AUTH_SECRET
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-FAKE_SECRET_TO_PASS_BUILD_K8S_WILL_INJECT_REAL_SECRET}
RUN pnpm build


FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx || true

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/apps/admin/public ./apps/admin/public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs

EXPOSE 3000

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["node", "apps/admin/server.js"]
