import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { ListContactMessagesDto } from './dto/list-contact-messages.dto';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto';
import { ContactService } from './contact.service';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  // Public: anyone on the marketing site can send a message.
  @Public()
  @Post()
  create(@Body() dto: CreateContactMessageDto) {
    return this.contact.create(dto);
  }

  @ApiBearerAuth()
  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('contact.read')
  findMany(@Query() query: ListContactMessagesDto) {
    return this.contact.findMany(query);
  }

  @ApiBearerAuth()
  @Get(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('contact.read')
  findOne(@Param('id') id: string) {
    return this.contact.findOne(id);
  }

  // Triage (read/resolved) is a separate scope from reading, so an account
  // can be given an inbox to watch without being able to close tickets.
  @ApiBearerAuth()
  @Patch(':id/status')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('contact.manage')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateContactStatusDto) {
    return this.contact.updateStatus(id, dto.status);
  }
}
