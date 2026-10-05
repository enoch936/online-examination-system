import { RoleName } from '@prisma/client';

/**
 * Single source of truth for the permission catalogue and the default grants.
 *
 * Three consumers depend on this and must never disagree:
 *
 *   - `prisma/seed.ts`                       — fresh/dev databases
 *   - `PermissionsBootstrapService`          — every boot, including production
 *   - the `add_contact_permissions` migration — declarative record of a change
 *
 * `prisma db seed` only runs on a developer machine. A deployed environment
 * gets its reference data from a boot-time bootstrap instead, which is why the
 * catalogue lives here rather than inside the seed script.
 */

export const PERMISSIONS = [
  { key: 'users.read', label: 'Read users', module: 'users' },
  { key: 'users.write', label: 'Write users', module: 'users' },
  { key: 'roles.manage', label: 'Manage roles', module: 'roles' },
  { key: 'subjects.manage', label: 'Manage subjects', module: 'subjects' },
  { key: 'courses.manage', label: 'Manage courses', module: 'courses' },
  { key: 'classes.manage', label: 'Manage classes and enrollments', module: 'classes' },
  { key: 'exams.manage', label: 'Manage exams', module: 'exams' },
  { key: 'questions.manage', label: 'Manage questions', module: 'questions' },
  { key: 'sessions.monitor', label: 'Monitor exam sessions', module: 'exam-sessions' },
  { key: 'reports.read', label: 'Read reports', module: 'reports' },
  { key: 'audit.read', label: 'Read audit logs', module: 'audit-logs' },
  { key: 'contact.read', label: 'Read contact messages', module: 'contact' },
  { key: 'contact.manage', label: 'Manage contact messages', module: 'contact' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

/**
 * The grants a freshly installed system starts with.
 *
 * These are a floor, not a ceiling: the bootstrap only ever ADDS the pairs
 * listed here. A grant an administrator has since given to another role, or a
 * permission they have removed from a role, is left alone — otherwise every
 * restart would silently undo deliberate access decisions.
 */
export const DEFAULT_ROLE_GRANTS: Record<RoleName, PermissionKey[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.key),
  ADMIN: [
    'users.read',
    'subjects.manage',
    'courses.manage',
    'classes.manage',
    'exams.manage',
    'questions.manage',
    'sessions.monitor',
    'reports.read',
    'audit.read',
    'contact.read',
    'contact.manage',
  ],
  INSTRUCTOR: ['exams.manage', 'questions.manage', 'classes.manage', 'sessions.monitor', 'reports.read', 'contact.read'],
  STUDENT: ['users.read'],
};
