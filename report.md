# Infrastructure & Deployment Audit — Online Examination System

**Target architecture:** Vercel (Next.js) + Render (NestJS) + Neon (PostgreSQL)
**Audit date:** 2026-08-25 · **Audit type:** read-only, no files modified
**Verified against:** actual source code, installed `node_modules` versions, live DB state, and a running backend instance.

---

## 1. ARCHITECTURE

| Layer | Technology | Version (verified in node_modules) |
|---|---|---|
| Frontend | Next.js (App Router) | **16.2.9** |
| UI runtime | React / React DOM | **19.2.7** |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss ^4.3.1`) | v4 |
| Data-fetching | TanStack Query (`@tanstack/react-query`), axios | latest |
| State | Zustand (persisted to localStorage) | latest |
| Real-time client | socket.io-client | **4.8.3** |
| Backend | NestJS (`@nestjs/core`) | **11.1.27** |
| Real-time server | Socket.IO | **4.8.3** |
| ORM | Prisma CLI + Client | **6.5.0** |
| Database | PostgreSQL | 16 (docker-compose `postgres:16-alpine`) |
| Auth | JWT (@nestjs/jwt) + passport-jwt + bcrypt, httpOnly cookies | — |
| Docs | Swagger at `/api/docs` | — |

- **Monorepo:** pnpm workspace (`pnpm-workspace.yaml`: packages `frontend`, `backend`). Root `package.json` pins `packageManager: pnpm@10.12.1`. `.npmrc` whitelists build scripts for `@prisma/client`, `@prisma/engines`, `bcrypt`, `esbuild`, `prisma`, `sharp`.
- **Third service:** `proctoring/` is a separate **Python FastAPI** microservice (not part of the JS workspace): FastAPI ≥0.141, uvicorn, opencv-python-headless, numpy, pillow (`proctoring/requirements.txt`). It analyzes camera frames/audio and returns signals.
- Other dirs: `deployment/` (docker-compose, nginx.conf, GH Actions placeholder), `docker/` (Dockerfiles), `docs/`, `database/`.
- Git remote: `github.com/enoch936/online-examination-system`, branch `main`.

---

## 2. BACKEND RUNTIME

Verified by inspecting `backend/src/**` and dependencies:

| Capability | Present? | Evidence |
|---|---|---|
| REST API | ✅ | Global prefix `api/v1` (`src/main.ts:24`), ~15 feature modules registered in `src/app.module.ts:36-88` |
| WebSockets (Socket.IO) | ✅ | `src/websocket/realtime.gateway.ts` — namespace `/realtime`, JWT handshake auth |
| SSE | ❌ | none |
| WebRTC | ⚠️ Signaling only | Gateway relays `proctoring:offer/answer/ice` (`realtime.gateway.ts:178-212`); media flows **browser-to-browser P2P**, STUN-only ICE servers (`frontend/src/hooks/use-proctoring.ts:8-13`) |
| Long-running connections | ✅ | WebSocket + WebRTC peer connections |
| Background jobs | ✅ In-process timer | `src/submissions/submissions.service.ts:18-22` — `setInterval` every 60 s: auto-submits expired sessions, closes ended exams |
| Cron (@nestjs/schedule) | ❌ | not installed |
| Queues (Bull/etc.) | ❌ | not installed |
| Redis | ❌ | **Not used by code.** A `redis:7` container exists in `deployment/docker-compose.yml:20-24` but nothing connects to it. `docs/websocket.md:17` notes Redis adapter would be needed only for multi-node |
| Persistent in-memory state | ✅ | `realtime.gateway.ts:34-35` (`socketSessions` Map, `eventCounts` rate-limit Map); `monitoring.service.ts:55` (`lastStatsAt` throttle Map); `ThrottlerGuard` in-memory rate limiting (`app.module.ts:81`). **Backend must run as a single instance.** |

Global middleware (`src/main.ts`): helmet, cookie-parser, CORS, ValidationPipe (whitelist + transform), global exception filter (`common/filters/global-exception.filter.ts` — error envelope `{ success:false, statusCode, error:{message} }`), response-transform interceptor, Swagger at `/api/docs`.

---

## 3. EXAM MONITORING (deep dive)

The monitoring system uses **four cooperating mechanisms**: Socket.IO (primary channel), browser APIs (signal sources), WebRTC (live video to proctor), and an external Python analyzer (AI signals).

### 3.1 Server side

- **Gateway:** `backend/src/websocket/realtime.gateway.ts`
  - Namespace `/realtime`; JWT verified at handshake from `auth.token` → `Authorization: Bearer` → `access_token` cookie (`realtime.gateway.ts:59-67`).
  - Rooms: `session:{sessionId}` (student), `monitor:{examId}` (instructors), `user:{userId}` (notifications), `peer:{socketId}` (WebRTC reply addressing).
  - Client→server events: `exam:join`, `monitor:join`, `exam:heartbeat`, `exam:violation`, `exam:event`, `proctoring:offer/answer/ice`, `notifications:subscribe`.
  - Per-user in-memory rate limits: heartbeat ≤60/min, violations ≤30/min, events ≤60/min (`isRateLimited`, line 89).
- **Monitoring service:** `backend/src/monitoring/monitoring.service.ts`
  - Persists every signal into `ExamEvent` / `ExamViolation` tables; recomputes session `riskScore` = sum of event weights capped at 100; classifies LOW/MEDIUM/HIGH/CRITICAL via `risk.engine.ts` (default weights e.g. TAB_SWITCHED=10, FACE_NOT_DETECTED=15, MANUAL_FLAG=20; thresholds 25/50/75).
  - Broadcasts to instructors: `monitor:event`, `monitor:candidate-update` (full session snapshot), `monitor:alert` (HIGH/CRITICAL/MANUAL_FLAG), `monitor:stats` (aggregated, throttled to one per 3 s per exam, line 550-561).
  - Instructor actions (`warning/message/pause/resume/extend/force_submit/disconnect/note`) are received over REST (`monitoring.controller.ts:133-145`), persisted, then pushed to the student's session room as `exam:control`.
- **Heartbeat loop (student):** `exam:heartbeat` every **10 s** with `remainingSeconds` (`frontend/src/hooks/use-exam-monitoring.ts:58-60`) → updates `lastHeartbeatAt`, `connectionState=CONNECTED`, remaining time on the session row.

### 3.2 Student client signals — `frontend/src/hooks/use-exam-monitoring.ts`

Browser APIs used:
- `window blur` → violation `WINDOW_BLUR`
- `document.visibilitychange hidden` → violation `TAB_SWITCH`
- `fullscreenchange` exit → violation `FULLSCREEN_EXIT`
- `copy/paste/cut/contextmenu/beforeprint` events → events COPY_ATTEMPT etc.
- `keydown` capture: PrintScreen, F12, Ctrl/Cmd+C/V/X/P/S/U/A → SHORTCUT_ATTEMPT

All emitted via `socket.emit('exam:event'|'exam:violation')`. Proctor control events (`exam:control`) are consumed in `features/exams/exam-taking-client.tsx:220-241` (pause overlay, resume refetch, time extension, force-submit).

### 3.3 Webcam/mic proctoring — `frontend/src/hooks/use-proctoring.ts`

1. Fetches requirements per exam (`GET /monitoring/exams/:id/requirements`, consent gate if required).
2. `navigator.mediaDevices.getUserMedia({video, audio})`; mic RMS computed with WebAudio `AnalyserNode`.
3. Captures frames to canvas (320×240 JPEG) every **5 s** and POSTs them to the **Python proctoring service**: `${NEXT_PUBLIC_PROCTORING_URL ?? 'http://127.0.0.1:8000'}/analyze?session_id=…` (`use-proctoring.ts:262-267`); audio RMS POSTed to `/audio` every 5 s (`use-proctoring.ts:304-311`).
4. Service responses (`faceDetected`, `multipleFaces`, `motionDetected`, `audioActivity`) are converted into socket events: `FACE_NOT_DETECTED`, `MULTIPLE_FACES_DETECTED`, `MOTION_DETECTED`, `AUDIO_ACTIVITY`.
5. **WebRTC live view:** student creates `RTCPeerConnection` (STUN only) and re-sends its offer every **4 s** until a proctor answers (self-heal loop, `use-proctoring.ts:167-187`). The instructor monitor page answers (`instructor/exams/monitor/page.tsx:640-695`); ICE candidates relay through the gateway; media is direct P2P (never touches the server).

### 3.4 Python analyzer — `proctoring/main.py`

FastAPI + OpenCV Haar cascade face detection + frame-diff motion detection; in-memory motion state keyed by `session_id` (TTL 3 s). **CORS hardcoded to localhost origins** (`main.py:44-48`) — must change before production use.

### 3.5 Polling?

No polling loops. Instructor page does an initial REST fetch (`stats`, `sessions`, `config` via `services/monitoring.service.ts`) and then relies entirely on Socket.IO pushes. Notifications are pushed via `notification:new` to `user:{id}` rooms.

---

## 4. FILE STORAGE

- **Implementation:** `backend/src/storage/storage.service.ts` — writes to **local filesystem** at `join(process.cwd(), 'uploads')`, served publicly via `GET /api/v1/storage/local/:key` as `application/octet-stream` (`storage.controller.ts:13-18`, marked `@Public()`). A fake "signed URL" helper exists (`getSignedUploadUrl`, line 15) but just returns the local path.
- **Actually used?** **No upload endpoint is wired.** There is no multer/FileInterceptor anywhere; no controller calls `uploadFile()`. Question import (JSON/CSV) is parsed in memory. PDFs (PDFKit) and Excel reports (ExcelJS) are generated **in-memory streams** (`reports.service.ts`, certificates module) — no disk writes. `avatarUrl` fields exist in schema/types but there is no avatar upload flow.
- **Post-deployment verdict:** Render's filesystem is **ephemeral** (wiped on deploy/restart, not shared between instances). Because nothing currently persists files, this is benign today — but any future use of `StorageService.uploadFile` will silently lose data. If uploads are planned, switch to S3/R2/Cloudinary first.

---

## 5. DATABASE

- **Prisma version:** 6.5.0 (CLI + client pinned exactly in `backend/package.json`; generator `prisma-client-js`).
- **Schema:** `backend/prisma/schema.prisma` (~650 lines, 20+ models incl. User/Role/Permission, Exam + ExamQuestion/Bank/Course/Assignment/Share, ExamSession, StudentAnswer, Submission, Result, Certificate, Notification, RefreshToken, AuditLog, ExamViolation, ExamEvent, ExamMonitoringConfig). Datasource `postgresql`, single `env("DATABASE_URL")`.
- **Migrations:** `backend/prisma/migrations/` — 12 sequential SQL migrations, tracked in git **including root `migration_lock.toml` (verified tracked)**. Production-ready for `prisma migrate deploy`. Note `.gitignore` contains a harmless stale pattern (`migrations/*/migration_lock.toml`) that matches nothing.
- **Seed:** `prisma.seed = tsx prisma/seed.ts` (`backend/package.json`); `tsx` is a devDependency. Seed creates demo admin/instructors/students with **known passwords** (`Student@123`, `Instructor@123`) and demo exams — **do not run against production**, or rotate the admin password immediately after.
- **Connection variables:** `DATABASE_URL` only. Local dev points to `localhost:5432` (`backend/.env`, git-ignored). No shadow DB configured (only needed for `migrate dev`, which you won't run in prod).
- **Local-only config exists?** Yes — `backend/.env` (localhost Postgres, placeholder secrets `change_this_to_a_secure_random_string…`). It is git-ignored; production values must come from platform env vars.

---

## 6. ENVIRONMENT VARIABLES

Names only (no values).

### Backend — validated at boot by zod (`backend/src/config/app.config.ts`)
| Variable | Notes |
|---|---|
| `NODE_ENV` | default `development`; **must be `production`** (drives `secure` cookies, `auth.controller.ts:166`) |
| `PORT` | Render injects it; code defaults 4000 (`main.ts:45`) |
| `API_PREFIX` | default `api/v1` |
| `FRONTEND_URL` | REST CORS origin(s), comma-separated supported (`main.ts:20-23`) |
| `DATABASE_URL` | Neon connection string (**required**) |
| `JWT_ACCESS_SECRET` | min 32 chars enforced |
| `JWT_REFRESH_SECRET` | min 32 chars enforced |
| `JWT_ACCESS_EXPIRES_IN` | default 15m |
| `JWT_REFRESH_EXPIRES_IN` | default 7d |
| `COOKIE_DOMAIN` | optional; set only when using a shared custom domain |
| `BCRYPT_ROUNDS` | default 12 |
| `RATE_LIMIT_TTL` / `RATE_LIMIT_LIMIT` | default 60 s / 120 req |

### Backend — read directly outside zod validation
| Variable | Location | Notes |
|---|---|---|
| `CORS_ORIGIN` | `websocket/realtime.gateway.ts:28` | **Socket.IO CORS origin — separate from FRONTEND_URL!** Falls back to `http://localhost:3000`. Easy to miss. |

