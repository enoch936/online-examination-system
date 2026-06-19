import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectsService } from './subjects.service';

@ApiBearerAuth()
@ApiTags('Subjects')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  findMany() {
    return this.subjects.findMany();
  }

  @Post()
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)
  @Permissions('subjects.manage')
  create(@Body() dto: CreateSubjectDto) {
    return this.subjects.create(dto);
  }
}
