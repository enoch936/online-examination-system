FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
RUN pnpm install --filter backend --frozen-lockfile=false

FROM deps AS builder
COPY backend backend
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY backend/package.json backend/package.json
EXPOSE 4000
CMD ["pnpm", "--filter", "backend", "start"]
