import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async examAnalytics(examId: string) {
    const [exam, sessions, submissions, average] = await Promise.all([
      this.prisma.exam.findUnique({ where: { id: examId }, include: { course: true } }),
      this.prisma.examSession.count({ where: { examId } }),
      this.prisma.submission.count({ where: { session: { examId } } }),
      this.prisma.result.aggregate({ where: { examId }, _avg: { percentage: true }, _count: true }),
    ]);

    return {
      exam,
      sessions,
      submissions,
      averagePercentage: average._avg.percentage,
      resultCount: average._count,
    };
  }

  async buildExamPdf(examId: string): Promise<Buffer> {
    const analytics = await this.examAnalytics(examId);
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.fontSize(18).text('Online Examination System - Exam Report');
    doc.moveDown();
    doc.fontSize(12).text(`Exam: ${analytics.exam?.title ?? examId}`);
    doc.text(`Sessions: ${analytics.sessions}`);
    doc.text(`Submissions: ${analytics.submissions}`);
    doc.text(`Average: ${analytics.averagePercentage ?? 0}%`);
    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async buildExamWorkbook(examId: string): Promise<Buffer> {
    const analytics = await this.examAnalytics(examId);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Exam Analytics');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 28 },
      { header: 'Value', key: 'value', width: 32 },
    ];
    sheet.addRows([
      { metric: 'Exam', value: analytics.exam?.title ?? examId },
      { metric: 'Sessions', value: analytics.sessions },
      { metric: 'Submissions', value: analytics.submissions },
      { metric: 'Average Percentage', value: Number(analytics.averagePercentage ?? 0) },
    ]);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