### Frontend (baked into the bundle at build time)
| Variable | Used in |
|---|---|
| `NEXT_PUBLIC_API_URL` | `services/api.ts:5`, displayed in admin settings page:81 |
| `NEXT_PUBLIC_SOCKET_URL` | `services/socket.service.ts:10` (e.g. `https://…/realtime`) |
| `NEXT_PUBLIC_PROCTORING_URL` | `hooks/use-proctoring.ts:265,305` (Python service base URL) |

### Categories
- **Email/payment/external APIs:** **none** — no SMTP/email provider anywhere (forgot-password generates a reset JWT but never sends email, `auth.service.ts` forgotPassword). No payment integration.
- **Development-only defaults hardcoded in code:** `http://localhost:4000/api/v1` (api.ts), `http://localhost:4000/realtime` (socket.service.ts), `http://127.0.0.1:8000` (use-proctoring.ts), `http://localhost:3000` (gateway CORS default, app.config FRONTEND_URL default).
- Minor: `deployment/docker-compose.yml:32` references `./.env.production.example` which **does not exist** in the repo.

---

## 7. VERCEL COMPATIBILITY (frontend)

**Verdict: deploys without architectural changes.**
- Standard App Router app; plain `next.config.mjs` (no custom server, no `output` override, no API routes under `src/app/api`).
- `middleware.ts` is edge-safe (reads first-party cookie `oes-auth-token` set by client JS for route gating).
- `images.remotePatterns: https **` works on Vercel.
- Only requirements: set the three `NEXT_PUBLIC_*` vars **before building** (they are compile-time constants), and note the dev script's `--webpack` flag is irrelevant to Vercel builds.
- Cosmetic: `npm run lint` is broken under Next 16 (`next lint` removed) — does not affect deployment.

