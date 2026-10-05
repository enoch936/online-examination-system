-- Contact-inbox permissions.
--
-- Permissions are enforced at request time by PermissionsGuard, but a
-- production deploy only runs `prisma migrate deploy` (render.yaml
-- preDeployCommand) — never `prisma seed`. Reference data that the API
-- authorises against therefore has to arrive as a migration, otherwise the
-- contact inbox is deployed with nobody authorised to open it.
INSERT INTO "permissions" ("id", "key", "label", "module", "createdAt")
VALUES
  (gen_random_uuid()::text, 'contact.read', 'Read contact messages', 'contact', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'contact.manage', 'Manage contact messages', 'contact', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- SUPER_ADMIN and ADMIN work the inbox; INSTRUCTOR keeps read-only access,
-- matching the role set the contact routes already accepted.
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('SUPER_ADMIN', 'ADMIN')
  AND p."key" IN ('contact.read', 'contact.manage')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'INSTRUCTOR'
  AND p."key" = 'contact.read'
ON CONFLICT DO NOTHING;
