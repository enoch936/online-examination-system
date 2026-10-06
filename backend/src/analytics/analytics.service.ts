import { Injectable } from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { selectOfficialResults } from '../results/result-calculation.util';

const ADMIN_ROLES: RoleName[] = [RoleName.SUPER_ADMIN, RoleName.ADMIN];

/** Number of days covered by the time-series charts. */
const TREND_DAYS = 14;

type Scope = {
  /** Filter for `Exam`. Admins get everything. */
  examWhere: Prisma.ExamWhereInput;
  /** Filter for `ExamSession`. Empty means "no restriction". */
  sessionWhere: Prisma.ExamSessionWhereInput;
  /** Filter for `Result`. Empty means "no restriction". */
  resultWhere: Prisma.ResultWhereInput;
  /** True when the viewer may see platform-wide numbers. */
  isAdmin: boolean;
  /** True when the viewer is only a student. */
  isStudentOnly: boolean;
};

type DayBucket = {
  date: string;
  submissions: number;
  sessionsStarted: number;
  resultsPublished: number;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.some((role) => ADMIN_ROLES.includes(role));
  }

  private isInstructor(user: AuthenticatedUser): boolean {
    return user.roles.includes(RoleName.INSTRUCTOR) || this.isAdmin(user);
  }

  private isStudentOnly(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes(RoleName.STUDENT) &&
      !user.roles.includes(RoleName.INSTRUCTOR) &&
      !this.isAdmin(user)
    );
  }

  /**
   * Resolves what the viewer is entitled to see once, so every query in this
   * service is built from the same rule. A student only ever gets their own
   * rows; an instructor gets exams they created or that were shared with them;
   * an admin gets the platform.
   */
  private resolveScope(user: AuthenticatedUser): Scope {
    const isAdmin = this.isAdmin(user);
    const isStudentOnly = this.isStudentOnly(user);

    if (isStudentOnly) {
      return {
        isAdmin: false,
        isStudentOnly: true,
        examWhere: {},
        sessionWhere: { studentId: user.sub },
        resultWhere: { studentId: user.sub },
      };
    }

    if (this.isInstructor(user)) {
      const examWhere: Prisma.ExamWhereInput = isAdmin
        ? {}
        : {
            OR: [
              { createdById: user.sub },
              { shares: { some: { instructorId: user.sub } } },
            ],
          };
      return {
        isAdmin,
        isStudentOnly: false,
        examWhere,
        sessionWhere: { exam: examWhere },
        resultWhere: { exam: examWhere },
      };
    }

    return {
      isAdmin: false,
      isStudentOnly: false,
      examWhere: { createdById: '__none__' },
      sessionWhere: { studentId: '__none__' },
      resultWhere: { studentId: '__none__' },
    };
  }

  /** Midnight-anchored day keys, oldest first, so charts have no gaps. */
  private buildDayAxis(days: number, now = new Date()): string[] {
    const axis: string[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      axis.push(d.toISOString().slice(0, 10));
    }
    return axis;
  }

  /**
   * Counts rows per day on the server. `take` is intentionally absent — the
   * dashboard previously fetched the last 7 submissions and bucketed them in
   * JS, which both undercounted and mislabelled busy days.
   */
  private async countByDay(
    where: Prisma.ResultWhereInput,
    dateColumn: 'createdAt' | 'publishedAt',
    axis: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.result.groupBy({
      by: [dateColumn],
      where,
      _count: { _all: true },
    });
    const lookup = new Map<string, string>();
    for (const day of axis) lookup.set(day, day);
    const counts = new Map<string, number>(axis.map((day) => [day, 0]));
    for (const row of rows) {
      const value = row[dateColumn] as Date | null;
      if (!value) continue;
      const key = lookup.get(value.toISOString().slice(0, 10));
      if (key) counts.set(key, (counts.get(key) ?? 0) + row._count._all);
    }
    return counts;
  }

  private async countSessionsByDay(
    where: Prisma.ExamSessionWhereInput,
    axis: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.examSession.groupBy({
      by: ['startedAt'],
      where,
      _count: { _all: true },
    });
    const counts = new Map<string, number>(axis.map((day) => [day, 0]));
    for (const row of rows) {
      if (!row.startedAt) continue;
      const key = row.startedAt.toISOString().slice(0, 10);
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + row._count._all);
    }
    return counts;
  }

  private async countSubmissionsByDay(
    where: Prisma.SubmissionWhereInput,
    axis: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.submission.groupBy({
      by: ['submittedAt'],
      where,
      _count: { _all: true },
    });
    const counts = new Map<string, number>(axis.map((day) => [day, 0]));
    for (const row of rows) {
      const key = row.submittedAt.toISOString().slice(0, 10);
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + row._count._all);
    }
    return counts;
  }

  private tally(values: string[]) {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Fixed score bands so a distribution is comparable across exams and roles. */
  private scoreBands(results: Array<{ percentage: Prisma.Decimal | number }>) {
    const bands = [
      { label: '0-39', min: 0, max: 40, passed: false },
      { label: '40-59', min: 40, max: 60, passed: false },
      { label: '60-74', min: 60, max: 75, passed: false },
      { label: '75-89', min: 75, max: 90, passed: true },
      { label: '90-100', min: 90, max: 101, passed: true },
    ];
    return bands.map((band) => ({
      label: band.label,
      min: band.min,
      max: band.max,
      passed: band.passed,
      count: results.filter((r) => {
        const pct = Number(r.percentage);
        return pct >= band.min && pct < band.max;
      }).length,
    }));
  }

  /**
   * Headline figures plus every series the dashboards render. One endpoint so
   * the charts and the counters can never disagree with each other — they are
   * computed from the same scoped rows.
   */
  async getOverview(user: AuthenticatedUser) {
    const scope = this.resolveScope(user);
    const axis = this.buildDayAxis(TREND_DAYS);
    const since = new Date(axis[0]!.length ? `${axis[0]}T00:00:00.000Z` : Date.now());
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalExams,
      liveExams,
      totalSessions,
      liveSessions,
      results,
      pendingGrading,
      submissions24h,
      violations24h,
      extensions24h,
      examStatusGroups,
      sessionStatusGroups,
      riskGroups,
      violationTypeGroups,
      submissionReasonGroups,
      gradingStatusGroups,
      questionTypeGroups,
      trendResults,
      trendSessions,
      trendSubmissions,
      topExamsRaw,
      atRiskRaw,
      manualAdjustments,
      regrades,
      avgDuration,
      enrollmentByCourse,
    ] = await Promise.all([
      this.prisma.exam.count({ where: scope.examWhere }),
      this.prisma.exam.count({
        where: { ...scope.examWhere, status: { in: ['PUBLISHED', 'LIVE'] } },
      }),
      this.prisma.examSession.count({ where: scope.sessionWhere }),
      this.prisma.examSession.count({
        where: { ...scope.sessionWhere, status: 'IN_PROGRESS' },
      }),
      this.prisma.result.findMany({
        where: scope.resultWhere,
        select: {
          id: true,
          examId: true,
          studentId: true,
          percentage: true,
          passed: true,
          manualAdjusted: true,
          regradeCount: true,
          createdAt: true,
          publishedAt: true,
          submission: {
            select: {
              submittedAt: true,
              session: { select: { attemptNumber: true, startedAt: true } },
            },
          },
        },
      }),
      this.prisma.result.count({
        where: { ...scope.resultWhere, gradingStatus: 'PENDING' },
      }),
      this.prisma.submission.count({
        where: {
          submittedAt: { gte: dayAgo },
          ...(scope.isStudentOnly
            ? { session: { studentId: user.sub } }
            : scope.isAdmin
              ? {}
              : { session: scope.sessionWhere }),
        },
      }),
      this.prisma.examViolation.count({
        where: {
          occurredAt: { gte: dayAgo },
          session: scope.sessionWhere,
        },
      }),
      this.prisma.timeExtension.count({
        where: {
          createdAt: { gte: dayAgo },
          ...(scope.isStudentOnly
            ? { studentId: user.sub }
            : scope.isAdmin
              ? {}
              : { exam: scope.examWhere }),
        },
      }),
      this.prisma.exam.groupBy({
        by: ['status'],
        where: scope.examWhere,
        _count: { _all: true },
      }),
      this.prisma.examSession.groupBy({
        by: ['status'],
        where: scope.sessionWhere,
        _count: { _all: true },
      }),
      this.prisma.examSession.groupBy({
        by: ['riskLevel'],
        where: { ...scope.sessionWhere, status: { in: ['SUBMITTED', 'IN_PROGRESS', 'PAUSED', 'AUTO_SUBMITTED', 'FLAGGED'] } },
        _count: { _all: true },
      }),
      this.prisma.examViolation.groupBy({
        by: ['type'],
        where: { session: scope.sessionWhere },
        _count: { _all: true },
      }),
      this.prisma.submission.groupBy({
        by: ['reason'],
        where: {
          ...(scope.isStudentOnly
            ? { session: { studentId: user.sub } }
            : scope.isAdmin
              ? {}
              : { session: scope.sessionWhere }),
        },
        _count: { _all: true },
      }),
      this.prisma.result.groupBy({
        by: ['gradingStatus'],
        where: scope.resultWhere,
        _count: { _all: true },
      }),
      // `ExamQuestion` has no `type` column — it lives on `Question`, and
      // Prisma cannot group across that join, so the mix is tallied here.
      this.prisma.examQuestion.findMany({
        where: { exam: scope.examWhere },
        select: { question: { select: { type: true } } },
      }),
      this.prisma.result.findMany({
        where: { ...scope.resultWhere, createdAt: { gte: since } },
        select: { createdAt: true, publishedAt: true },
      }),
      this.prisma.examSession.findMany({
        where: { ...scope.sessionWhere, startedAt: { gte: since } },
        select: { startedAt: true },
      }),
      this.prisma.submission.findMany({
        where: {
          submittedAt: { gte: since },
          ...(scope.isStudentOnly
            ? { session: { studentId: user.sub } }
            : scope.isAdmin
              ? {}
              : { session: scope.sessionWhere }),
        },
        select: { submittedAt: true },
      }),
      this.prisma.result.groupBy({
        by: ['examId'],
        where: scope.resultWhere,
        _avg: { percentage: true },
        _count: { _all: true },
      }),
      this.prisma.examSession.findMany({
        where: { ...scope.sessionWhere, riskLevel: { in: ['HIGH', 'CRITICAL'] } },
        orderBy: { riskScore: 'desc' },
        take: 8,
        select: {
          id: true,
          riskScore: true,
          riskLevel: true,
          status: true,
          disconnectCount: true,
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
          exam: { select: { id: true, title: true } },
        },
      }),
this.prisma.result.count({ where: { ...scope.resultWhere, manualAdjusted: true } }),
      this.prisma.result.aggregate({ where: scope.resultWhere, _sum: { regradeCount: true } }),
      this.prisma.result.aggregate({
        where: scope.resultWhere,
        _avg: { percentage: true },
      }),
      this.prisma.classEnrollment.groupBy({
        by: ['classId'],
        _count: { _all: true },
        ...(scope.isStudentOnly
          ? { where: { studentId: user.sub } }
          : {}),
      }),
    ]);

    // Headline pass rate uses only official attempts, so a candidate who retook
    // an exam five times cannot count five times toward the pass rate.
    const official = selectOfficialResults(
      results.map((r) => ({
        id: r.id,
        examId: r.examId,
        studentId: r.studentId,
        percentage: Number(r.percentage),
        submittedAt: r.submission?.submittedAt ?? r.createdAt,
        attemptNumber: r.submission?.session?.attemptNumber ?? 1,
      })),
    );
    const officialIds = new Set(official.map((r) => r.id));
    const officialResults = results.filter((r) => officialIds.has(r.id));
    const totalOfficial = officialResults.length;
    const totalPassed = officialResults.filter((r) => r.passed).length;
    const averagePercentage = Math.round(
      Number(avgDuration._avg.percentage ?? 0),
    );

    const durations = results
      .map((r) => {
        const started = r.submission?.session?.startedAt;
        const done = r.submission?.submittedAt;
        if (!started || !done) return null;
        return (done.getTime() - started.getTime()) / 60000;
      })
      .filter((v): v is number => v !== null && v >= 0);

    const trend: DayBucket[] = axis.map((date) => ({
      date,
      submissions: 0,
      sessionsStarted: 0,
      resultsPublished: 0,
    }));
    const trendIndex = new Map(trend.map((row) => [row.date, row]));
    for (const row of trendSubmissions) {
      const bucket = trendIndex.get(row.submittedAt.toISOString().slice(0, 10));
      if (bucket) bucket.submissions += 1;
    }
    for (const row of trendSessions) {
      if (!row.startedAt) continue;
      const bucket = trendIndex.get(row.startedAt.toISOString().slice(0, 10));
      if (bucket) bucket.sessionsStarted += 1;
    }
    for (const row of trendResults) {
      const bucket = trendIndex.get(row.createdAt.toISOString().slice(0, 10));
      if (bucket) bucket.resultsPublished += 1;
    }

    const examIdsInUse = [
      ...new Set([...topExamsRaw.map((r) => r.examId), ...results.map((r) => r.examId)]),
    ];
    const examTitles = new Map(
      (
        await this.prisma.exam.findMany({
          where: { id: { in: examIdsInUse } },
          select: { id: true, title: true },
        })
      ).map((e) => [e.id, e.title]),
    );

    // Recent results are re-queried rather than reshaped out of `results`,
    // because that projection is deliberately minimal and has no relations.
    const recentResults = await this.prisma.result.findMany({
      where: scope.resultWhere,
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        percentage: true,
        passed: true,
        gradingStatus: true,
        manualAdjusted: true,
        createdAt: true,
        exam: { select: { title: true } },
        submission: {
          select: {
            session: {
              select: {
                student: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    const sortDesc = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
    const pct = (count: number) =>
      totalOfficial ? Math.round((count / totalOfficial) * 1000) / 10 : 0;

    return {
      generatedAt: new Date().toISOString(),
      audience: scope.isStudentOnly
        ? ('STUDENT' as const)
        : scope.isAdmin
          ? ('ADMIN' as const)
          : ('INSTRUCTOR' as const),
      scope: {
        examCount: totalExams,
        sessionCount: totalSessions,
        resultCount: results.length,
        officialResultCount: totalOfficial,
      },
      metrics: {
        totalExams,
        liveExams,
        totalSessions,
        liveSessions,
        totalResults: results.length,
        officialResults: totalOfficial,
        pendingGrading,
        submissions24h,
        submissions7d: await this.prisma.submission.count({
          where: {
            submittedAt: { gte: weekAgo },
            ...(scope.isStudentOnly
              ? { session: { studentId: user.sub } }
              : scope.isAdmin
                ? {}
                : { session: scope.sessionWhere }),
          },
        }),
        violations24h,
        timeExtensions24h: extensions24h,
        passRate: pct(totalPassed),
        passedCount: totalPassed,
        failedCount: totalOfficial - totalPassed,
        averagePercentage,
        manualAdjustments,
        totalRegrades: Number(regrades._sum.regradeCount ?? 0),
        medianDurationMinutes: durations.length
          ? Math.round(
              durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]!,
            )
          : 0,
      },
      charts: {
        trend,
        scoreDistribution: this.scoreBands(officialResults).map((band) => ({
          label: band.label,
          count: band.count,
          share: pct(band.count),
          passed: band.passed,
        })),
        examStatus: examStatusGroups.map((g) => ({
          label: g.status,
          count: g._count._all,
        })),
        sessionStatus: sessionStatusGroups.map((g) => ({
          label: g.status,
          count: g._count._all,
        })),
        gradingStatus: gradingStatusGroups.map((g) => ({
          label: g.gradingStatus,
          count: g._count._all,
        })),
        riskLevels: riskGroups.map((g) => ({
          label: g.riskLevel,
          count: g._count._all,
        })),
        violationTypes: violationTypeGroups.map((g) => ({
          label: g.type,
          count: g._count._all,
        })),
        submissionReasons: submissionReasonGroups.map((g) => ({
          label: g.reason,
          count: g._count._all,
        })),
        questionMix: this.tally(
          questionTypeGroups.map((q) => q.question.type),
        ),
        topExams: topExamsRaw
          .map((g) => ({
            examId: g.examId,
            label: examTitles.get(g.examId) ?? 'Unknown exam',
            attempts: g._count._all,
            averagePercentage: Math.round(Number(g._avg.percentage ?? 0)),
          }))
          .sort((a, b) => b.attempts - a.attempts)
          .slice(0, 8),
        enrollmentByCourse: enrollmentByCourse
          .map((g) => ({ label: g.classId, count: g._count._all }))
          .sort(sortDesc)
          .slice(0, 10),
      },
      tables: {
        atRiskSessions: atRiskRaw.map((s) => ({
          id: s.id,
          student:
            [s.student.firstName, s.student.lastName].filter(Boolean).join(' ') ||
            s.student.email ||
            'Unknown',
          exam: s.exam.title,
          riskLevel: s.riskLevel,
          riskScore: s.riskScore,
          disconnectCount: s.disconnectCount,
          status: s.status,
        })),
        recentResults: recentResults.map((r) => ({
          id: r.id,
          student:
            [r.submission?.session?.student?.firstName, r.submission?.session?.student?.lastName]
              .filter(Boolean)
              .join(' ') || 'Unknown',
          exam: r.exam?.title ?? 'Unknown exam',
          percentage: Math.round(Number(r.percentage)),
          passed: r.passed,
          gradingStatus: r.gradingStatus,
          manualAdjusted: r.manualAdjusted,
          submittedAt: r.createdAt.toISOString(),
        })),
      },
    };
  }

  /**
   * Per-exam comparison for instructors. Restricted to exams the caller can
   * monitor, so this cannot be used to enumerate someone else's exam titles.
   */
  async getExamBreakdown(user: AuthenticatedUser, examIds?: string[]) {
    const scope = this.resolveScope(user);
    if (scope.isStudentOnly) {
      return { exams: [] };
    }
    const exams = await this.prisma.exam.findMany({
      where: {
        ...scope.examWhere,
        ...(examIds?.length ? { id: { in: examIds } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        durationMinutes: true,
        passingMarks: true,
        totalMarks: true,
        _count: { select: { sessions: true, results: true } },
      },
    });

    const rows = await Promise.all(
      exams.map(async (exam) => {
        const [aggregates, pending, live] = await Promise.all([
          this.prisma.result.aggregate({
            where: { examId: exam.id },
            _avg: { percentage: true },
            _count: { _all: true },
          }),
          this.prisma.result.count({
            where: { examId: exam.id, gradingStatus: 'PENDING' },
          }),
          this.prisma.examSession.count({
            where: { examId: exam.id, status: 'IN_PROGRESS' },
          }),
        ]);
        return {
          id: exam.id,
          title: exam.title,
          status: exam.status,
          durationMinutes: exam.durationMinutes,
          totalMarks: Number(exam.totalMarks),
          passingMarks: Number(exam.passingMarks),
          attempts: exam._count.sessions,
          results: aggregates._count._all,
          liveSessions: live,
          pendingGrading: pending,
          averagePercentage: Math.round(Number(aggregates._avg.percentage ?? 0)),
        };
      }),
    );

    return { exams: rows };
  }
}