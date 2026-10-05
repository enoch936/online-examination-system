import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

/**
 * Administrative password reset. Two properties matter and are easy to get
 * wrong: the reset must be rejected for a peer-or-higher account (otherwise an
 * ADMIN can hijack a SUPER_ADMIN), and it must revoke the target's refresh
 * tokens (otherwise the old credentials keep working until they expire).
 */

const superAdmin = { sub: 'super-1', roles: [RoleName.SUPER_ADMIN] } as unknown as AuthenticatedUser;
const admin = { sub: 'admin-1', roles: [RoleName.ADMIN] } as unknown as AuthenticatedUser;

function userWithRoles(...roles: RoleName[]) {
  return { id: 'target-1', roles: roles.map((name) => ({ role: { name } })) };
}

function makeService(target = userWithRoles(RoleName.STUDENT)) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(target),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const config = { get: jest.fn().mockReturnValue(12) } as unknown as ConfigService;
  const service = new UsersService(prisma as unknown as PrismaService, config);
  return { service, prisma };
}

describe('UsersService.resetPassword', () => {
  it('hashes the new password instead of storing it verbatim', async () => {
    const { service, prisma } = makeService();

    await service.resetPassword('target-1', { newPassword: 'Str0ng!Passphrase' }, superAdmin);

    const updateArg = prisma.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'target-1' });
    expect(updateArg.data.passwordHash).not.toBe('Str0ng!Passphrase');
    await expect(bcrypt.compare('Str0ng!Passphrase', updateArg.data.passwordHash)).resolves.toBe(true);
  });

  it('revokes every active refresh token so old credentials stop working', async () => {
    const { service, prisma } = makeService();

    await service.resetPassword('target-1', { newPassword: 'Str0ng!Passphrase' }, superAdmin);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    const revokeArg = prisma.refreshToken.updateMany.mock.calls[0][0];
    expect(revokeArg.where).toEqual({ userId: 'target-1', revokedAt: null });
    expect(revokeArg.data.revokedAt).toBeInstanceOf(Date);
  });

  it('never returns the password hash to the caller', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'target-1',
      email: 'student@example.com',
      passwordHash: 'hash',
      roles: [{ role: { name: RoleName.STUDENT } }],
    });

    const result = await service.resetPassword('target-1', { newPassword: 'Str0ng!Passphrase' }, superAdmin);

    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects resetting an account with equal or higher privileges', async () => {
    const { service, prisma } = makeService(userWithRoles(RoleName.SUPER_ADMIN));

    await expect(
      service.resetPassword('target-1', { newPassword: 'Str0ng!Passphrase' }, admin),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('allows an admin to reset an instructor password', async () => {
    const { service } = makeService(userWithRoles(RoleName.INSTRUCTOR));

    await expect(service.resetPassword('target-1', { newPassword: 'Str0ng!Passphrase' }, admin)).resolves.toBeDefined();
  });

  it('allows a user to change their own password without the privilege check', async () => {
    const { service } = makeService(userWithRoles(RoleName.ADMIN));

    await expect(
      service.resetPassword('admin-1', { newPassword: 'Str0ng!Passphrase' }, admin),
    ).resolves.toBeDefined();
  });

  it('rejects an unknown user', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.resetPassword('ghost', { newPassword: 'Str0ng!Passphrase' }, superAdmin)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});