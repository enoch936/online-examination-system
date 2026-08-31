# DevOps Architecture

## Target Production Architecture

```text
                      ┌─────────────────────────────┐
                      │  Vercel (Next.js frontend)  │
                      └───────┬────────────┬────────┘
                              │            │
                HTTPS API     │            │ WebSocket
                     ↓        │            │    ↓
              ┌────────────────────────────┐     ┌────────────────────────┐
              │  Render Web Service        │     │  Render Web Service   │
              │  oes-backend (NestJS+Prisma)│     │  oes-proctoring (API) │
              └──────┬───────────┬─────────┘     └────────────────────────┘
                     │           │
                     ↓           ↓
        ┌─────────────────────────────┐
        │ Neon Serverless PostgreSQL  │
        │  (DATABASE_URL pooled,      │
        │   DIRECT_DATABASE_URL)      │
        └─────────────────────────────┘
                     ↑
        Redis Cloud (REDIS_URL) — cache, BullMQ queues, Socket.IO adapter
```

## Live Environment (deployed 2026-08-29)

- Frontend: https://online-examination-system-enoch3696-5998s-projects.vercel.app
- Backend: https://oes-backend-nrpu.onrender.com
- Proctoring: https://oes-proctoring.onrender.com
- Database: Neon project `dark-mud-33047371` (db `neondb`, branch `br-flat-feather-ay9wwj2k`)
- Cache/queues: Upstash Redis `known-terrier-214929.upstash.io` (TLS)
- Auto-redeploy: pushes to `main` trigger GitHub Actions CI, Vercel, and Render (GitHub webhook).
- Render webhook verified 2026-08-29 (git-triggered deploys).

- **Frontend:** Vercel (`frontend/`). `NEXT_PUBLIC_*` values are inlined at
  build time, so they are set as Vercel environment variables and trigger a
  redeploy when changed.
- **Backend:** Render Web Service (`backend/`, `rootDir: backend` per
  `render.yaml`). A single instance can take three Web/Worker shifts; scale up
  for redundancy keeping `REDIS_URL` for queue coordination.
- **Database:** Neon PostgreSQL. Use the pooled connection string for
  `DATABASE_URL` (via PgBouncer) and the direct string for
  `DIRECT_DATABASE_URL` (Prisma `directUrl`, also used by migrations).
- **Neon (PostgreSQL):** set `DATABASE_URL` to the **pooled** connection string
  and `DIRECT_DATABASE_URL` to the **direct** one (used by
  `prisma migrate deploy`). A brand-new Neon database has no SUPER_ADMIN, so
  the first Render/Docker/VPS start must have `SUPERADMIN_EMAIL` /
  `SUPERADMIN_PASSWORD` set or the backend refuses to start (fail fast, no
  default password). Do **not** commit Neon credentials or `DATABASE_URL` to
  the repository (`deployment/.env.production` and platform secret stores only).
- **Realtime/queues:** Upstash Redis. `REDIS_URL` (`rediss://` with TLS) drives
  the cache, BullMQ queues, and the Socket.IO adapter. The API degrades
  gracefully to single-process realtime when Redis is unreachable, but queue
  workers stay disabled — set `REDIS_URL` for full behavior.
- **Proctoring:** Render Web Service (`proctoring/`, `render.yaml`). Must be
  reachable by the student browser; set `ALLOWED_ORIGINS` to the public
  frontend origin(s) and `ENVIRONMENT=production`.

## Health Endpoints

- Backend liveness: `GET /api/v1/monitoring/health`
- Backend readiness (DB check): `GET /api/v1/monitoring/health/ready`
- Proctoring: `GET /health`

Configure Render/Nginx health checks against these.

## Required Production Environment Variables

### Backend (Render)

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled connection string (`prisma://` / PgBouncer) |
| `DIRECT_DATABASE_URL` | Neon direct connection string (Prisma `directUrl`) |
| `REDIS_URL` | Upstash Redis `rediss://...` (TLS) |
| `JWT_ACCESS_SECRET` | Long random string (>= 32 chars) |
| `JWT_REFRESH_SECRET` | Long random string (>= 32 chars) |
| `FRONTEND_URL` | `https://<your-vercel-domain>` |
| `CORS_ORIGIN` | `https://<your-vercel-domain>` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `none` (required for cross-site cookies Vercel → Render) |
| `SWAGGER_ENABLED` | `false` (disable `/api/docs` in production) |
| `BCRYPT_ROUNDS` | `12` (bcrypt cost for all password hashing) |
| `RATE_LIMIT_TTL` | `60` (global throttle window in seconds) |
| `RATE_LIMIT_LIMIT` | `120` (global throttle max requests per window per IP) |
| `PORT` | Provided by Render |

