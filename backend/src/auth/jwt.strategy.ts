import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = AuthenticatedUser & {
  iat: number;
  exp: number;
};

const cookieExtractor = (request: { cookies?: Record<string, string> } | undefined): string | null => {
  return request?.cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Re-resolves roles/permissions/status from the database on every request.
   * The JWT payload only identifies the subject; a suspended or demoted user
   * is rejected immediately instead of continuing with a stale (privileged)
   * token until they next refresh.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        status: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: { select: { permission: { select: { key: true } } } },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const roles = user.roles.map((userRole) => userRole.role.name);
    const permissions = [...new Set(
      user.roles.flatMap((userRole) =>
        userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.key),
      ),
    )];

    return {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
    };
  }
}