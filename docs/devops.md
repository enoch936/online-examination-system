# DevOps Architecture

## Local Development

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Swagger: `http://localhost:4000/api/docs`
- PostgreSQL: `localhost:5432`

## Containers

- `frontend`: Next.js standalone runtime.
- `backend`: NestJS API runtime.
- `postgres`: PostgreSQL 16.
- `redis`: optional cache and realtime coordination.
- `nginx`: reverse proxy.

## CI/CD

GitHub Actions runs install, lint, test, build, Prisma generation, and Docker build checks.

## Production Hardening

- Terminate TLS at load balancer or Nginx.
- Store secrets in a cloud secret manager.
- Use managed PostgreSQL with backups and PITR.
- Use horizontal API replicas with health checks.
- Enable centralized logs, metrics, traces, and alerting.
