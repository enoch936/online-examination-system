import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
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
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get(':id')
  @Permissions('users.read')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @Permissions('users.write')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Patch(':id/roles')
  @Permissions('roles.manage')
  assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    return this.users.assignRole(id, dto.role);
  }

  @Delete(':id/roles/:roleName')
  @Permissions('roles.manage')
  removeRole(@Param('id') id: string, @Param('roleName') roleName: RoleName) {
    return this.users.removeRole(id, roleName);
  }
}