---

## 8. RENDER COMPATIBILITY (backend)

**Verdict: runs correctly as a persistent Render Web Service (single instance).**

| Requirement | Value |
|---|---|
| Service type | Web Service (persistent process needed for Socket.IO + 60 s lifecycle timer) |
| Build command | `corepack enable && pnpm install && pnpm prisma generate && pnpm build` (Root Directory: `backend`) |
| Pre-deploy command | `pnpm prisma:deploy` (= `prisma migrate deploy`) |
| Start command | `node dist/src/main.js` |
| Port | Code honors injected `PORT` (`main.ts:45` via ConfigService); Render auto-injects it — do not hardcode 4000 |
| Host binding | `app.listen(port)` binds `0.0.0.0` by default — correct for Render |
| Health check path | `/api/v1/monitoring/health` (public, `monitoring.controller.ts:26-34`) |
| Node.js | No `engines` field; Dockerfile targets **node:22-alpine** → set env `NODE_VERSION=22` |
| pnpm | corepack respects `packageManager: pnpm@10.12.1`; `.npmrc` already approves bcrypt/prisma postinstall scripts |
| Prisma | `prisma generate` during build; `migrate deploy` as pre-deploy (see §9) |
| WebSockets | Native support on Render web services (`wss://<service>.onrender.com/socket.io`); nginx-style proxy config not needed |
| Scaling | **Keep to 1 instance.** Rooms, rate-limit maps, stats throttle, and the lifecycle timer are all in-process; horizontal scaling requires the Socket.IO Redis adapter + moving rate limits/throttle to Redis |

