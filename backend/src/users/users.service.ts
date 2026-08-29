import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) {
      throw new ConflictException('Email is already registered');
    }

    const role = await this.prisma.role.upsert({
      where: { name: dto.role ?? RoleName.STUDENT },
      update: {},
      create: { name: dto.role ?? RoleName.STUDENT },
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await bcrypt.hash(dto.password, this.config.get<number>('BCRYPT_ROUNDS', 12)),
        status: UserStatus.ACTIVE,
        roles: { create: { roleId: role.id } },
      },
      include: this.userInclude(),
    });

    return this.sanitize(user);
  }

  async findMany(role?: RoleName) {
    const where = role
      ? { roles: { some: { role: { name: role } } } }
      : {};
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: this.userInclude(),
    });
    return users.map((user) => this.sanitize(user));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: this.userInclude() });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      include: this.userInclude(),
    });
    return this.sanitize(user);
  }

  async assignRole(id: string, roleName: RoleName) {
    await this.ensureExists(id);
    const role = await this.prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: id, roleId: role.id } },
      update: {},
      create: { userId: id, roleId: role.id },
    });
    return this.findOne(id);
  }

  async removeRole(id: string, roleName: RoleName) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.roles.length <= 1) {
      throw new BadRequestException('Cannot remove the last role from a user');
    }

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.prisma.userRole.deleteMany({
      where: { userId: id, roleId: role.id },
    });

    return this.findOne(id);
  }

  private async ensureExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private sanitize<T extends { passwordHash: string; roles?: unknown }>(user: T) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private userInclude() {
    return {
      roles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
    } as const;
  }
}
