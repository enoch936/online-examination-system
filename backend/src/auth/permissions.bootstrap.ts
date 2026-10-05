import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ROLE_GRANTS, PERMISSIONS } from '../common/constants/permissions';

/**
 * Installs the permission catalogue and the default role grants on every boot.
 *
 * It is deliberately NOT a Prisma seed script, for the same reason the
 * certificate-template bootstrap is not: `prisma db seed` never runs on a
 * deployed database, and a deploy pipeline that skips `prisma migrate deploy`
 * would otherwise ship code guarded by `@Permissions('...')` that no role
 * holds. Every request would 403 and the feature would look broken rather than
 * un-migrated.
 *
 * Behaviour:
 *
 * - Idempotent. Safe to run on every start of every instance.
 * - Additive only. Grants listed in DEFAULT_ROLE_GRANTS are created when
 *   missing; existing grants are never modified and never revoked, so an
 *   administrator's deliberate access decisions survive a restart.
 * - Fail-soft. A database hiccup here must not stop the API from serving the
 *   rest of the platform, so failures are logged and the boot continues.
 * - Labels and modules are refreshed from the catalogue so the admin
 *   Permissions screen cannot drift from the code that enforces them.
 */
@Injectable()
export class PermissionsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionsBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const { createdPermissions, createdGrants } = await this.ensure();
      if (createdPermissions === 0 && createdGrants === 0) {
        this.logger.log('Permission catalogue and role grants already present; skipped.');
      } else {
        this.logger.log(
          `Installed ${createdPermissions} permission(s) and ${createdGrants} role grant(s) that were missing.`,
        );
      }
    } catch (err) {
      // Non-fatal: the API still serves every route that needs no permission.
      this.logger.error(
        `Could not reconcile permissions: ${(err as Error).message}. ` +
          'Routes guarded by @Permissions will reject until this succeeds.',
      );
    }
  }

  async ensure(): Promise<{ createdPermissions: number; createdGrants: number }> {
    let createdPermissions = 0;

    for (const permission of PERMISSIONS) {
      // upsert keeps a pre-existing row's id (and therefore any grants already
      // pointing at it) while refreshing the human-readable metadata.
      const existing = await this.prisma.permission.findUnique({
        where: { key: permission.key },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.permission.update({
          where: { key: permission.key },
          data: { label: permission.label, module: permission.module },
        });
        continue;
      }
      await this.prisma.permission.create({ data: permission });
      createdPermissions++;
    }

    const roles = await this.prisma.role.findMany({ select: { id: true, name: true } });
    const byName = new Map(roles.map((role) => [role.name, role.id]));

    let createdGrants = 0;
    for (const [roleName, keys] of Object.entries(DEFAULT_ROLE_GRANTS)) {
      const roleId = byName.get(roleName as never);
      // A role that does not exist yet simply gets no grants; the seed and the
      // migrations create the four built-in roles.
      if (!roleId) continue;

      for (const key of keys) {
        const permission = await this.prisma.permission.findUnique({
          where: { key },
          select: { id: true },
        });
        if (!permission) continue;

        const granted = await this.prisma.rolePermission.findUnique({
          where: { roleId_permissionId: { roleId, permissionId: permission.id } },
          select: { roleId: true },
        });
        if (granted) continue;

        await this.prisma.rolePermission.create({ data: { roleId, permissionId: permission.id } });
        createdGrants++;
      }
    }

    return { createdPermissions, createdGrants };
  }
}
