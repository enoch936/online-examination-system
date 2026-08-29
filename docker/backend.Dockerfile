FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY backend backend
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

# Runner: minimal production image. Prisma runtime + built dist only.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY backend/package.json backend/package.json
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["node", "backend/dist/src/main.js"]