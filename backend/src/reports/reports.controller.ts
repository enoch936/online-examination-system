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
}
