import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { InstructorAuditQuery, InstructorListQuery, InstructorsService } from './instructors.service';

@ApiBearerAuth()
@ApiTags('Instructors')
@Controller('instructors')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
@Permissions('users.read')
export class InstructorsController {
  constructor(private readonly instructors: InstructorsService) {}

  @Get()
  list(@Query() query: InstructorListQuery) {
    return this.instructors.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.instructors.detail(id);
  }

  @Get(':id/audit-logs')
  auditLogs(@Param('id') id: string, @Query() query: InstructorAuditQuery) {
    return this.instructors.auditLogs(id, query);
  }

  @Get(':id/sessions')
  sessions(@Param('id') id: string) {
    return this.instructors.sessions(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: AuthenticatedUser) {
    return this.instructors.updateStatus(user.sub, id, status);
  }
}
