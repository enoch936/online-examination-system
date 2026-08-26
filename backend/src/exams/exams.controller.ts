import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ExamPermissionLevel, RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamsService } from './exams.service';
import { SubmissionsService } from '../submissions/submissions.service';

@ApiBearerAuth()
@ApiTags('Exams')
@Controller('exams')
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly submissions: SubmissionsService,
    private readonly access: ExamAccessService,
  ) {}

  @Get()
  findMany(@CurrentUser() user: AuthenticatedUser) {
    return this.exams.findMany(user);
  }

  @Get('instructors')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  getInstructors() {
    return this.exams.getInstructors();
  }

  @Get('available')
  @Roles(RoleName.STUDENT)
  findAvailable(@CurrentUser() user: AuthenticatedUser) {
    return this.exams.findAvailable(user.sub);
  }

  @Get('question-pool')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  getQuestionPool(
    @Query('courseIds') courseIds?: string,
    @Query('courseId') courseId?: string,
  ) {
    const ids = courseIds
      ? courseIds.split(',').map((s) => s.trim()).filter(Boolean)
      : courseId
        ? [courseId]
        : [];
    return this.exams.getQuestionPool(ids);
  }

  // Staff-only: the detail payload includes option.isCorrect flags, which must
  // never be exposed to student accounts. Students consume sanitized session
  // payloads from /exam-sessions instead.
  @Get(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitor(id, user);
    return this.exams.findOne(id);
  }

  @Get(':id/access')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async accessInfo(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.getShares(id);
  }

  @Post(':id/share')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async share(
    @Param('id') id: string,
    @Body() body: { instructorIds: string[]; permissionLevel?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanManage(id, user);
    return this.exams.share(
      id,
      body.instructorIds ?? [],
      (body.permissionLevel as ExamPermissionLevel) ?? ExamPermissionLevel.VIEWER,
      user,
    );
  }

  @Patch(':id/share/:instructorId')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async updateShareLevel(
    @Param('id') id: string,
    @Param('instructorId') instructorId: string,
    @Body() body: { permissionLevel: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanManage(id, user);
    return this.exams.updateShareLevel(id, instructorId, body.permissionLevel as ExamPermissionLevel, user);
  }

  @Delete(':id/share/:instructorId')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async unshare(@Param('id') id: string, @Param('instructorId') instructorId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.unshare(id, instructorId, user);
  }

  @Post(':id/transfer')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async transferOwnership(
    @Param('id') id: string,
    @Body() body: { toInstructorId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.access.assertCanManage(id, user);
    return this.exams.transferOwnership(id, body.toInstructorId, user);
  }

  @Get(':id/audit-logs')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async auditLogs(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitor(id, user);
    return this.exams.getAuditLogs(id);
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
  async update(@Param('id') id: string, @Body() dto: UpdateExamDto, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.remove(id);
  }

  @Patch(':id/publish')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.publish(id);
  }

  @Patch(':id/start')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.start(id);
  }

  @Patch(':id/restart')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async restart(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.restart(id);
  }

  @Patch(':id/end')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async endExam(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.submissions.forceEndExam(id, user.sub);
  }

  @Post(':id/assign')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async assignStudents(@Param('id') id: string, @Body() body: { studentIds: string[] }, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.assignStudents(id, body.studentIds);
  }

  @Delete(':id/assign/:studentId')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async unassignStudent(@Param('id') id: string, @Param('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.unassignStudent(id, studentId);
  }

  @Get(':id/assignments')
  @Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
  @Permissions('exams.manage')
  async getAssignedStudents(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanManage(id, user);
    return this.exams.getAssignedStudents(id);
  }
}
