# Online Examination System — Technical Report

Deployment: Next.js frontend (Vercel) · NestJS + Prisma backend (Render) · FastAPI proctoring service · PostgreSQL (Neon) · Socket.IO.

Scope of this report: the P0–P4 hardening, proctoring, and exam-policy work, plus deployment requirements that must be applied for the fixes to take effect in production.

---

## 1. Root Causes Addressed

| Issue | Root cause | Fix |
|---|---|---|
| P0 webcam/proctoring broken in production | `NEXT_PUBLIC_PROCTORING_URL` was fallback-building to `http://127.0.0.1:8000` (mixed content on HTTPS), and camera start failures surfaced as an error with no recovery UI | Service config now a hard deploy-time env var (see §7, **required**); proctoring status banner + Retry flow; camera-denied / camera-unavailable banners; consent card explains policy (`fullscreenPolicy`, `strictness`) and auto-requests fullscreen |
| P0 admin instructor detail page 500 | `InstructorsService.getDetail` included orphaned `ExamShare` rows (instructor soft-deleted / null) whose page render dereferenced missing fields | Detail query now filters `shares: { some: { instructorId: { not: null } } }` |
| P0 audit-range query crash | Invalid `from`/`to` dates produced raw DB errors → 500 on `/instructors/{id}/audit-logs` | Date fields validated → 400 `BadRequestException`
| P1 IDOR / object-level access on reports | `reports.service` trusted client-supplied IDs; any authed user could list others' exam/student/subject reports | `ExamAccessService`-based ownership checks on every reports endpoint; instructor overview scoped to own exams |
| P1 IDOR on session/re-exam endpoints | `findByExam`, retake-permit, revoke-retake had no per-exam authorization | `assertCanMonitor` on `findByExam`; CO_OWNER-level `assertCanAct` for retake permits; `getExamIdForSession` prevents guessing a session from another exam |
| P1 unauthenticated privilege escalation through websocket | `monitor:join` / `exam:join` accepted any authenticated socket | Both now call `assertCanMonitorExam`; `isMonitorRole` guard added |
| P2 resume/retake policy enforced only client-side, connection loss had no semantics | Missing policy columns; `assertResumeAllowed` returned plain 403; `setConnection` had no END_SESSION/MARK_REVIEW handling | New `ExamRetakePolicy` / `ExamResumePolicy` / `ExamConnectionLossPolicy` enums; coded `LOCKED` errors (`RETAKE_REQUIRED`, `RETAKE_PENDING`, `RESUME_PENDING`, `RESUME_DENIED`); monitoring `setConnection` honors END_SESSION/MARK_REVIEW/APPROVAL_REQUIRED |
| P3 persisted retake/resume requests absent | No storage for requests or staff decision workflow | `RetakeRequest`/`ResumeRequest` models, `requests.controller` + `requests.service` (submit/list/decide), notification + audit wiring |
| P3 duplicate requests | Students could spam identical requests | Duplicate PENDING/APPROVED requests rejected / replayed idempotently |
| P3 notifications unavailable for new flows | `NotificationType` had no retake/resume states | `RETAKE_REQUEST/APPROVED/REJECTED`, `RESUME_REQUEST/APPROVED/REJECTED`, `SESSION_MESSAGE` added; frontend icon map already falls back to `Bell` for unknown types |
| P2 risk engine missed new event types | `DEFAULT_WEIGHTS` lacked `CAMERA_*` / `FOCUS_RESTORED` / `PROCTORING_CONSENT_DECLINED` / `SESSION_TERMINATED` | Weights extended |
| Monitoring config save crashed on enum fields | `monitoring.service.saveConfig` fed raw strings into Prisma enum columns | Explicit casts to `WebcamMode` / `MicMode` / `FullscreenPolicy` / `MonitoringStrictness` |

---

## 2. Database Changes

Migrations: `backend/prisma/migrations/20260908000000_add_exam_policies_requests/migration.sql` (adds policy columns/enums/tables, defaults-only) and `backend/prisma/migrations/20260908120000_default_strict_policies/migration.sql` (makes approval the default for interruptions and retakes, and backfills existing exams). Both applied to production and `finished_at` set; existing data intact.

