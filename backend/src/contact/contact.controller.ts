import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { ContactService } from './contact.service';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @Post()
  create(@Body() dto: CreateContactMessageDto) {
    return this.contact.create(dto);
  }

  @Get()
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  findMany(@Query('status') status?: string) {
    return this.contact.findMany(status);
  }

  @Get(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  findOne(@Param('id') id: string) {
    return this.contact.findOne(id);
  }

  @Patch(':id/status')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.contact.updateStatus(id, body.status);
  }
}
