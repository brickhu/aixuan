# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- Stage 2: Builder ----
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

# ---- Stage 3: Runner (CloudBase Cloud Run) ----
FROM node:20-alpine AS runner
WORKDIR /app

# CloudBase 要求绑定 0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