---

## 9. POSTGRESQL (Neon)

- **DATABASE_URL usage:** single var consumed by Prisma. Neon pooled hostname format:
  `postgresql://USER:PASS@EP-NAME-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require`
- **SSL:** Neon requires TLS → append `?sslmode=require` (or `verify-full` with the Neon CA). Prisma 6.x handles this natively.
- **Pooling:** use the **pooled** endpoint (`-pooler`, PgBouncer transaction mode) for the runtime `DATABASE_URL` and add `&pgbouncer=true&connection_limit=10` (tells Prisma to disable prepared-statement caching). Use the **direct** (non-pooler) endpoint for migrations — DDL over PgBouncer transaction pooling is unsafe. Practical setup: put the pooled URL in `DATABASE_URL`; if you want strict separation, add `DIRECT_DATABASE_URL` and make the pre-deploy command `pnpm prisma migrate deploy` run with that value substituted.
- **Migrations:** always `prisma migrate deploy` (never `db push`, never `migrate dev` in prod). All 12 migrations are plain SQL and idempotent-by-lockfile; safe on an empty Neon database.
- **Seed:** skip in production. If ever needed: `pnpm prisma:seed` (tsx is available because devDependencies install by default on Render), then rotate all seeded passwords or delete seeded users.
- **Write load note:** each student emits a heartbeat every 10 s → one `exam_sessions` UPDATE (+ snapshot broadcast) per student per 10 s, plus risk recomputation aggregates per event. Fine at classroom scale; watch Neon autoscaling limits for large cohorts.

