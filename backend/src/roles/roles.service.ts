import { Injectable } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findMany() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async assignPermission(roleName: RoleName, permissionKey: string) {
    const role = await this.prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    const permission = await this.prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  async revokePermission(roleName: RoleName, permissionKey: string) {
    const [role, permission] = await Promise.all([
      this.prisma.role.findUnique({ where: { name: roleName } }),
      this.prisma.permission.findUnique({ where: { key: permissionKey } }),
    ]);
    if (!role || !permission) return { revoked: false };
    const existing = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    });
    if (!existing) return { revoked: false };
    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    });
    return { revoked: true };
  }
}
