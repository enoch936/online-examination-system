# UI/UX Design System

## Principles

- Quiet enterprise SaaS interface for repeated daily use.
- Dense, scannable dashboards instead of marketing-heavy surfaces.
- Clear role-based navigation for student, instructor, and admin workflows.
- Accessible color contrast, keyboard focus states, and semantic form markup.
- Light, dark, and system themes.

## Core Surfaces

- Public site: landing, about, contact, pricing, FAQ.
- Auth: login, registration, password recovery, reset, email verification.
- Student: dashboard, exams, take/resume exam, history, results, certificates, notifications, profile, settings.
- Instructor: dashboard, question bank, import, create/manage/monitor exams, results, reports, profile.
- Admin: users, roles, permissions, subjects, courses, exams, reports, analytics, settings, audit logs.

## Interaction Patterns

- Icon buttons use Lucide icons.
- Forms use React Hook Form and Zod validation.
- Charts use Recharts.
- Toasts use Sonner.
- Critical exam interactions autosave and expose visible state.
- Page transitions and high-value state changes use restrained Framer Motion animations.