---

## 10. CORS — current config & required changes

Current configuration lives in **three independent places**:

1. **REST:** `backend/src/main.ts:20-23` — `origin: FRONTEND_URL.split(','), credentials:true`.
   → Set `FRONTEND_URL=https://YOUR-FRONTEND.vercel.app` (comma-list allowed if you have preview domains).
2. **Socket.IO gateway:** `backend/src/websocket/realtime.gateway.ts:28` — reads **`process.env.CORS_ORIGIN`** (falls back to `http://localhost:3000`!). This is NOT covered by FRONTEND_URL.
   → Set `CORS_ORIGIN=https://YOUR-FRONTEND.vercel.app` or the realtime namespace will reject/hand-shake-fail browsers.
3. **Python proctoring service:** `proctoring/main.py:44-48` — hardcoded `allow_origins=["http://localhost:3000","http://127.0.0.1:3000"]`.
   → Change to your Vercel origin (ideally make it env-driven) if you deploy this service.

With frontend `https://YOUR-FRONTEND.vercel.app` and backend `https://YOUR-BACKEND.onrender.com`: set both #1 and #2; ensure requests carry credentials (`withCredentials:true` already set in `frontend/src/services/api.ts:9` and socket.service.ts).

---

## 11. PRODUCTION RISKS (works locally, may fail in prod)

