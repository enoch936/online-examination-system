# Security Architecture

## Authentication

- Access tokens are short-lived JWTs.
- Refresh tokens are random values stored as bcrypt hashes.
- Refresh tokens rotate on every refresh.
- Secure cookies are supported for browser deployments.

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

## Exam Integrity

- Fullscreen exit, tab switch, blur/focus loss, copy/paste, and heartbeat gaps are recorded as violations.
- Session state is persisted for recovery and review.
- Question and option ordering are snapshot at session start.
- The architecture reserves fields for AI proctoring evidence without locking the system to a vendor.
