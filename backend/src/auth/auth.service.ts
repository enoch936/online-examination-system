import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoleName, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { passwordPolicyProblem } from '../common/utils/password.util';
import { durationToMs } from '../common/utils/duration.util';
import {
  DUMMY_BCRYPT_HASH,
  isPasswordBreached,
  normalizeEmail,
  verifyTurnstile,
} from '../common/utils/auth-hardening.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

type SafeUser = Omit<User, 'passwordHash'> & {
  roles: RoleName[];
  permissions: string[];
};

type UserWithRoles = User & {
  roles: Array<{
    role: {
      name: RoleName;
      rolePermissions: Array<{
        permission: {
          key: string;
        };
      }>;
    };
  }>;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
};

type SessionInfo = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, deviceInfo?: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
    const email = normalizeEmail(dto.email);
    const turnstileOk = await verifyTurnstile(
      dto.turnstileToken,
      this.config.get<string | undefined>('TURNSTILE_SECRET_KEY'),
    );
    if (!turnstileOk) {
      throw new ForbiddenException('CAPTCHA verification failed. Please try again.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Consume bcrypt time so a duplicate-email response is not faster than a
      // fresh registration (prevents email-enumeration by timing).
      await bcrypt.compare(dto.password, DUMMY_BCRYPT_HASH);
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.config.get<number>('BCRYPT_ROUNDS', 12));
    if (await isPasswordBreached(dto.password)) {
      throw new BadRequestException('This password has appeared in a data breach. Choose a different password.');
    }
    const studentRole = await this.prisma.role.upsert({
      where: { name: RoleName.STUDENT },
      update: {},
      create: { name: RoleName.STUDENT, description: 'Student role' },
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        roles: { create: { roleId: studentRole.id } },
      },
      include: this.userInclude(),
    });

    this.recordAudit({
      action: 'REGISTER',
      entity: 'USER',
      entityId: user.id,
      actorId: user.id,
      deviceInfo,
    });

    return this.issueTokens(user, deviceInfo);
  }

  async login(dto: LoginDto, deviceInfo?: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
    const email = normalizeEmail(dto.email);
    const turnstileOk = await verifyTurnstile(
      dto.turnstileToken,
      this.config.get<string | undefined>('TURNSTILE_SECRET_KEY'),
    );
    if (!turnstileOk) {
      throw new ForbiddenException('CAPTCHA verification failed. Please try again.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: this.userInclude(),
    });

    // Always run a full bcrypt compare (dummy hash for unknown emails) so
    // success/failure/unknown-account responses all take the same time.
    const validPassword = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_BCRYPT_HASH);
    if (!user || !validPassword || user.status !== UserStatus.ACTIVE) {
      this.recordAudit({
        action: 'LOGIN_FAILED',
        entity: 'AUTH',
        entityId: user?.id,
        actorId: undefined,
        deviceInfo,
        metadata: { email },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.recordAudit({
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      actorId: user.id,
      deviceInfo,
    });

    return this.issueTokens(user, deviceInfo);
  }

  async refresh(refreshToken: string, deviceInfo?: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; jti: string; type: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const stored = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });

      if (!stored) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (stored.revokedAt) {
        // Reuse detection: this token was already rotated — revoke ALL sessions for this user
        await this.prisma.refreshToken.updateMany({
          where: { userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const matches = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (!matches) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: payload.sub },
        include: this.userInclude(),
      });

      return this.issueTokens(user, deviceInfo);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Identical work whether or not the account exists: the lookup above, a
    // full bcrypt compare against the real hash or an equal-cost dummy, and a
    // reset-token signature (discarded for unknown emails). No branch returns
    // early and nothing observable differs between the two outcomes.
    await bcrypt.compare('timing-equalizer-dummy', user?.passwordHash ?? DUMMY_BCRYPT_HASH);
    await this.jwt.signAsync(
      { sub: user?.id ?? randomUUID(), type: 'reset' },
      { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: '15m' },
    );
    return { message: 'If the account exists, a reset email was sent.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ changed: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // The current password must be supplied and verified before any change.
    const currentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Enforce the policy even on top of the DTO validation.
    const problem = passwordPolicyProblem(dto.newPassword, { email: user.email });
    if (problem) {
      throw new BadRequestException(problem);
    }
    if (await isPasswordBreached(dto.newPassword)) {
      throw new BadRequestException('This password has appeared in a data breach. Choose a different password.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, this.config.get<number>('BCRYPT_ROUNDS', 12));
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate all refresh tokens/sessions so the password change takes effect everywhere.
    await this.revokeAllSessions(userId);

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        entity: 'USER',
        entityId: userId,
        action: 'PASSWORD_CHANGED',
        after: JSON.stringify({ at: new Date().toISOString() }),
      },
    });

    return { changed: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(dto.token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'reset') {
        throw new UnauthorizedException('Invalid reset token');
      }
      if (await isPasswordBreached(dto.password)) {
        throw new BadRequestException('This password has appeared in a data breach. Choose a different password.');
      }
      const passwordHash = await bcrypt.hash(dto.password, this.config.get<number>('BCRYPT_ROUNDS', 12));
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { passwordHash },
      });
      return { reset: true };
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude(),
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toSafeUser(user);
  }

  async updateProfile(userId: string, dto: { firstName?: string; lastName?: string; email?: string; phone?: string; avatarUrl?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const email = dto.email ? normalizeEmail(dto.email) : undefined;
    if (email && email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw new ConflictException('Email is already taken');
      }
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(email !== undefined && { email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      include: this.userInclude(),
    });
    return this.toSafeUser(updated);
  }

  // --- Session Management ---

  async getSessions(userId: string): Promise<SessionInfo[]> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
    return tokens.map(t => ({
      id: t.id,
      userAgent: t.userAgent,
      ipAddress: t.ipAddress,
      createdAt: t.createdAt,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const token = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
    if (!token) {
      throw new UnauthorizedException('Session not found');
    }
    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string, excludeSessionId?: string): Promise<void> {
    const where: any = { userId, revokedAt: null };
    if (excludeSessionId) {
      where.id = { not: excludeSessionId };
    }
    await this.prisma.refreshToken.updateMany({
      where,
      data: { revokedAt: new Date() },
    });
  }

  // --- Cleanup ---

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }

  async verifyEmail(dto: { token: string }) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(dto.token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'verify') {
        throw new UnauthorizedException('Invalid or expired verification token');
      }
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      });
      return { verified: true };
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token');
    }
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return { revoked: false };
    }
    try {
      const payload = await this.jwt.verifyAsync<{ jti: string }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload?.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { jti: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Token may already be expired — try decoding to get jti for cleanup
      const decoded = this.jwt.decode(refreshToken) as { jti?: string } | null;
      if (decoded?.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { jti: decoded.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
    return { revoked: true };
  }

  private recordAudit(input: {
    action: string;
    entity: string;
    entityId?: string;
    actorId?: string;
    deviceInfo?: { userAgent?: string; ipAddress?: string };
    metadata?: Record<string, unknown>;
  }) {
    void this.prisma.auditLog
      .create({
        data: {
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          actor: input.actorId ? { connect: { id: input.actorId } } : undefined,
          ipAddress: input.deviceInfo?.ipAddress ?? null,
          userAgent: input.deviceInfo?.userAgent ?? null,
          after: input.metadata ? JSON.stringify(input.metadata) : undefined,
        },
      })
      .catch(() => undefined);
  }

  private async issueTokens(user: UserWithRoles, deviceInfo?: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
    const safeUser = this.toSafeUser(user);
    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      roles: safeUser.roles,
      permissions: safeUser.permissions,
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti, type: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any,
      },
    );
    const expiresAt = new Date(Date.now() + this.refreshTokenLifetimeMs());
    const tokenHash = await bcrypt.hash(refreshToken, this.config.get<number>('BCRYPT_ROUNDS', 12));

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        jti,
        expiresAt,
        userAgent: deviceInfo?.userAgent ?? null,
        ipAddress: deviceInfo?.ipAddress ?? null,
        lastUsedAt: new Date(),
      },
    });

    // Clean up old revoked/expired tokens opportunistically (non-blocking)
    this.prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    }).catch(() => {});

    return { accessToken, refreshToken, user: safeUser };
  }

  private toSafeUser(user: UserWithRoles): SafeUser {
    const { passwordHash: _passwordHash, roles: userRoles, ...rest } = user;
    const roles = userRoles.map((userRole) => userRole.role.name);
    const permissions = userRoles.flatMap((userRole) =>
      userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.key),
    );

    return {
      ...rest,
      roles,
      permissions: [...new Set(permissions)],
    };
  }

  private userInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    } as const;
  }

  private refreshTokenLifetimeMs() {
    return durationToMs(this.config.get<string>('JWT_REFRESH_EXPIRES_IN'), 7 * 24 * 60 * 60 * 1000);
  }
}
