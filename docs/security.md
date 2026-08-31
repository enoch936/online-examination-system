# Security Architecture

## Authentication

- Access tokens are short-lived JWTs.
- Refresh tokens are random values stored as bcrypt hashes.
- Refresh tokens rotate on every refresh.
- Secure cookies are supported for browser deployments.

## Super Admin Bootstrap

- The initial `SUPER_ADMIN` is created automatically once at server start
  (`backend/src/auth/superadmin.bootstrap.ts`) and **only** when no SUPER_ADMIN
  exists.
- Bootstrap credentials come **solely** from the server-side environment
  variables `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD`. They are never
  hardcoded, never committed, and never exposed through `NEXT_PUBLIC_*`
  variables or API responses.
- The password is **bcrypt-hashed before storage**; only the hash is stored in
  PostgreSQL. Plaintext is never persisted, logged, or returned.
- The bootstrap is **idempotent**: if a SUPER_ADMIN already exists it is a no-op
  and the password is **never overwritten or reset** on redeploy/restart.
- If a bootstrap is required and the credentials are missing, the server
  **fails fast** with a clear configuration error — there is no default
  password.
- After creation, authentication relies entirely on the stored bcrypt hash.

## Password Policy

- New passwords (registration, admin-created users, password reset, and
  password change) must be at least **12 characters** and include uppercase,
  lowercase, a digit, and a symbol (`backend/src/common/utils/password.util.ts`).
- Common, sequential (e.g. `123456`, `qwerty`), and long-repeated passwords are
  rejected, as are passwords matching the account email.

## Changing Passwords

- `POST /api/v1/auth/change-password` requires the **current password** before
  any change is accepted.
- The endpoint is protected by the global JWT auth guard, and changing a
  password revokes all refresh tokens/sessions.
- The endpoint is rate-limited (5 requests/minute per IP) to blunt online
  guessing; login is rate-limited at 10 requests/minute.

## Authorization

- RBAC roles: `SUPER_ADMIN`, `ADMIN`, `INSTRUCTOR`, `STUDENT`.
- Permission checks are decorator-driven.
- Controllers combine JWT, role, and permission guards.

## Web Security

- Helmet sets defensive HTTP headers.
- CORS is restricted by `FRONTEND_URL`.
- Class Validator rejects malformed input before controller logic.
- Prisma parameterization protects database queries from SQL injection.
- Rate limiting reduces brute-force risk.
- Audit logs capture security-relevant mutations.

## Secrets Handling

- `.env`, `.env.local`, `.env.*`, `deployment/.env`, and
  `deployment/.env.production` are git-ignored; only `.env.example` /
  `.env*.example` (variable names, never real values) are tracked.
- JWT secrets, `DATABASE_URL`, Redis credentials, and the super admin bootstrap
  credentials are injected as server-side platform secrets on Render / Docker
  (see `docs/devops.md`) and never live in the repository.

## Exam Integrity

- Fullscreen exit, tab switch, blur/focus loss, copy/paste, and heartbeat gaps are recorded as violations.
- Session state is persisted for recovery and review.
- Question and option ordering are snapshot at session start.
- The architecture reserves fields for AI proctoring evidence without locking the system to a vendor.