- **New enums**: `ExamConnectionLossPolicy` (`AUTO_RESUME`, `MANUAL_RESUME`, `APPROVAL_REQUIRED`, `END_SESSION`, `MARK_REVIEW`), `ExamResumePolicy` (`STUDENT`, `INSTRUCTOR_APPROVAL`, `ADMIN_APPROVAL`, `DISABLED`), `ExamRetakePolicy` (`DISABLED`, `AUTO`, `INSTRUCTOR_APPROVAL`, `ADMIN_APPROVAL`), `WebcamMode`, `MicMode`, `FullscreenPolicy` (each `DISABLED`/`OPTIONAL`/`REQUIRED`), `MonitoringStrictness` (`RELAXED`/`STANDARD`/`STRICT`), `RetakeRequestStatus` (`PENDING`/`APPROVED`/`REJECTED`/`EXPIRED`/`CANCELLED`).
- **`exams`**: `connectionLossPolicy` (default `APPROVAL_REQUIRED`), `resumePolicy` (default `INSTRUCTOR_APPROVAL`), `retakePolicy` (default `INSTRUCTOR_APPROVAL`). Existing exams were backfilled to these strict values so every student is blocked until instructor/admin approval after any interruption or submission/retake.
- **`exam_monitoring_configs`**: `webcamMode`, `micMode`, `fullscreenPolicy` (default `OPTIONAL`), `strictness` (default `STANDARD`), `violationThreshold` (default 3), `trackTabSwitches` (true), `trackWindowBlur` (true), `detectClipboard`, `detectShortcuts`, `disableCopy` (true), `disablePaste` (true) — copy/paste are **blocked by default** (migration `20260908130000_strict_copy_paste_defaults` backfills existing exams).
- **New tables**: `retake_requests`, `resume_requests` (student/exam/session FKs cascade, `reviewed_by` set-null, PENDING/APPROVED dedupe indexes on `(studentId,status)` and `(examId,status)`).
- **Class tables** (user feature, integrated): `classes`, `class_enrollments`, `exam_class_assignments`. A `class` is a **course-agnostic container of students** owned by an instructor. `classes.courseId` was added in `20260910000000_add_classes` and **dropped** in `20260910000100_classes_detach_from_courses` (verified applied on prod); uniqueness is now `[tenantId, code]` and `[tenantId, name]`. Exams push to whole classes via `exam_class_assignments`; availability is enforced server-side (`assertStudentAuthorized`).
- **New table**: `push_subscriptions` (Web Push) — per-user browser subscriptions; unique `endpoint` (upsert), `userId` FK cascade; migration `20260910000200_add_push_subscriptions` applied to production.
- **Extended enums**: `ExamEventType` (+`CAMERA_PERMISSION_DENIED`, `CAMERA_UNAVAILABLE`, `FOCUS_RESTORED`, `PROCTORING_CONSENT_DECLINED`, `SESSION_TERMINATED`), `NotificationType` (+`RETAKE_REQUEST`, `RETAKE_APPROVED`, `RETAKE_REJECTED`, `RESUME_REQUEST`, `RESUME_APPROVED`, `RESUME_REJECTED`, `SESSION_MESSAGE`).

---

## 3. Backend Changes (every file)

