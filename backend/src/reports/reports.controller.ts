import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiBearerAuth()
@ApiTags('Reports')
@Controller('reports')
@Roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR)
@Permissions('reports.read')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('exams/:examId')
  examAnalytics(@Param('examId') examId: string) {
    return this.reports.examAnalytics(examId);
  }

  @Get('exams/:examId/pdf')
  async examPdf(@Param('examId') examId: string, @Res() response: Response) {
    const pdf = await this.reports.buildExamPdf(examId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="exam-${examId}.pdf"`);
    response.send(pdf);
  }

  @Get('exams/:examId/excel')
  async examExcel(@Param('examId') examId: string, @Res() response: Response) {
    const workbook = await this.reports.buildExamWorkbook(examId);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="exam-${examId}.xlsx"`);
    response.send(workbook);
  }

  @Get('students/:studentId')
  studentReport(@Param('studentId') studentId: string) {
    return this.reports.studentReport(studentId);
  }

  @Get('students/:studentId/pdf')
  async studentPdf(@Param('studentId') studentId: string, @Res() response: Response) {
    const pdf = await this.reports.buildStudentPdf(studentId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="student-${studentId}.pdf"`);
    response.send(pdf);
  }

  @Get('students/:studentId/excel')
  async studentExcel(@Param('studentId') studentId: string, @Res() response: Response) {
    const workbook = await this.reports.buildStudentWorkbook(studentId);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="student-${studentId}.xlsx"`);
    response.send(workbook);
  }

  @Get('subjects/:subjectId')
  subjectReport(@Param('subjectId') subjectId: string) {
    return this.reports.subjectReport(subjectId);
  }

  @Get('subjects/:subjectId/pdf')
  async subjectPdf(@Param('subjectId') subjectId: string, @Res() response: Response) {
    const pdf = await this.reports.buildSubjectPdf(subjectId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="subject-${subjectId}.pdf"`);
    response.send(pdf);
  }

  @Get('subjects/:subjectId/excel')
  async subjectExcel(@Param('subjectId') subjectId: string, @Res() response: Response) {
    const workbook = await this.reports.buildSubjectWorkbook(subjectId);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="subject-${subjectId}.xlsx"`);
    response.send(workbook);
  }

  @Get('overview')
  overview() {
    return this.reports.overview();
  }

  @Get('overview/pdf')
  async overviewPdf(@Res() response: Response) {
    const pdf = await this.reports.buildOverviewPdf();
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="overview.pdf"');
    response.send(pdf);
  }

  @Get('overview/excel')
  async overviewExcel(@Res() response: Response) {
    const workbook = await this.reports.buildOverviewWorkbook();
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="overview.xlsx"');
    response.send(workbook);
  }
}