Brute-force protection is enforced per endpoint on top of the global limit:
login `POST /auth/login` at 10 req/min/IP, registration at 5 req/min/IP,
and password change `POST /auth/change-password` at 5 req/min/IP.

### Super admin bootstrap (`SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`)

The initial **SUPER_ADMIN** account is created automatically **once** by the
backend at server start (`backend/src/auth/superadmin.bootstrap.ts`) and only
when no SUPER_ADMIN exists yet. Security model:

- Credentials are read **server-side only** from the process environment.
- The password is **bcrypt-hashed before it is stored** in PostgreSQL; the
  plaintext is never persisted, returned by any API, or logged.
- The bootstrap is **idempotent** — if a SUPER_ADMIN already exists it is a
  no-op and the existing password is **never overwritten or reset** on
  redeploy/restart.
- If the server must bootstrap and one of the variables is missing, startup
  **fails fast** with a clear configuration error (no default password).
- After creation, authentication relies entirely on the stored bcrypt hash.
- Shared policy: passwords must be >= 12 chars with upper/lower/number/symbol
  and not a common/sequential/repeated password (see
  `backend/src/common/utils/password.util.ts`).

Where to configure them:

- **Render (backend web service):** Dashboard → `oes-backend` → *Environment* →
  add `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` as **secret** vars (or via
  Blueprint: `render.yaml` lists them as `sync: false`).
- **Docker / single VPS:** set them in `deployment/.env.production`
  (git-ignored, loaded via the compose `env_file`), or pass `-e` flags.
- **Vercel / frontend:** **never** configure these there. Backend secrets must
  never be added as `NEXT_PUBLIC_*` variables — anything with a `NEXT_PUBLIC_`
  prefix is inlined into the client bundle and is not a secret.

The authenticated password-change endpoint is `POST /api/v1/auth/change-password`
(current password required, strong-policy enforced, sessions revoked on change,
rate-limited at 5 req/min per IP, like login at 10 req/min per IP).

### Frontend (Vercel)

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://<render-backend>/api/v1` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://<render-backend>/realtime` |
| `NEXT_PUBLIC_PROCTORING_URL` | `https://<render-proctoring>` |

### Proctoring (Render)

| Variable | Value |
| --- | --- |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://<your-vercel-domain>` (comma-separated list allowed) |
| `PORT` | Provided by Render |
| `WORKERS` | `4` (recommended) |

## Local Containers (Docker Compose)

Requires Docker. Copy `deployment/.env.example` to `deployment/.env`, set the
passwords, then:

```bash
pnpm docker:up      # build + start postgres, redis, backend, frontend, nginx
pnpm docker:down    # stop
```

The backend reads optional `deployment/.env.production` (see
`deployment/.env.production.example`) for secrets; if absent it uses the
compose-injected defaults (development credentials only). Nginx exposes the app
on port 80 and proxies `/api` and `/realtime` to the backend.

## Local Development

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Swagger: `http://localhost:4000/api/docs` (enabled in development)
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379` (optional; queue workers start only when `REDIS_URL`
  or `REDIS_HOST` is set)

## Production Hardening

- Terminate TLS at Vercel/Render; enable force-HTTPS on the frontend.
- Keep the three secret values (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `DATABASE_URL`) in the platform secret managers only — never in the repo.
- Use Neon point-in-time backups and enable PITR.
- Redis Cloud: enforce TLS (`rediss://`), strong password, private networking.
- Configure Render health checks to the `/api/v1/monitoring/health` route so
  unhealthy instances are recycled.
- Enable centralized logs/metrics (Render integrates with LogDNA/Sentry etc.).
- Run Proctoring on a commercial-grade worker size; it is the only CPU-heavy
  service (OpenCV frame analysis).

## Migration Procedure

```bash
# Local/CI:
pnpm --filter backend prisma:deploy       # apply migrations (production-safe)

# Rollback: migrations are forward-only; revert by restoring a pre-migration
# Neon backup (PITR) rather than by editing history.
```