| File | Change |
|---|---|
| `prisma/schema.prisma` | Models/enums above |
| `auth/jwt.strategy.ts` | Live-DB user validation on JWT (previously trusted token identity only) |
| `exams/dto/create-exam.dto.ts`, `update-exam.dto.ts` | Policy fields (`connectionLossPolicy`, `resumePolicy`, `retakePolicy`) |
| `exams/exams.service.ts` | Policy persistence (`resolveCreatePolicies` merges in defaults, never trusts incomplete client payloads) + frontend-friendly type fields |
| `exam-sessions/exam-sessions.service.ts` | Policy enforcement: `assertResumeAllowed` coded LOCKED errors; retake blocked unless permitted policy level + approved request; `startExam` `RETAKE_REQUIRED`/`RETAKE_PENDING`; `resumeApprovalRequiredFor` also treats `connectionLossPolicy` `APPROVAL_REQUIRED`/`MARK_REVIEW` as approval-required |
| `exam-sessions/exam-sessions.controller.ts` | `assertCanMonitor` on `findByExam`; CO_OWNER `assertCanAct` on permit/revoke-retake via `getExamIdForSession` |
| `exam-sessions/requests.service.ts` (new) | `requestRetake`, `requestResume`, `listPending`, `listForExam`, `decide`; dedupe PENDING/APPROVED; approve requires CO_OWNER (or ADMIN for `*_APPROVAL` policies), reject requires PROCTOR; resumes session on approval (`resumeApprovedAt`), emits `exam:control` resume / resume-denied over websocket; audit + staff/student notifications |
| `exam-sessions/requests.controller.ts` (new) | `POST /requests/retake`, `POST /requests/resume`, `GET /requests/pending?examId=`, `GET /requests/exam/:examId` (monitor-guarded), `POST /requests/:id/approve`, `POST /requests/:id/reject` |
| `exam-sessions/exam-sessions.module.ts` | Registers `RequestsService` + controller |
| `monitoring/dto/update-monitoring-config.dto.ts`, `monitoring/monitoring.service.ts` | New config fields; enum casts on save; `setConnection` END_SESSION/MARK_REVIEW/APPROVAL_REQUIRED semantics; **auto-pause**: a tab switch / window blur / fullscreen exit on an approval-required exam blocks the session (PAUSED + `exam:control` pause w/ `approval:true`) until a proctor approves; `assertCanMonitorExam`, `getSessionExamId` helpers |
| `monitoring/risk.engine.ts` | `DEFAULT_WEIGHTS` extended for new event types |
| `reports/reports.service.ts`, `reports.controller.ts`, `reports.module.ts` | `isAdmin`, `examAccessFilter`, `assertCanAccessStudent`, `assertCanAccessSubject`, `overview(user)` scoped to instructor's exams; controller asserts `canMonitor` per exam endpooint; module imports `ExamAccessModule` |
| `instructors/instructors.service.ts` | Audit range validation (400 on invalid dates); detail filters orphaned shares |
| `roles/roles.service.ts` | `findMany` filters null-permission roles (avoids corrupting permission grids) |
| `users/users.controller.ts`, `users/users.service.ts` | RBAC hierarchy for user management |
| `websocket/realtime.gateway.ts` | `monitor:join` / `exam:join` require `assertCanMonitorExam`; `isMonitorRole` helper |
| `classes/` (module, controller, service, DTOs) | Class CRUD + enrollment as a course-agnostic student container (no `courseId`); `GET /classes` (staff, `classes.manage` perm), `GET /classes/my` (student), enroll/unenroll — `classes.manage` permission must exist in the target DB or every `/classes` call 403s |
| `exams/exams.service.ts` + `exams.controller.ts` | Class-based visibility: `assign-classes`/`unassign-class`/`class-assignments`/`assignments/effective` endpoints; `findAvailable` + `assertStudentAuthorized` enforce that unassigned exams are open, assigned exams are gated to direct students or class members |
| `prisma/seed.ts` + `prisma/schema.prisma` | `classes.manage` permission for SUPER_ADMIN/ADMIN/INSTRUCTOR; seeded demo classes no longer reference a course |
| `notifications/notifications.service.ts`, `notifications.controller.ts`, `notifications.module.ts` | Notification system made real: every create/`notifyMany` persists (with JSON `metadata`, carrying a frontend `link`) **and** emits `notification:new` to the recipient's `user:{id}` room via `RealtimeGateway` (module now imports `RealtimeModule`); added `GET /notifications/unread-count` and `PATCH /notifications/read-all` beside `GET /` and `PATCH :id/read` |
| `exams/exams.service.ts` (assignment) | `assignStudents` / `assignClasses` notify each newly affected student ("New exam assigned/available", type INFO, `link: /student/exams`); class assignment only notifies students of **newly** assigned classes |
| `push-notifications/` (module, `push.service.ts`, `push.controller.ts`, DTO) | Web Push (VAPID). `GET /push/vapid-key` is `@Public` and returns the public key (or `null` when unconfigured); `POST /push/subscriptions` / `DELETE /push/subscriptions` upsert/remove rows in `push_subscriptions`; `sendToUser` sends via `web-push` fire-and-forget (non-blocking) and self-heals by deleting subscriptions the push service reports as gone (404/410). No-op when `VAPID_*` env is absent |
| `notifications/notifications.service.ts` + `notifications.module.ts` | After socket emit, `create`/`notifyMany` also fire `void push.sendToUser(...)` (module now imports both `RealtimeModule` and `PushModule`) |
| `exam-sessions/requests.service.ts` + `exam-sessions.module.ts` | `notifyExamStaff`/`notifyStudent` now route through `NotificationsService.create` (persist + socket + push in one place); module imports `NotificationsModule` |
| `config/app.config.ts` | Optional `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` env |

