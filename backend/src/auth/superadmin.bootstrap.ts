import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { passwordPolicyProblem } from '../common/utils/password.util';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Bootstraps the initial SUPER_ADMIN account at server start, when one does
 * not yet exist. Security properties:
 *
 * - The bootstrap credentials are read ONLY from server-side environment
 *   variables (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD). They are never
 *   hardcoded and never exposed through NEXT_PUBLIC_* or any API response.
 * - The password is stored exclusively as a bcrypt hash in PostgreSQL.
 * - It is idempotent: if a SUPER_ADMIN already exists, this runs as a no-op
 *   and NEVER overwrites or resets the existing password.
 * - If the credentials are missing while a bootstrap is still required, the
 *   process fails fast with a clear configuration error instead of using any
 *   default password.
 */
@Injectable()
export class SuperAdminBootstrapService {
  private readonly logger = new Logger(SuperAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async ensure(): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { roles: { some: { role: { name: RoleName.SUPER_ADMIN } } } },
      select: { id: true },
    });
    if (existing) {
      this.logger.log('Super admin already exists; skipping bootstrap (password is never overwritten).');
      return;
    }

    // Server-side only: these are read from process.env/.env at runtime.
    const email = this.config.get<string>('SUPERADMIN_EMAIL');
    const password = this.config.get<string>('SUPERADMIN_PASSWORD');

    if (!email || !password) {
      throw new Error(
        'Super admin bootstrap: SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set ' +
          '(server-side environment variables on Render/Docker only — never NEXT_PUBLIC_*). ' +
          'Refusing to start without them.',
      );
    }

    const problem = passwordPolicyProblem(password, { email });
    if (problem) {
      throw new Error(`Super admin bootstrap: configured SUPERADMIN_PASSWORD violates the policy (${problem}).`);
    }

    const role =
      (await this.prisma.role.findUnique({ where: { name: RoleName.SUPER_ADMIN } })) ??
      (await this.prisma.role.create({
        data: { name: RoleName.SUPER_ADMIN, description: 'Super admin role' },
      }));

    const passwordHash = await bcrypt.hash(password, this.config.get<number>('BCRYPT_ROUNDS', 12));
    let user: { id: string; email: string };
    try {
      user = await this.prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          firstName: 'Super',
          lastName: 'Admin',
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          roles: { create: { roleId: role.id } },
        },
        select: { id: true, email: true },
      });
    } catch (err) {
      // Race safety: if another instance bootstrapped the SUPER_ADMIN between
      // our existence check and this create (same unique email), treat it as a
      // success and NEVER overwrite the password.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log('Super admin was created concurrently by another instance; skipping duplicate.');
        return;
      }
      throw err;
    }

    await this.prisma.auditLog
      .create({
        data: {
          actorId: user.id,
          entity: 'USER',
          entityId: user.id,
          action: 'SUPER_ADMIN_BOOTSTRAPPED',
          after: JSON.stringify({ at: new Date().toISOString() }),
        },
      })
      .catch(() => {});

    this.logger.log(`Super admin bootstrapped (${user.email}); only a bcrypt hash is stored.`);
  }
}