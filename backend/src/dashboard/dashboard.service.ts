import { Injectable } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(user: AuthenticatedUser) {
    const roles = user.roles;
    const isStudent = roles.includes(RoleName.STUDENT) && !roles.includes(RoleName.INSTRUCTOR) && !roles.includes(RoleName.ADMIN) && !roles.includes(RoleName.SUPER_ADMIN);
    const isInstructor = roles.includes(RoleName.INSTRUCTOR) || roles.includes(RoleName.ADMIN) || roles.includes(RoleName.SUPER_ADMIN);

    let totalUsers = 0;
    let activeSessions = 0;
    let publishedExams = 0;
    let totalSubmissions = 0;
    let pendingGradings = 0;
    let myExams = 0;
    let myResults = 0;
    let myAvgScore = 0;

    if (isStudent) {
      myExams = await this.prisma.exam.count({
        where: { status: 'PUBLISHED', endsAt: { gte: new Date() } },
      });
      myResults = await this.prisma.result.count({ where: { studentId: user.sub } });
      const avg = await this.prisma.result.aggregate({
        where: { studentId: user.sub },
        _avg: { percentage: true },
      });
      myAvgScore = Math.round(Number(avg._avg.percentage ?? 0));
    }

    if (isInstructor) {
      const [
        u, s, e, sub, pg, rs,
      ] = await Promise.all([
        this.prisma.user.count({ where: { status: 'ACTIVE' } }),
        this.prisma.examSession.count({ where: { status: 'IN_PROGRESS' } }),
        this.prisma.exam.count({ where: { status: 'PUBLISHED' } }),
        this.prisma.submission.count(),
        this.prisma.submission.count({ where: { status: 'NEEDS_MANUAL_GRADING' } }),
        this.prisma.examSession.count({
          where: { exam: { createdById: user.sub }, status: { in: ['IN_PROGRESS', 'SUBMITTED'] } },
        }),
      ]);
      totalUsers = u;
      activeSessions = s;
      publishedExams = e;
      totalSubmissions = sub;
      pendingGradings = pg;
      myExams = rs;
    }

    const recentSubmissions = await this.prisma.submission.findMany({
      orderBy: { submittedAt: 'desc' },
      take: 7,
      select: { submittedAt: true },
    });

    const violations24h = await this.prisma.examViolation.count({
      where: { occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });

    const chartData = this.buildChartData(recentSubmissions);

    if (isStudent) {
      return {
        metrics: [
          { label: 'Available exams', value: myExams.toLocaleString(), key: 'publishedExams' },
          { label: 'My results', value: myResults.toLocaleString(), key: 'activeCandidates' },
          { label: 'Average score', value: `${myAvgScore}%`, key: 'pendingGrading', tone: myAvgScore < 50 ? 'warning' : 'success' },
        ],
        chartData,
        violations24h,
      };
    }

    return {
      metrics: [
        { label: 'Active candidates', value: totalUsers.toLocaleString(), key: 'activeCandidates' },
        { label: 'Published exams', value: publishedExams.toLocaleString(), key: 'publishedExams' },
        { label: 'Live sessions', value: activeSessions.toLocaleString(), key: 'liveSessions' },
        { label: 'Pending grading', value: pendingGradings.toLocaleString(), key: 'pendingGrading', tone: pendingGradings > 0 ? 'warning' : 'default' },
      ],
      chartData,
      violations24h,
    };
  }

  private buildChartData(submissions: Array<{ submittedAt: Date }>) {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayCount = new Map<string, number>();
    for (const label of dayLabels) {
      dayCount.set(label, 0);
    }
    for (const s of submissions) {
      const dayIndex = s.submittedAt.getDay();
      const label = dayLabels[dayIndex === 0 ? 6 : dayIndex - 1];
      dayCount.set(label, (dayCount.get(label) ?? 0) + 1);
    }
    return dayLabels.map((day) => ({
      day,
      submissions: dayCount.get(day) ?? 0,
    }));
  }
}
