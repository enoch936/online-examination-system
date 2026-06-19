# Enterprise Online Examination System

Production-oriented Online Examination System (OES) for universities, schools, certification providers, training centers, and enterprise organizations.

## 1. High-Level Architecture

The platform is separated into:

- `frontend`: Next.js App Router SaaS interface with TypeScript, Tailwind CSS, shadcn-inspired components, Zustand, TanStack Query, Socket.IO client, Recharts, Framer Motion, and theme support.
- `backend`: NestJS API with Prisma, PostgreSQL, JWT authentication, refresh tokens, RBAC, permissions, Socket.IO, Swagger, validation, rate limiting, and audit logging.
- `database`: PostgreSQL schema notes, ER diagram, indexes, and operational SQL.
- `deployment`: Docker Compose, Nginx reverse proxy, and GitHub Actions CI/CD.
- `docs`: architecture, security, API, UI, and implementation documentation.

## 2. Complete Folder Structure

```text
online-examination-system/
├── frontend/
├── backend/
├── database/
├── deployment/
├── docker/
├── docs/
├── pnpm-workspace.yaml
└── README.md
```

## 3. Database Design

The Prisma schema in `backend/prisma/schema.prisma` defines tenants-ready academic data, RBAC, exam delivery, answer capture, results, certificates, notifications, activity logs, audit logs, and refresh tokens.

## 4. ER Diagram

See [docs/architecture.md](docs/architecture.md) and [database/README.md](database/README.md).

## 5. Prisma Schema

Primary schema: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

## 6. API Design

REST endpoints are grouped by NestJS modules and documented by Swagger at `/api/docs`.

Core examples:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/users`
- `GET /api/v1/exams`
- `POST /api/v1/exam-sessions/:examId/start`
- `PATCH /api/v1/exam-sessions/:sessionId/answers`
- `POST /api/v1/submissions`
- `GET /api/v1/results`

## 7. Backend Modules

Implemented modules include auth, users, roles, permissions, subjects, courses, exams, questions, exam sessions, submissions, results, certificates, notifications, reports, audit logs, websocket, storage, and monitoring.

## 8. Frontend Architecture

The frontend uses feature folders, route groups, server-first pages, client components for forms, charts, realtime, and exam delivery, plus typed API services.

## 9. UI/UX Design System

The interface follows a quiet enterprise SaaS style: dense dashboards, accessible cards and tables, clear navigation, keyboard-friendly forms, light/dark/system themes, skeleton states, and restrained motion.

## 10. Authentication Flow

Users authenticate with secure credential checks. The backend issues short-lived access tokens and refresh tokens. Refresh token hashes are stored in PostgreSQL and rotated. Frontend auth state is held in Zustand and API calls are routed through Axios interceptors.

## 11. Security Architecture

Implemented foundations:

- Helmet, CORS, cookie parser, strict validation pipe
- Throttling and centralized exception filtering
- JWT guards, roles guard, permissions guard
- Password hashing with bcrypt
- Prisma query APIs for SQL injection protection
- Audit and activity logging primitives
- Exam violation logging for tab switch, focus loss, fullscreen exit, and suspicious activity

## 12. WebSocket Architecture

Socket.IO gateway namespaces support live notifications, exam monitoring, heartbeat events, candidate activity, violations, and timer synchronization.

## 13. DevOps Architecture

Dockerfiles, Compose, Nginx, health checks, environment templates, and GitHub Actions CI are included under `deployment`, `docker`, and `.github/workflows`.

## 14. Step-by-Step Implementation Plan

1. Install dependencies with `corepack enable` and `pnpm install`.
2. Copy `backend/.env.example` to `backend/.env` and update secrets.
3. Copy `frontend/.env.example` to `frontend/.env.local`.
4. Start PostgreSQL with `docker compose -f deployment/docker-compose.yml up postgres redis -d`.
5. Run `pnpm --filter backend prisma:generate`.
6. Run `pnpm --filter backend prisma:migrate`.
7. Start development with `pnpm dev`.
8. Open frontend at `http://localhost:3000` and backend Swagger at `http://localhost:4000/api/docs`.

## 15. Full Source Code

Source code is included in this repository. This is an enterprise foundation intended for iterative hardening, load testing, and institution-specific integrations before live deployment.
