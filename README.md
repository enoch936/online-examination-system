# Enterprise Online Examination System

An enterprise-grade online examination platform built for secure assessments, role-based administration, real-time supervision, and scalable delivery across schools, universities, certification programs, and internal training teams.

## Why This Project

This monorepo provides the core building blocks needed to run modern digital exams with confidence. It combines a polished Next.js frontend, a NestJS API, Prisma-powered data access, PostgreSQL persistence, and deployment assets for Docker and Nginx.

## Highlights

- Secure authentication with JWT access and refresh tokens.
- Role-based access control for administrators, instructors, and candidates.
- End-to-end exam workflows covering scheduling, assignments, sessions, submissions, results, and certificates.
- Real-time monitoring and notifications with Socket.IO.
- Audit logs and activity tracking for visibility and compliance.
- Structured database migrations with Prisma and PostgreSQL.
- Container-friendly development and deployment support.

## Technology Stack

- Frontend: Next.js, TypeScript, Zustand, TanStack Query, Socket.IO, Recharts, Framer Motion
- Backend: NestJS, Prisma, PostgreSQL, JWT, Swagger, class validation
- Infrastructure: Docker, Docker Compose, Nginx, GitHub Actions

## Repository Layout

```text
online-examination-system/
├── frontend/        Next.js user interface and dashboards
├── backend/         NestJS API, auth, business logic, and Prisma schema
├── database/        SQL notes and database documentation
├── deployment/      Docker Compose, Nginx, and CI/CD assets
├── docker/          Base Dockerfiles for app services
├── proctoring/      FastAPI-based proctoring signal service
├── docs/            Architecture, API, security, and DevOps guides
└── README.md        Project overview and setup instructions
```

## Quick Start

1. Install dependencies.

```bash
corepack enable
pnpm install
```

2. Configure environment files.

- Copy `backend/.env.example` to `backend/.env`
- Copy `frontend/.env.example` to `frontend/.env.local`

3. Start the local stack.

```bash
pnpm docker:up
```

4. Run the application in development mode.

```bash
pnpm dev
```

## Available Scripts

- `pnpm dev` runs the frontend and backend in parallel.
- `pnpm build` builds all workspace packages.
- `pnpm lint` lints the workspace.
- `pnpm test` runs the test suites.
- `pnpm format` formats source files.
- `pnpm docker:up` starts the Docker environment.
- `pnpm docker:down` stops the Docker environment.
- `pnpm db:migrate` applies backend database migrations.
- `pnpm db:studio` opens Prisma Studio for local data inspection.

## Core Capabilities

- Authentication and session management
- User and role administration
- Course and subject management
- Exam creation, assignment, and scheduling
- Question authoring and submission flow
- Results, scoring, certificates, and reporting
- Monitoring, notifications, and audit logging
- Proctoring signal analysis for face, motion, and audio activity

## Proctoring Service

The repository includes a lightweight FastAPI service under `proctoring/` for
analyzing permitted camera frames and audio activity as signals that may
require instructor review. It does not store media or perform identity
verification.

To run it locally:

```bash
cd proctoring
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Documentation

- [Architecture](docs/architecture.md)
- [API](docs/api.md)
- [DevOps](docs/devops.md)
- [Security](docs/security.md)
- [UI/UX](docs/ui-ux.md)
- [WebSocket](docs/websocket.md)
- [Database](database/README.md)

## API Overview

The backend exposes modular REST endpoints for authentication, users, exams, sessions, submissions, results, certificates, notifications, reports, audit logs, permissions, and monitoring. Swagger documentation is available from the backend service.

## Deployment Notes

The repository includes Docker and Nginx assets to support local development and production-style environments. GitHub Actions assets are available for CI/CD customization when the project is deployed to a remote environment.

## License

No license file is currently included in the repository.
