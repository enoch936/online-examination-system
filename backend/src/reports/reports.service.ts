import { Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async examAnalytics(examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, include: { course: true } });
    if (!exam) throw new NotFoundException('Exam not found');

    const [sessions, submissionAgg, resultsRaw] = await Promise.all([
      this.prisma.examSession.findMany({ where: { examId }, include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } } }),
      this.prisma.submission.aggregate({ where: { session: { examId } }, _count: true }),
      this.prisma.result.findMany({
        where: { examId },
        include: { submission: { include: { session: { include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } } } } } },
        orderBy: { percentage: 'desc' },
      }),
    ]);

    const results = resultsRaw as any[];
    const scores = results.map((r) => Number(r.score));
    const percentages = results.map((r) => Number(r.percentage));
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    return {
      exam: { id: exam.id, title: exam.title, totalMarks: exam.totalMarks, passingMarks: exam.passingMarks },
      summary: {
        totalSessions: sessions.length,
        totalSubmissions: submissionAgg._count,
        totalResults: total,
        averageScore: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0,
        averagePercentage: percentages.length ? Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(2)) : 0,
        passRate: total ? Number((passed / total).toFixed(4)) : 0,
        highestScore: scores.length ? Math.max(...scores) : 0,
        lowestScore: scores.length ? Math.min(...scores) : 0,
      },
      results: results.map((r: any) => {
        const stu = r.submission?.session?.student;
        return {
          id: r.id,
          student: stu ? { id: stu.id, firstName: stu.firstName, lastName: stu.lastName, email: stu.email } : null,
          score: Number(r.score),
          percentage: Number(r.percentage),
          grade: r.grade,
          passed: r.passed,
          publishedAt: r.publishedAt,
        };
      }),
      sessions: sessions.map((s) => ({
        student: s.student ? { firstName: s.student.firstName, lastName: s.student.lastName } : null,
        status: s.status,
        startedAt: s.startedAt,
      })),
    };
  }

  async studentReport(studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const results = await this.prisma.result.findMany({
      where: { studentId },
      include: { exam: { include: { course: { include: { subject: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const subjectMap = new Map<string, { name: string; exams: number; totalScore: number; maxScore: number; passed: number }>();
    for (const r of results) {
      const subjectName = r.exam.course?.subject?.name ?? 'Unknown';
      const entry = subjectMap.get(subjectName) ?? { name: subjectName, exams: 0, totalScore: 0, maxScore: 0, passed: 0 };
      entry.exams++;
      entry.totalScore += Number(r.score);
      entry.maxScore += Number(r.maxScore);
      if (r.passed) entry.passed++;
      subjectMap.set(subjectName, entry);
    }

    const passed = results.filter((r) => r.passed).length;
    const totalScore = results.reduce((s, r) => s + Number(r.score), 0);
    const maxScore = results.reduce((s, r) => s + Number(r.maxScore), 0);

    return {
      student,
      summary: {
        totalExams: results.length,
        passedExams: passed,
        failedExams: results.length - passed,
        passRate: results.length ? Number((passed / results.length).toFixed(4)) : 0,
        totalScore,
        maxScore,
        averagePercentage: maxScore ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0,
      },
      subjects: Array.from(subjectMap.values()),
      results: results.map((r) => ({
        id: r.id,
        examTitle: r.exam.title,
        subject: r.exam.course?.subject?.name ?? 'Unknown',
        score: Number(r.score),
        maxScore: Number(r.maxScore),
        percentage: Number(r.percentage),
        grade: r.grade,
        passed: r.passed,
        publishedAt: r.publishedAt,
      })),
    };
  }

  async subjectReport(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');

    const exams = await this.prisma.exam.findMany({
      where: { course: { subjectId } },
      include: { results: true, course: true },
    }) as any[];

    const examRows = exams.map((exam: any) => {
      const scores: number[] = exam.results.map((r: any) => Number(r.score));
      const percentages: number[] = exam.results.map((r: any) => Number(r.percentage));
      const passed = exam.results.filter((r: any) => r.passed).length;
      return {
        examId: exam.id,
        examTitle: exam.title,
        courseName: exam.course?.name ?? 'Unknown',
        totalStudents: exam.results.length,
        passed,
        failed: exam.results.length - passed,
        passRate: exam.results.length ? Number((passed / exam.results.length).toFixed(4)) : 0,
        averageScore: scores.length ? Number((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(2)) : 0,
        averagePercentage: percentages.length ? Number((percentages.reduce((a: number, b: number) => a + b, 0) / percentages.length).toFixed(2)) : 0,
      };
    });

    const totalResults = exams.reduce((s: number, e: any) => s + e.results.length, 0);
    const totalPassed = exams.reduce((s: number, e: any) => s + e.results.filter((r: any) => r.passed).length, 0);

    return {
      subject: { id: subject.id, name: subject.name },
      summary: {
        totalExams: exams.length,
        totalResults,
        totalPassed,
        passRate: totalResults ? Number((totalPassed / totalResults).toFixed(4)) : 0,
      },
      exams: examRows,
    };
  }

  async overview() {
    const all: any[] = await Promise.all([
      this.prisma.exam.count(),
      this.prisma.user.count({ where: { roles: { some: { role: { name: 'STUDENT' } } } } }),
      this.prisma.user.count({ where: { roles: { some: { role: { name: 'INSTRUCTOR' } } } } }),
      this.prisma.submission.count(),
      this.prisma.result.aggregate({ _avg: { percentage: true }, _count: true }),
      this.prisma.result.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { exam: true, submission: { include: { session: { include: { student: true } } } } },
      }),
      this.prisma.subject.findMany({
        include: {
          courses: {
            include: {
              exams: {
                include: { results: true },
              },
            },
          },
        },
      }),
    ]);

    const totalExams = all[0] as number;
    const totalStudents = all[1] as number;
    const totalInstructors = all[2] as number;
    const totalSubmissions = all[3] as number;
    const resultAgg = all[4] as any;
    const recentList = all[5] as any[];
    const subjectPerf = all[6] as any[];

    const subjectStats = subjectPerf.map((subj: any) => {
      const results = subj.courses.flatMap((c: any) => c.exams.flatMap((e: any) => e.results));
      const passed = results.filter((r: any) => r.passed).length;
      const percentages = results.map((r: any) => Number(r.percentage));
      return {
        subject: subj.name,
        totalExams: subj.courses.reduce((s: number, c: any) => s + c.exams.length, 0),
        totalResults: results.length,
        passRate: results.length ? Number((passed / results.length).toFixed(4)) : 0,
        averagePercentage: percentages.length ? Number((percentages.reduce((a: number, b: number) => a + b, 0) / percentages.length).toFixed(2)) : 0,
      };
    });

    return {
      summary: {
        totalExams,
        totalStudents,
        totalInstructors,
        totalSubmissions,
        averagePercentage: resultAgg._avg.percentage ? Number(Number(resultAgg._avg.percentage).toFixed(2)) : 0,
        totalResults: resultAgg._count,
      },
      subjectPerformance: subjectStats,
      recentResults: recentList.map((r: any) => ({
        id: r.id,
        examTitle: r.exam.title,
        studentName: r.submission?.session?.student ? `${r.submission.session.student.firstName} ${r.submission.session.student.lastName}` : 'Unknown',
        score: Number(r.score),
        maxScore: Number(r.maxScore),
        percentage: Number(r.percentage),
        passed: r.passed,
        createdAt: r.createdAt,
      })),
    };
  }

  // --- PDF builders ---

  async buildExamPdf(examId: string): Promise<Buffer> {
    const analytics = await this.examAnalytics(examId);
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(18).text('Online Examination System', { align: 'center' });
    doc.fontSize(14).text('Exam Report', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text(`Exam: ${analytics.exam.title}`);
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Total sessions: ${analytics.summary.totalSessions}`);
    doc.text(`Total submissions: ${analytics.summary.totalSubmissions}`);
    doc.text(`Average score: ${analytics.summary.averageScore} / ${analytics.exam.totalMarks}`);
    doc.text(`Average percentage: ${analytics.summary.averagePercentage}%`);
    doc.text(`Pass rate: ${(analytics.summary.passRate * 100).toFixed(1)}%`);
    doc.text(`Highest score: ${analytics.summary.highestScore}`);
    doc.text(`Lowest score: ${analytics.summary.lowestScore}`);
    doc.moveDown(2);

    doc.fontSize(12).text('Student results:', { underline: true });
    doc.moveDown(0.5);
    for (const r of analytics.results) {
      const name = r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Unknown';
      doc.fontSize(10).text(`${name} — ${r.score}/${analytics.exam.totalMarks} (${r.percentage}%) — ${r.passed ? 'Pass' : 'Fail'}`);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async buildStudentPdf(studentId: string): Promise<Buffer> {
    const report = await this.studentReport(studentId);
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(18).text('Online Examination System', { align: 'center' });
    doc.fontSize(14).text('Student Performance Report', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text(`${report.student.firstName} ${report.student.lastName}`);
    doc.fontSize(11);
    doc.text(`Email: ${report.student.email}`);
    doc.moveDown();
    doc.text(`Exams taken: ${report.summary.totalExams}`);
    doc.text(`Passed: ${report.summary.passedExams} / Failed: ${report.summary.failedExams}`);
    doc.text(`Pass rate: ${(report.summary.passRate * 100).toFixed(1)}%`);
    doc.text(`Total score: ${report.summary.totalScore} / ${report.summary.maxScore}`);
    doc.text(`Average percentage: ${report.summary.averagePercentage}%`);
    doc.moveDown(2);

    doc.fontSize(12).text('Subject breakdown:', { underline: true });
    doc.moveDown(0.5);
    for (const sub of report.subjects) {
      doc.fontSize(10).text(`${sub.name} — ${sub.passed}/${sub.exams} passed, avg ${sub.exams ? Number((sub.totalScore / sub.maxScore * 100).toFixed(1)) : 0}%`);
    }
    doc.moveDown(2);

    doc.fontSize(12).text('Exam history:', { underline: true });
    doc.moveDown(0.5);
    for (const r of report.results) {
      doc.fontSize(10).text(`${r.examTitle} (${r.subject}) — ${r.score}/${r.maxScore} (${r.percentage}%) — ${r.passed ? 'Pass' : 'Fail'}`);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async buildSubjectPdf(subjectId: string): Promise<Buffer> {
    const report = await this.subjectReport(subjectId);
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(18).text('Online Examination System', { align: 'center' });
    doc.fontSize(14).text('Subject Report', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text(`Subject: ${report.subject.name}`);
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Total exams: ${report.summary.totalExams}`);
    doc.text(`Total results: ${report.summary.totalResults}`);
    doc.text(`Pass rate: ${(report.summary.passRate * 100).toFixed(1)}%`);
    doc.moveDown(2);

    doc.fontSize(12).text('Exam breakdown:', { underline: true });
    doc.moveDown(0.5);
    for (const e of report.exams) {
      doc.fontSize(10).text(`${e.examTitle} (${e.courseName}) — ${e.passed}/${e.totalStudents} passed, avg ${e.averagePercentage}%`);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async buildOverviewPdf(): Promise<Buffer> {
    const report = await this.overview();
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(18).text('Online Examination System', { align: 'center' });
    doc.fontSize(14).text('Overall Statistics', { align: 'center' });
    doc.moveDown(2);

    doc.fontSize(14).text('Platform overview', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Total exams: ${report.summary.totalExams}`);
    doc.text(`Total students: ${report.summary.totalStudents}`);
    doc.text(`Total instructors: ${report.summary.totalInstructors}`);
    doc.text(`Total submissions: ${report.summary.totalSubmissions}`);
    doc.text(`Average percentage across all results: ${report.summary.averagePercentage}%`);
    doc.moveDown(2);

    doc.fontSize(12).text('Subject performance:', { underline: true });
    doc.moveDown(0.5);
    for (const s of report.subjectPerformance) {
      doc.fontSize(10).text(`${s.subject} — ${s.totalResults} results, ${(s.passRate * 100).toFixed(1)}% pass rate, avg ${s.averagePercentage}%`);
    }
    doc.moveDown(2);

    doc.fontSize(12).text('Recent results:', { underline: true });
    doc.moveDown(0.5);
    for (const r of report.recentResults.slice(0, 10)) {
      doc.fontSize(10).text(`${r.studentName} — ${r.examTitle} — ${r.score}/${r.maxScore} (${r.percentage}%) — ${r.passed ? 'Pass' : 'Fail'}`);
    }

    doc.end();
    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // --- Excel builders ---

  async buildExamWorkbook(examId: string): Promise<Buffer> {
    const analytics = await this.examAnalytics(examId);
    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    let sheet = workbook.addWorksheet('Summary');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 28 },
      { header: 'Value', key: 'value', width: 32 },
    ];
    sheet.addRows([
      { metric: 'Exam', value: analytics.exam.title },
      { metric: 'Total sessions', value: analytics.summary.totalSessions },
      { metric: 'Total submissions', value: analytics.summary.totalSubmissions },
      { metric: 'Average score', value: analytics.summary.averageScore },
      { metric: 'Average percentage', value: `${analytics.summary.averagePercentage}%` },
      { metric: 'Pass rate', value: `${(analytics.summary.passRate * 100).toFixed(1)}%` },
      { metric: 'Highest score', value: analytics.summary.highestScore },
      { metric: 'Lowest score', value: analytics.summary.lowestScore },
    ]);

    // Students sheet
    sheet = workbook.addWorksheet('Students');
    sheet.columns = [
      { header: 'Student', key: 'student', width: 28 },
      { header: 'Score', key: 'score', width: 12 },
      { header: 'Percentage', key: 'percentage', width: 14 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Result', key: 'result', width: 10 },
    ];
    for (const r of analytics.results) {
      const name = r.student ? `${r.student.firstName} ${r.student.lastName}` : 'Unknown';
      sheet.addRow({ student: name, score: `${r.score}/${analytics.exam.totalMarks}`, percentage: `${r.percentage}%`, grade: r.grade ?? '—', result: r.passed ? 'Pass' : 'Fail' });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async buildStudentWorkbook(studentId: string): Promise<Buffer> {
    const report = await this.studentReport(studentId);
    const workbook = new ExcelJS.Workbook();

    let sheet = workbook.addWorksheet('Summary');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 28 },
      { header: 'Value', key: 'value', width: 32 },
    ];
    sheet.addRows([
      { metric: 'Student', value: `${report.student.firstName} ${report.student.lastName}` },
      { metric: 'Exams taken', value: report.summary.totalExams },
      { metric: 'Passed', value: report.summary.passedExams },
      { metric: 'Failed', value: report.summary.failedExams },
      { metric: 'Pass rate', value: `${(report.summary.passRate * 100).toFixed(1)}%` },
      { metric: 'Total score', value: `${report.summary.totalScore} / ${report.summary.maxScore}` },
      { metric: 'Average percentage', value: `${report.summary.averagePercentage}%` },
    ]);

    sheet = workbook.addWorksheet('Subject breakdown');
    sheet.columns = [
      { header: 'Subject', key: 'subject', width: 24 },
      { header: 'Exams', key: 'exams', width: 10 },
      { header: 'Passed', key: 'passed', width: 10 },
      { header: 'Pass rate', key: 'passRate', width: 14 },
    ];
    for (const sub of report.subjects) {
      sheet.addRow({ subject: sub.name, exams: sub.exams, passed: sub.passed, passRate: sub.exams ? `${(sub.passed / sub.exams * 100).toFixed(1)}%` : '—' });
    }

    sheet = workbook.addWorksheet('Exam history');
    sheet.columns = [
      { header: 'Exam', key: 'exam', width: 32 },
      { header: 'Subject', key: 'subject', width: 20 },
      { header: 'Score', key: 'score', width: 12 },
      { header: 'Percentage', key: 'percentage', width: 14 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Result', key: 'result', width: 10 },
    ];
    for (const r of report.results) {
      sheet.addRow({ exam: r.examTitle, subject: r.subject, score: `${r.score}/${r.maxScore}`, percentage: `${r.percentage}%`, grade: r.grade ?? '—', result: r.passed ? 'Pass' : 'Fail' });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async buildSubjectWorkbook(subjectId: string): Promise<Buffer> {
    const report = await this.subjectReport(subjectId);
    const workbook = new ExcelJS.Workbook();

    let sheet = workbook.addWorksheet('Summary');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 28 },
      { header: 'Value', key: 'value', width: 32 },
    ];
    sheet.addRows([
      { metric: 'Subject', value: report.subject.name },
      { metric: 'Total exams', value: report.summary.totalExams },
      { metric: 'Total results', value: report.summary.totalResults },
      { metric: 'Pass rate', value: `${(report.summary.passRate * 100).toFixed(1)}%` },
    ]);

    sheet = workbook.addWorksheet('Exams');
    sheet.columns = [
      { header: 'Exam', key: 'exam', width: 32 },
      { header: 'Course', key: 'course', width: 20 },
      { header: 'Students', key: 'students', width: 12 },
      { header: 'Passed', key: 'passed', width: 10 },
      { header: 'Pass rate', key: 'passRate', width: 14 },
      { header: 'Avg %', key: 'avg', width: 10 },
    ];
    for (const e of report.exams) {
      sheet.addRow({ exam: e.examTitle, course: e.courseName, students: e.totalStudents, passed: e.passed, passRate: `${(e.passRate * 100).toFixed(1)}%`, avg: `${e.averagePercentage}%` });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async buildOverviewWorkbook(): Promise<Buffer> {
    const report = await this.overview();
    const workbook = new ExcelJS.Workbook();

    let sheet = workbook.addWorksheet('Overview');
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 28 },
      { header: 'Value', key: 'value', width: 32 },
    ];
    sheet.addRows([
      { metric: 'Total exams', value: report.summary.totalExams },
      { metric: 'Total students', value: report.summary.totalStudents },
      { metric: 'Total instructors', value: report.summary.totalInstructors },
      { metric: 'Total submissions', value: report.summary.totalSubmissions },
      { metric: 'Average percentage', value: `${report.summary.averagePercentage}%` },
      { metric: 'Total results', value: report.summary.totalResults },
    ]);

    sheet = workbook.addWorksheet('Subject performance');
    sheet.columns = [
      { header: 'Subject', key: 'subject', width: 24 },
      { header: 'Exams', key: 'exams', width: 10 },
      { header: 'Results', key: 'results', width: 12 },
      { header: 'Pass rate', key: 'passRate', width: 14 },
      { header: 'Avg %', key: 'avg', width: 10 },
    ];
    for (const s of report.subjectPerformance) {
      sheet.addRow({ subject: s.subject, exams: s.totalExams, results: s.totalResults, passRate: `${(s.passRate * 100).toFixed(1)}%`, avg: `${s.averagePercentage}%` });
    }

    sheet = workbook.addWorksheet('Recent results');
    sheet.columns = [
      { header: 'Student', key: 'student', width: 24 },
      { header: 'Exam', key: 'exam', width: 32 },
      { header: 'Score', key: 'score', width: 12 },
      { header: 'Percentage', key: 'percentage', width: 14 },
      { header: 'Result', key: 'result', width: 10 },
    ];
    for (const r of report.recentResults) {
      sheet.addRow({ student: r.studentName, exam: r.examTitle, score: `${r.score}/${r.maxScore}`, percentage: `${r.percentage}%`, result: r.passed ? 'Pass' : 'Fail' });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
