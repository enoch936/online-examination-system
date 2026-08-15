CI is defined in `.github/workflows/ci.yml`.

Recommended production CD stages:

1. Build and push frontend/backend images.
2. Run Prisma migrations with `pnpm --filter backend prisma:deploy`.
3. Deploy backend, frontend, and Nginx services.
4. Run smoke checks against `/api/v1/monitoring/health` and the public frontend route.
