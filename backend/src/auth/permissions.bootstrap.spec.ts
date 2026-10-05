import { Test } from '@nestjs/testing';
import { PermissionsBootstrapService } from './permissions.bootstrap';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ROLE_GRANTS, PERMISSIONS } from '../common/constants/permissions';

describe('PermissionsBootstrapService', () => {
  let service: PermissionsBootstrapService;
  let prisma: {
    permission: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    role: { findMany: jest.Mock };
    rolePermission: { findUnique: jest.Mock; create: jest.Mock };
  };

  const roleRows = (Object.keys(DEFAULT_ROLE_GRANTS) as Array<keyof typeof DEFAULT_ROLE_GRANTS>).map((name, i) => ({
    id: `role-${i}`,
    name,
  }));

  beforeEach(async () => {
    prisma = {
      permission: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      role: { findMany: jest.fn().mockResolvedValue(roleRows) },
      rolePermission: { findUnique: jest.fn(), create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsBootstrapService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PermissionsBootstrapService);
  });

  const permissionExists = (keys: string[]) =>
    prisma.permission.findUnique.mockImplementation(({ where }: { where: { key: string } }) =>
      Promise.resolve(keys.includes(where.key) ? { id: `perm-${where.key}` } : null),
    );

  const alreadyGranted = () =>
    prisma.rolePermission.findUnique.mockResolvedValue({ roleId: 'role-0' });

  it('creates every catalogue permission that is missing', async () => {
    permissionExists([]);
    alreadyGranted();

    const result = await service.ensure();

    expect(result.createdPermissions).toBe(PERMISSIONS.length);
    expect(prisma.permission.create).toHaveBeenCalledTimes(PERMISSIONS.length);
  });

  it('refreshes labels instead of duplicating an existing permission', async () => {
    permissionExists(PERMISSIONS.map((p) => p.key));

    const result = await service.ensure();

    expect(result.createdPermissions).toBe(0);
    expect(prisma.permission.create).not.toHaveBeenCalled();
    expect(prisma.permission.update).toHaveBeenCalledTimes(PERMISSIONS.length);
  });

  it('grants the default keys to each role that lacks them', async () => {
    permissionExists(PERMISSIONS.map((p) => p.key));
    prisma.rolePermission.findUnique.mockResolvedValue(null);

    const result = await service.ensure();

    const expected =
      Object.values(DEFAULT_ROLE_GRANTS).reduce((total, keys) => total + keys.length, 0);
    expect(result.createdGrants).toBe(expected);
  });

  it('never revokes a grant an administrator changed', async () => {
    permissionExists(PERMISSIONS.map((p) => p.key));
    alreadyGranted();

    const result = await service.ensure();

    expect(result.createdGrants).toBe(0);
    expect(prisma.rolePermission.create).not.toHaveBeenCalled();
    expect(prisma.rolePermission).not.toHaveProperty('delete');
    expect(prisma.rolePermission).not.toHaveProperty('deleteMany');
  });

  it('skips roles that do not exist yet', async () => {
    permissionExists(PERMISSIONS.map((p) => p.key));
    prisma.role.findMany.mockResolvedValue([]);
    alreadyGranted();

    const result = await service.ensure();

    expect(result.createdGrants).toBe(0);
  });

  it('logs and swallows a database failure so the API still boots', async () => {
    permissionExists([]);
    prisma.permission.findUnique.mockRejectedValue(new Error('connection lost'));
    const log = jest.spyOn((service as never as { logger: { error: jest.Mock } }).logger, 'error').mockImplementation();

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('connection lost'));
  });
});
