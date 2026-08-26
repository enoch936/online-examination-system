import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesService } from './roles.service';

class AssignPermissionDto {
  @ApiProperty({ enum: RoleName })
  @IsEnum(RoleName)
  role: RoleName;

  @ApiProperty({ example: 'exams.manage' })
  @IsString()
  permission: string;
}

@ApiBearerAuth()
@ApiTags('Roles')
@Controller('roles')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Permissions('roles.manage')
  findMany() {
    return this.roles.findMany();
  }

  @Post('permissions')
  @Permissions('roles.manage')
  assignPermission(@Body() dto: AssignPermissionDto) {
    return this.roles.assignPermission(dto.role, dto.permission);
  }

  @Delete('permissions')
  @Permissions('roles.manage')
  revokePermission(@Body() dto: AssignPermissionDto) {
    return this.roles.revokePermission(dto.role, dto.permission);
  }
}
