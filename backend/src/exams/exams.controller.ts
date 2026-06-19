import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamsService } from './exams.service';

@ApiBearerAuth()
@ApiTags('Exams')
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get()
  findMany() {
    return this.exams.findMany();
  }

  @Get('available')
  @Roles(RoleName.STUDENT)
  findAvailable(@CurrentUser() user: AuthenticatedUser) {
    return this.exams.findAvailable(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.exams.findOne(id);
  }

  @Post()
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  create(@Body() dto: CreateExamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.exams.create(dto, user.sub);
  }

  @Patch(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  update(@Param('id') id: string, @Body() dto: UpdateExamDto) {
    return this.exams.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  remove(@Param('id') id: string) {
    return this.exams.remove(id);
  }

  @Patch(':id/publish')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  publish(@Param('id') id: string) {
    return this.exams.publish(id);
  }

  @Post(':id/assign')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  assignStudents(@Param('id') id: string, @Body() body: { studentIds: string[] }) {
    return this.exams.assignStudents(id, body.studentIds);
  }

  @Delete(':id/assign/:studentId')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  unassignStudent(@Param('id') id: string, @Param('studentId') studentId: string) {
    return this.exams.unassignStudent(id, studentId);
  }

  @Get(':id/assignments')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  getAssignedStudents(@Param('id') id: string) {
    return this.exams.getAssignedStudents(id);
  }
}