### P0 — will break in production
1. **Refresh-token cookie won't survive the cross-site split.** Access token lives in Zustand/localStorage and is sent as `Authorization: Bearer` (fine cross-site). But the refresh flow posts `{}` and relies on the backend's httpOnly `refresh_token` cookie (`services/api.ts:27`, backend sets `SameSite=Lax` — `auth.controller.ts:171`). Cross-site XHR (vercel.app → onrender.com) **does not send Lax cookies**, so after 15 minutes every session dies and silent refresh fails. Fixes (pick one):
   - **Best:** custom domains on one registrable domain (e.g. `app.yourdomain.com` + `api.yourdomain.com`), set `COOKIE_DOMAIN=.yourdomain.com`;
   - Or persist the refresh token client-side and send it in the body (`dto.refreshToken` is already supported by `POST /auth/refresh`);
   - Or proxy `/api/v1` + `/socket.io` through Vercel rewrites so everything is same-origin.
2. **`CORS_ORIGIN` vs `FRONTEND_URL` trap** — two env vars for two CORS layers (§10). Missing `CORS_ORIGIN` = REST works but Socket.IO auth fails → monitoring dead while everything else looks fine.
3. **Placeholder JWT secrets** in current `.env` (`change_this_to_a_secure_random_string_at_least_32_chars`). Zod only enforces length ≥32. Generate real random secrets for both access and refresh.
4. **Mixed content / hardcoded fallback URLs:** if `NEXT_PUBLIC_*` vars are unset, the client falls back to `http://localhost:*` — an `https://` page will block these outright. Also the proctoring default `http://127.0.0.1:8000` can never work from a deployed HTTPS page.

