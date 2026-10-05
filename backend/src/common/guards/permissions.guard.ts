import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType<string>() !== 'http') {
      return true;
    }
    const permissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    const missing = permissions.filter((permission) => !user?.permissions.includes(permission));
    if (missing.length === 0) {
      return true;
    }

    // Returning false here would let Nest emit its generic "Forbidden resource"
    // body, which tells the caller nothing about *why* the request was refused.
    // An authority failure must name the caller's role and the missing
    // permission, otherwise a user who lacks the right concludes the button is
    // broken rather than that their role is not permitted to use it.
    const roles = user?.roles?.length ? user.roles.join(', ') : 'no role';
    throw new ForbiddenException(
      `Your role (${roles}) does not have the ${missing.join(', ')} permission, ` +
        'so it cannot perform this action. Ask a super administrator if you need access.',
    );
  }
}