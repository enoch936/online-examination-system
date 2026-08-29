# CI/CD

CI is defined in `.github/workflows/ci.yml` and runs on every push to `main`
and on pull requests. It validates the whole monorepo before anything is
deployed.

## CI Jobs

| Job | What it verifies |
| --- | --- |
| `frontend` | `pnpm install --frozen-lockfile`, ESLint, tests, and `next build` (production build against `NEXT_PUBLIC_*` placeholders). |
| `backend` | Prisma client generation, ESLint, Jest, and `nest build`. |
| `backend-smoke` | Bans a real PostgreSQL 16 container, applies `prisma:migrate deploy` (production migrations), boots the built API in `NODE_ENV=production`, and polls `/api/v1/monitoring/health` and `/api/v1/monitoring/health/ready`. |
| `proctoring` | Installs the FastAPI dependencies, imports `main`, boots uvicorn, and polls `/health`. |
| `docker` | Validates `deployment/docker-compose.yml` with `docker compose config -q` and builds the backend and frontend Docker images. |

A CI pass proves the Docker images build and the API boots in production mode
against a clean database — the two things that cannot be checked without
Docker installed locally.

## Production CD Stages (GitHub Actions)

Use Render/Neon native connections for deployment, or extend this workflow
with a CD job that:

1. Build and push backend/frontend images to a container registry.
2. Run migrations with `pnpm --filter backend prisma:deploy` against the
   direct connection URL.
3. Deploy backend, then frontend, then the proctoring service.
4. Run smoke checks against `/api/v1/monitoring/health`, `/api/v1/monitoring/health/ready`,
   the proctoring `/health`, and the public frontend route.