import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { MessageSource, MessagesService } from './messages.service';

@ApiBearerAuth()
@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  findMany(
    @Query('examId') examId?: string,
    @Query('source') source?: MessageSource,
  ) {
    return this.messages.findMany({ examId, source });
  }

  @Patch(':id/status')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { source?: MessageSource; status?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.messages.updateStatus(id, body.source === 'EXAM_REPORT' ? 'EXAM_REPORT' : 'CONTACT', body.status ?? 'READ', user.sub);
  }
}
