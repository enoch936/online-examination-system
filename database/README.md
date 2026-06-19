# Database Design

PostgreSQL is the system of record. Prisma migrations should be generated from `backend/prisma/schema.prisma`.

## Key Tables

- `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
- `subjects`, `courses`
- `exams`, `exam_questions`
- `questions`, `question_options`
- `exam_sessions`, `student_answers`, `submissions`
- `results`, `certificates`
- `notifications`, `activity_logs`, `audit_logs`, `refresh_tokens`

## Index Strategy

- Email, role name, permission key, exam slug, certificate number, token jti are unique.
- Session lookups are indexed by student, exam, status, and timestamps.
- Audit and activity logs are indexed by actor and event time.
- Foreign keys use cascading rules only where lifecycle ownership is clear.

## ER Diagram

See `docs/architecture.md`.
