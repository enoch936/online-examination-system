import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('Users')
@Controller('users')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('users.read')
  findMany(@Query('role') role?: RoleName) {
    return this.users.findMany(role);
  }

  @Post()
  @Permissions('users.write')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.create(dto, user);
  }

  @Get(':id')
  @Permissions('users.read')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @Permissions('users.write')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.update(id, dto, user);
  }

  @Patch(':id/roles')
  @Permissions('roles.manage')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.users.assignRole(id, dto.role, user);
  }

  @Delete(':id/roles/:roleName')
  @Permissions('roles.manage')
  removeRole(@Param('id') id: string, @Param('roleName') roleName: RoleName, @CurrentUser() user: AuthenticatedUser) {
    return this.users.removeRole(id, roleName, user);
  }
}
