import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

describe('PermissionsGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: PermissionsGuard;
  let context: ExecutionContext;

  const asHttp = (user?: { roles: string[]; permissions: string[] }) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('allows the request when the route declares no permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(asHttp({ roles: ['STUDENT'], permissions: [] }))).toBe(true);
  });

  it('allows the request when every required permission is held', () => {
    reflector.getAllAndOverride.mockReturnValue(['contact.read']);
    expect(
      guard.canActivate(asHttp({ roles: ['ADMIN'], permissions: ['contact.read', 'users.read'] })),
    ).toBe(true);
  });

  it('ignores non-http execution contexts', () => {
    reflector.getAllAndOverride.mockReturnValue(['contact.read']);
    const ws = { getType: () => 'ws' } as unknown as ExecutionContext;
    expect(guard.canActivate(ws)).toBe(true);
  });

  // The whole point: a refusal must explain itself instead of surfacing as a
  // bare "Forbidden resource".
  it('names the role and the missing permission when refusing', () => {
    reflector.getAllAndOverride.mockReturnValue(['roles.manage']);

    expect(() => guard.canActivate(asHttp({ roles: ['ADMIN'], permissions: ['users.write'] }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(asHttp({ roles: ['ADMIN'], permissions: ['users.write'] }))).toThrow(
      /ADMIN.*roles\.manage/s,
    );
  });

  it('lists every missing permission when several are required', () => {
    reflector.getAllAndOverride.mockReturnValue(['roles.manage', 'users.write']);

    try {
      guard.canActivate(asHttp({ roles: ['INSTRUCTOR'], permissions: ['exams.manage'] }));
      throw new Error('should have thrown');
    } catch (err) {
      const message = (err as ForbiddenException).message;
      expect(message).toContain('roles.manage');
      expect(message).toContain('users.write');
      expect(message).toContain('INSTRUCTOR');
    }
  });

  it('refuses when the caller has no permissions at all', () => {
    reflector.getAllAndOverride.mockReturnValue(['contact.read']);
    expect(() => guard.canActivate(asHttp({ roles: ['STUDENT'], permissions: [] }))).toThrow(
      ForbiddenException,
    );
  });

  it('refuses when the request carries no authenticated user', () => {
    reflector.getAllAndOverride.mockReturnValue(['contact.read']);
    expect(() => guard.canActivate(asHttp(undefined))).toThrow(ForbiddenException);
  });
});