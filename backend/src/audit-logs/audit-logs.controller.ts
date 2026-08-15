import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogsService } from './audit-logs.service';

@ApiBearerAuth()
@ApiTags('Audit Logs')
@Controller('audit-logs')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @Permissions('audit.read')
  findMany() {
    return this.auditLogs.findMany();
  }
}
