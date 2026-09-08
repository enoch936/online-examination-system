import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ReportsService } from './reports.service';

@ApiBearerAuth()
@ApiTags('Reports')
@Controller('reports')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
@Permissions('reports.read')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly access: ExamAccessService,
  ) {}

  @Get('exams/:examId')
  async examAnalytics(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.access.assertCanMonitor(examId, user);
    return this.reports.examAnalytics(examId);
  }

  @Get('exams/:examId/pdf')
  async examPdf(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    await this.access.assertCanMonitor(examId, user);
    const pdf = await this.reports.buildExamPdf(examId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="exam-${examId}.pdf"`);
    response.send(pdf);
  }

  @Get('exams/:examId/excel')
  async examExcel(@Param('examId') examId: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    await this.access.assertCanMonitor(examId, user);
    const workbook = await this.reports.buildExamWorkbook(examId);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="exam-${examId}.xlsx"`);
    response.send(workbook);
  }

  @Get('students/:studentId')
  async studentReport(@Param('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.reports.assertCanAccessStudent(studentId, user);
    return this.reports.studentReport(studentId);
  }

  @Get('students/:studentId/pdf')
  async studentPdf(@Param('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    await this.reports.assertCanAccessStudent(studentId, user);
    const pdf = await this.reports.buildStudentPdf(studentId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="student-${studentId}.pdf"`);
    response.send(pdf);
  }

  @Get('students/:studentId/excel')
  async studentExcel(@Param('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    await this.reports.assertCanAccessStudent(studentId, user);
    const workbook = await this.reports.buildStudentWorkbook(studentId);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="student-${studentId}.xlsx"`);
    response.send(workbook);
  }

  @Get('subjects/:subjectId')
  async subjectReport(@Param('subjectId') subjectId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.reports.assertCanAccessSubject(subjectId, user);
    return this.reports.subjectReport(subjectId);
  }

  @Get('subjects/:subjectId/pdf')
  async subjectPdf(@Param('subjectId') subjectId: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    await this.reports.assertCanAccessSubject(subjectId, user);
    const pdf = await this.reports.buildSubjectPdf(subjectId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="subject-${subjectId}.pdf"`);
    response.send(pdf);
  }

  @Get('subjects/:subjectId/excel')
  async subjectExcel(@Param('subjectId') subjectId: string, @CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    await this.reports.assertCanAccessSubject(subjectId, user);
    const workbook = await this.reports.buildSubjectWorkbook(subjectId);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="subject-${subjectId}.xlsx"`);
    response.send(workbook);
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.overview(user);
  }

  @Get('overview/pdf')
  async overviewPdf(@CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    const pdf = await this.reports.buildOverviewPdf(user);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="overview.pdf"');
    response.send(pdf);
  }

  @Get('overview/excel')
  async overviewExcel(@CurrentUser() user: AuthenticatedUser, @Res() response: Response) {
    const workbook = await this.reports.buildOverviewWorkbook(user);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="overview.xlsx"');
    response.send(workbook);
  }
}