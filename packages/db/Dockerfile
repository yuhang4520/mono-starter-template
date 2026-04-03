FROM node:22-alpine AS base

ENV TZ=Asia/Shanghai
RUN apk add --no-cache tzdata

FROM base AS runner

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
COPY ./packages/ ./packages/
RUN pnpm install --frozen-lockfile

WORKDIR /app/packages/db

CMD ["pnpm", "run", "migrate"]
