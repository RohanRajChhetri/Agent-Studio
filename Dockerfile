# -----------------------------------------------------------------------------
# Agent Studio OS - Production Multi-Stage Dockerfile
# -----------------------------------------------------------------------------

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package configurations
COPY package.json package-lock.json* ./
COPY agent-studio-os/package.json agent-studio-os/package-lock.json* ./agent-studio-os/
COPY agent-studio-os/prisma ./agent-studio-os/prisma

WORKDIR /app/agent-studio-os
RUN npm ci
RUN npx prisma generate

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/agent-studio-os/node_modules ./agent-studio-os/node_modules
COPY package.json ./
COPY agent-studio-os ./agent-studio-os

WORKDIR /app/agent-studio-os
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application and required assets
COPY --from=builder /app/agent-studio-os/public ./agent-studio-os/public
COPY --from=builder --chown=nextjs:nodejs /app/agent-studio-os/.next ./agent-studio-os/.next
COPY --from=builder --chown=nextjs:nodejs /app/agent-studio-os/node_modules ./agent-studio-os/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/agent-studio-os/package.json ./agent-studio-os/package.json
COPY --from=builder --chown=nextjs:nodejs /app/agent-studio-os/prisma ./agent-studio-os/prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
