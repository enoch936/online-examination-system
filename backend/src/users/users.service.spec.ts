import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoleName, UserStatus } from '@prisma/client';
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
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({ id: target.id }),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const config = { get: jest.fn().mockReturnValue(12) } as unknown as ConfigService;
  const service = new UsersService(prisma as unknown as PrismaService, config);
  return { service, prisma };
}

describe('UsersService.remove', () => {
  function deletable(counts: Record<string, number> = {}) {
    const { service, prisma } = makeService();
    prisma.user.findUnique
      .mockResolvedValueOnce({ roles: [{ role: { name: RoleName.STUDENT } }] }) // privilege check
      .mockResolvedValueOnce({
        _count: {
          sessions: 0,
          createdExams: 0,
          createdQuestions: 0,
          examAssignments: 0,
          classEnrollments: 0,
          answers: 0,
          examEvents: 0,
          retakeRequests: 0,
          resumeRequests: 0,
          auditLogs: 0,
          ...counts,
        },
      });
    return { service, prisma };
  }

  it('refuses to delete your own account', async () => {
    const { service, prisma } = makeService();

    await expect(service.remove('super-1', superAdmin)).rejects.toThrow(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete a peer-or-higher account', async () => {
    const { service, prisma } = makeService(userWithRoles(RoleName.SUPER_ADMIN));

    await expect(service.remove('target-1', admin)).rejects.toThrow(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  // Deleting an account that owns exam/audit history would either fail on a
  // foreign key or destroy records that must be kept.
  it.each([
    ['sessions', { sessions: 3 }],
    ['createdExams', { createdExams: 1 }],
    ['auditLogs', { auditLogs: 7 }],
    ['examAssignments', { examAssignments: 2 }],
    ['classEnrollments', { classEnrollments: 4 }],
    ['answers', { answers: 5 }],
    ['examEvents', { examEvents: 9 }],
  ])('refuses to delete an account that has %s', async (_label, counts) => {
    const { service, prisma } = deletable(counts);

    await expect(service.remove('target-1', superAdmin)).rejects.toThrow(/cannot be deleted/i);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('deletes an account with no records', async () => {
    const { service, prisma } = deletable();

    await expect(service.remove('target-1', superAdmin)).resolves.toEqual({ id: 'target-1', deleted: true });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'target-1' } });
  });

  it('turns a leftover foreign key into a helpful message', async () => {
    const { service, prisma } = deletable();
    prisma.user.delete = jest.fn().mockRejectedValue(Object.assign(new Error('fk'), { code: 'P2003' }));

    await expect(service.remove('target-1', superAdmin)).rejects.toThrow(/cannot be deleted/i);
  });

  it('rethrows unexpected database errors', async () => {
    const { service, prisma } = deletable();
    prisma.user.delete = jest.fn().mockRejectedValue(new Error('connection lost'));

    await expect(service.remove('target-1', superAdmin)).rejects.toThrow('connection lost');
  });
});

describe('UsersService.findMany filters', () => {
  it('searches name and email case-insensitively', async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany = jest.fn().mockResolvedValue([]);

    await service.findMany(undefined, { q: 'ada' });

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { email: { contains: 'ada', mode: 'insensitive' } },
      { firstName: { contains: 'ada', mode: 'insensitive' } },
      { lastName: { contains: 'ada', mode: 'insensitive' } },
    ]);
  });

  it('combines the role and status filters', async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany = jest.fn().mockResolvedValue([]);

    await service.findMany(RoleName.INSTRUCTOR, { status: UserStatus.SUSPENDED });

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(UserStatus.SUSPENDED);
    expect(where.roles).toEqual({ some: { role: { name: RoleName.INSTRUCTOR } } });
  });

  it('leaves the query unfiltered when nothing is passed', async () => {
    const { service, prisma } = makeService();
    prisma.user.findMany = jest.fn().mockResolvedValue([]);

    await service.findMany();

    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({});
  });
});
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