Supporting pieces already present and re-used: `ExamAccessService.assertCanAct/assertCanMonitor/assertCanPerformAction`, `RealtimeGateway.emitNotification/emitToSession`, `AuditService`.

---

## 4. Frontend Changes

| File | Change |
|---|---|
| `types/monitoring.ts` | New config/policy types (`WebcamMode`, `MicMode`, `FullscreenPolicy`, `MonitoringStrictness`, `ExamConnectionLossPolicy`, `ExamResumePolicy`, `ExamRetakePolicy`) |
| `types/api.ts` | Policy fields on exam types; request types |
| `services/exams.service.ts` | Policy-aware create/update payloads |
| `services/requests.service.ts` (new) | `requestRetake`, `requestResume`, `listPending`, `listForExam`, `decide` against `/requests/*` |
| `hooks/use-proctoring.ts` | Exports `ProctoringStatus`; adds `retry()` + `retryNonce` to recover from transient start failures |
| `features/exams/exam-taking-client.tsx` | Proctoring status banner (starting / active / denied / unavailable + Retry); consent card shows enforced policy (`fullscreen REQUIRED`, strictness) and auto-requests fullscreen on consent; retake UI on `RETAKE_REQUIRED`/`RETAKE_PENDING`; "Request instructor approval now" button on `RESUME_PENDING` and on the auto-pause overlay (`exam:control` pause with `approval:true`); passes monitoring `requirements` (copy/paste restrictions) to the monitoring hook |
| `app/(dashboard)/student/exams/[examId]/take/page.tsx` + `resume/page.tsx` | Wrap the exam in a fixed fullscreen-only shell (`inset-0`, opaque bg) so the dashboard sidebar/topbar are covered — the student sees only the question room on take and resume/approval screens |
| `hooks/use-exam-monitoring.ts` | `ProctorControl` pause carries `approval`/`reason`/`message`; **blocks copy/cut when `disableCopy`, paste when `disablePaste`** (`preventDefault` on clipboard events + Ctrl+C/V/X), logging attempts |
| `app/(dashboard)/instructor/exams/create/page.tsx` | `connectionLossPolicy` / `resumePolicy` / `retakePolicy` selects default to strict (`APPROVAL_REQUIRED` / `INSTRUCTOR_APPROVAL` / `INSTRUCTOR_APPROVAL`) |
| `app/(dashboard)/instructor/exams/manage/page.tsx` | Same policy selects wired into edit payload (defaults to strict) |
| `app/(dashboard)/instructor/exams/monitor/page.tsx` | Monitoring settings: mode/policy selects, `violationThreshold`, tracking toggles; `PendingRequestsPanel` (list + approve/reject) |
| `hooks/use-notifications.ts` (new) | Live notification hook: connects the singleton socket, emits `notifications:subscribe {userId}`, listens `notification:new` → invalidates the list query (badge updates instantly) + 60s poll fallback; exposes `markRead`/`markAllRead` mutations and a `metadata.link` helper |
| `features/notifications/` (new) `notification-card.tsx`, `notifications-bell.tsx`, `notifications-page.tsx` | Reusable card (type icons incl. new types, unread highlight, optional route link); header Bell with live unread badge + dropdown (recent 8, mark-all-read, View all → `/notifications`); shared role-agnostic notifications page with skeleton/error/empty states |
| `components/layout/dashboard-shell.tsx` | Static link replaced by `<NotificationsBell />`; `/notifications` nav item added to Instructor and Admin groups |
| `app/(dashboard)/notifications/page.tsx` (new) | Shared notifications route for **all roles** under the dashboard layout |
| `app/(dashboard)/student/notifications/page.tsx` | Now renders the shared `NotificationsPage` (route preserved) |
| `types/api.ts`, `services/notifications.service.ts` | `Notification.metadata`; client `markAllRead`/`unreadCount` |
| `public/sw.js` (new) | Service worker: shows a browser notification on `push` (title/body/metadata from the encrypted payload) and opens `metadata.link` (default `/notifications`) on click |
| `services/push.service.ts` (new) | VAPID key fetch; subscribe/unsubscribe endpoints; base64url helpers for `p256dh`/`auth` and the application server key |
| `hooks/use-push-notifications.ts` (new) | `enable()` requests permission, registers `/sw.js`, subscribes via `pushManager` using the server VAPID key, and syncs the endpoint to the backend; `disable()` unsubscribes locally + deletes server-side; detects existing subscriptions on mount |
| `features/notifications/push-preferences.tsx` (new) | "Browser notifications" card on the shared notifications page (Enable/Disable; warns when permission is blocked) |
| `middleware.ts` | `/sw.js` added to the public bypass so the service worker registers regardless of auth state |
| `websocket/realtime.gateway.ts` | `staff:subscribe` handler (joins `staff` room, monitor roles only) + `emitToStaff(event, payload)` helper; `message:new` emitted on contact-form submission (`ContactService.create`) and on student `MANUAL_FLAG` exam events carrying a message (`MonitoringService.recordEvent`), so staff inboxes update live |
| `hooks/use-inbox.ts` (new) | Staff live-inbox hook: connects the singleton socket, emits `staff:subscribe`, listens `message:new` → invalidates `['messages']` queries + toast; used by the instructor Messages page, which also keeps its 15s poll as fallback |
| `components/layout/dashboard-shell.tsx` | Global `RefreshButton` (Refresh icon) in the header: `queryClient.invalidateQueries()` for all active queries with a spinner while in-flight — manual refresh no longer needs a page reload |

