import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { IsString } from 'class-validator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsService } from './permissions.service';

class UpsertPermissionDto {
  @ApiProperty({ example: 'reports.read' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Read reports' })
  @IsString()
  label: string;

  @ApiProperty({ example: 'reports' })
  @IsString()
  module: string;
}

@ApiBearerAuth()
@ApiTags('Permissions')
@Controller('permissions')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @Permissions('roles.manage')
  findMany() {
    return this.permissions.findMany();
  }

  @Post()
  @Permissions('roles.manage')
  upsert(@Body() dto: UpsertPermissionDto) {
    return this.permissions.upsert(dto.key, dto.label, dto.module);
  }
}