### P1 — functional degradation
5. **STUN-only WebRTC** (`stun.l.google.com` etc., both clients): camera feed fails for students/proctors behind symmetric NAT or strict firewalls. Add a TURN server (coturn, Metered, Cloudflare Calls) for reliable proctor video.
6. **Proctoring microservice needs a home.** If not deployed: AI face/motion/audio signals silently vanish (fetch errors swallowed, `use-proctoring.ts:289,319`) while the consent screen may still advertise them. If deployed: needs HTTPS + CORS fix (#3 in §10) + OpenCV-compatible Python host (Render native Python env works).
7. **Single-instance constraint** (§2): don't enable Render autoscaling without adding the Socket.IO Redis adapter and externalizing rate limiting/throttling.
8. **NODE_ENV=production is mandatory on Render** — otherwise cookies are issued with `Secure=false` and are dropped by HTTPS browsers (`auth.controller.ts:166-170`).

### P2 — hygiene
9. Ephemeral local storage `uploads/` (§4) — avoid building on `StorageService`.
10. In-memory ThrottlerGuard rate limits reset per instance/deploy.
11. Seeded demo accounts have public passwords — never seed prod.
12. `next lint` script broken under Next 16 (CI note only).
13. `deployment/docker-compose.yml` references a missing `.env.production.example`.
14. Heartbeat write amplification on Neon free tier (§9).

No hardcoded IPs beyond `127.0.0.1` fallbacks; no HTTP-only asset URLs besides those fallbacks; no file-size limit configured (irrelevant until uploads exist; nginx reference config allows 25 MB).

---

## 12. FINAL DEPLOYMENT PLAN

```
GitHub (enoch936/online-examination-system, branch main)
   ├── Vercel  ← frontend/   (Next.js 16)
   ├── Render  ← backend/    (NestJS, Web Service, 1 instance)
   ├── Render  ← proctoring/ (optional, Python/FastAPI)
   └── Neon    ← PostgreSQL 16
```

### Step 1 — Neon
1. Create project → region closest to users.
2. Copy the **pooled** connection string and append the required parameters:
   ```
   DATABASE_URL = postgresql://…-pooler…/neondb?sslmode=require&pgbouncer=true&connection_limit=10
   ```
3. Keep the **direct** (non-pooler) string handy for migrations.

### Step 2 — Render (backend)
New → Web Service → connect repo:

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `corepack enable && pnpm install && pnpm prisma generate && pnpm build` |
| Pre-Deploy Command | `pnpm prisma migrate deploy` *(run against the direct Neon URL)* |
| Start Command | `node dist/src/main.js` |
| Health Check Path | `/api/v1/monitoring/health` |
| Instance | 1 (Starter or higher; free tier sleeps and kills sockets) |
| Env vars | see below |

Environment:
```
NODE_ENV=production
NODE_VERSION=22
API_PREFIX=api/v1
DATABASE_URL=<Neon POOLED url w/ sslmode=require>
FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
CORS_ORIGIN=https://YOUR-FRONTEND.vercel.app        # Socket.IO gateway — easy to miss
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=120
# COOKIE_DOMAIN=.yourdomain.com                     # only once custom domains exist
```

Deploy order note: first deploy happens before Vercel exists → temporarily set `FRONTEND_URL`/`CORS_ORIGIN` to the future Vercel URL, then update after Step 3.

### Step 3 — Vercel (frontend)
Import repo → Framework: Next.js (auto-detected):

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Build | default (`next build`) |
| Node | 22.x |

Environment (Project → Settings → Environment Variables):
```
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.onrender.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://YOUR-BACKEND.onrender.com/realtime
NEXT_PUBLIC_PROCTORING_URL=https://YOUR-PROCTORING.onrender.com   # only if deployed
```
Redeploy after changing these — they are baked into the JS bundle.

### Step 4 — (optional) Proctoring service on Render
- New Web Service, Runtime: Python 3, Root Directory `proctoring`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Patch `main.py` CORS allow-list to your Vercel URL (currently hardcoded).

### Step 5 — Smoke test checklist
1. `curl https://YOUR-BACKEND.onrender.com/api/v1/monitoring/health` → `{status:"ok"}`
2. Login as instructor/admin (create the first admin by seeding locally against Neon or via register+role update).
3. Create exam → Publish → Start (goes LIVE) → assign student.
4. Student: Available exams → Start → questions render; DevTools shows `wss://…onrender.com/realtime` connected (`connection:ready`).
5. Instructor: Monitor page → candidate snapshot updates arrive; tab-switch on student side raises alert within ~1 s.
6. Webcam consent → proctor sees live video (needs TURN for strict networks).
7. Submit → result page renders.

---

## 13. VERDICT

## READY WITH MINOR CHANGES

The codebase is genuinely cloud-portable: standard Next.js, a persistent NestJS process whose port/host handling already matches Render, Socket.IO (supported natively), Prisma migrations that are production-grade, and no architectural blockers for Vercel/Render/Neon. Nothing requires redesign — but ship these in priority order:

1. **Fix the cross-site refresh-cookie problem** (custom same-root-domain + `COOKIE_DOMAIN`, or send refresh token in body, or same-origin proxy) — otherwise users are logged out every 15 minutes. (§11.1)
2. **Set `CORS_ORIGIN`** for the Socket.IO gateway alongside `FRONTEND_URL` — otherwise monitoring is silently dead. (§11.2)
3. **Generate real JWT secrets**; keep `NODE_ENV=production`. (§11.3, §11.8)
4. **Set all three `NEXT_PUBLIC_*` vars at build time**; never rely on localhost fallbacks. (§11.4)
5. Pin `NODE_VERSION=22`, configure health-check path + pre-deploy `prisma migrate deploy` using the direct Neon URL. (§8, §9)
6. Decide the proctoring service's fate: deploy it (with CORS fix + HTTPS) or disable `aiDetectionEnabled` per exam to match reality. (§11.6)
7. Recommended: add a TURN server for dependable WebRTC video; stay single-instance until a Redis adapter is added. (§11.5, §11.7)