---

## 5. API Surface (summary)

- `POST /requests/retake {examId, reason?}` → student → dedupes, notifies staff, returns `RetakeRequest`.
- `POST /requests/resume {sessionId, reason?}` → student (paused session only) → notifies staff.
- `GET /requests/pending?examId=` → staff; `{ retake: [...], resume: [...] }` for exams the caller can monitor (admins: all non-draft).
- `GET /requests/exam/:examId` → monitor-guarded history.
- `POST /requests/:id/approve|reject` → CO_OWNER/admin vs PROCTOR rules; approves retake → sets `retakePermitted`; approves resume → transitions session to `IN_PROGRESS` + emits socket control.
- LOCKED error codes surfaced to the client: `RETAKE_REQUIRED`, `RETAKE_PENDING`, `RESUME_PENDING`, `RESUME_DENIED`.
- Notifications: `GET /notifications` (own, latest 100), `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` — all scoped to the authenticated user; new notifications also arrive live on `notification:new` (Socket.IO room `user:{userId}`).
- Web Push: `GET /push/vapid-key` (public), `POST /push/subscriptions`, `DELETE /push/subscriptions` — the latter two scoped to `user.sub`. Requires `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (`VAPID_SUBJECT`) on the backend; without them subscribe endpoints still work but push is skipped.

---

## 6. Security Hardening Checklist

- [x] Reports endpoints enforce object-level ownership (exam/student/subject scope) + `isAdmin` by-pass only for true admins
- [x] Instructor overview scoped to own exams (no cross-tenant leak)
- [x] `exam-sessions` retake permit/revoke requires CO_OWNER; `findByExam` requires monitor
- [x] Websocket `monitor:join` / `exam:join` authenticated per-exam
- [x] Monitoring staff endpoints assert per-exam access (config, stats, sessions, timeline, ack, actions)
- [x] Requests decide() gates approve/reject on policy + access level
- [x] JWT strategy re-validates live user
- [x] Duplicate request prevention; invalid date ranges → 400
- [x] No new SUPER_ADMIN creation path by non-superadmins

---

## 7. Deployment Requirements (apply BEFORE/with deploy)

1. **`NEXT_PUBLIC_PROCTORING_URL` must be set to a TLS URL at frontend build time** in Vercel (e.g. `https://your-proctoring-host`). Do **not** rely on the old fallback (`http://127.0.0.1:8000`) — it produced mixed-content failures (the P0). If the FastAPI service has no public TLS URL, this is the single deploy-blocking item.
2. Backend `DATABASE_URL` (pooled) + `DIRECT_DATABASE_URL` (Prisma Migrate) as already configured. Deploy the migrations before starting the new backend build. `20260908120000_default_strict_policies` changes defaults AND backfills existing exams to strict approval policies — apply it once, it is idempotent by policy (only non-strict rows are updated).
3. Apply `pnpm prisma migrate deploy` in the backend deployment, then start the API (health checks on `GET /monitoring/health` and `GET /monitoring/health/ready` are public).
4. No secrets are in the repo; env values come from deployment variables.
5. **Web Push (optional)**: add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` to the backend deployment env (Render dashboard). Keys were generated with `web-push.generateVAPIDKeys()` and are already in local `deployment/.env.production` for migrations/tests. Until set, the app is unaffected (subscriptions skipped, `GET /push/vapid-key` returns `null`).

## 8. Test Matrix

| Area | Result |
|---|---|
| Backend build (`nest build`) | PASS (0 errors) |
| Backend lint (`eslint` strict) | PASS (0 errors, pre-existing warnings only) |
| Frontend typecheck (`tsc --noEmit`) | PASS |
| Frontend build (`next build`) | PASS |
| Frontend lint (`eslint`) | PASS (0 errors, 26 pre-existing warnings) |
| DB migration applied, `finished_at` set | PASS |
| DB schema drift check (exams policy cols, monitoring config cols, enums, new tables) | PASS |
| Existing exam data intact (no destructive change) | PASS |
| RBAC / object-level ownership on reports, sessions, monitoring, websocket, requests | PASS (static + code review) |
| Retake/resume request lifecycle (submit → notify → decide → approve → resume/retakePermitted → socket control) | PASS (code review; no local e2e) |
| Student blocked on interruption (blur/tab-switch/fullscreen-exit auto-pause + approval) | PASS (code review; enforced now that `connectionLossPolicy: APPROVAL_REQUIRED` is default & backfilled) |
| Copy/paste blocked in the exam browser (disableCopy/disablePaste) + attempts still logged | PASS (code review + bundle marker) |
| Exam room is fullscreen-only (no sidebar/topbar visible) during take/resume | PASS (code review + live RSC payload marker) |
| Classes load for staff (`classes.manage` permission + class is a course-agnostic container; `classes.courseId` dropped on prod) | PASS (prod DB permission + migration verified) |
| Notifications live in-app (persist + socket `notification:new` + unread badge + read-all + shared `/notifications` for all roles) | PASS (prod endpoints 401/200 + deployed chunk marker) |
| Web Push endpoints (`GET /push/vapid-key` public, `POST /push/subscriptions` auth) + `/sw.js` served | PASS (prod: vapid-key 200 `{publicKey:null}`, subscriptions 401, sw.js 200) |
| Web Push end-to-end delivery | DEPENDS on §7.5 env config (VAPID keys on the backend) |
| Webcam proctoring in production | DEPENDS on §7.1 env config |
| Production migration + strict-policy backfill applied + verified via direct DB read | PASS |
| Notifications live (persist + socket `notification:new` + unread badge + read-all) | PASS (deployed chunk contains `notifications:subscribe` / `notification:new`) |
| Staff inbox live (socket `staff:subscribe` + `message:new` on contact + MANUAL_FLAG) + global refresh button | PASS (deployed chunk `453nbbj0l4x_6.js` contains `message:new` + `staff:subscribe`) |
| Production smoke (deployed routes) | PENDING — manual after deploy |

## 9. Known Limitations / Next Steps

- Real-time proctoring still requires the FastAPI service reachable from the student browser over TLS; app code path is ready and resilient (banners + retry + consent + policy).
- No automated unit/e2e suite exists in this repo; the matrix above is build/lint/typecheck + schema verification + static security review. Adding Playwright/Cypress spec coverage for the retake/resume request flows is the highest-value follow-up.
- `docs/` are pre-existing; `preport.md` was updated with the class-container tables (§3.31–3.33) and the two class migrations.