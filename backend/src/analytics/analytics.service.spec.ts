import { Test } from '@nestjs/testing';
import { RoleName } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import type { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

type User = { sub: string; roles: RoleName[] };

const student: User = { sub: 'student-1', roles: [RoleName.STUDENT] };
const instructor: User = { sub: 'instructor-1', roles: [RoleName.INSTRUCTOR] };
const admin: User = { sub: 'admin-1', roles: [RoleName.ADMIN] };
const superAdmin: User = { sub: 'root-1', roles: [RoleName.SUPER_ADMIN] };

const asUser = (u: User) => ({ sub: u.sub, roles: u.roles }) as AuthenticatedUser;

/**
 * Minimal Prisma double. Every delegate returns empty arrays by default so a
 * test only has to describe the query it actually cares about; the assertions
 * are about *how* a query was scoped, which is the part that used to leak.
 */
function makePrisma(overrides: Record<string, any> = {}) {
  const calls: Record<string, any[][]> = {
    findMany: [],
    findFirst: [],
    count: [],
    groupBy: [],
    aggregate: [],
  };
  // Keeps the full argument list so assertions can destructure call signatures,
  // e.g. `calls.count.filter(([where]) => ...)`.
  const record = (name: string, args: any[]) => {
    calls[name] = calls[name] ?? [];
    calls[name].push(args);
  };

  const empty = {
    findMany: async (...a: any[]) => {
      record('findMany', a);
      return [];
    },
    findFirst: async (...a: any[]) => {
      record('findFirst', a);
      return null;
    },
    count: async (...a: any[]) => {
      record('count', a);
      return 0;
    },
    groupBy: async (...a: any[]) => {
      record('groupBy', a);
      return [];
    },
    aggregate: async (...a: any[]) => {
      record('aggregate', a);
      return { _avg: {}, _count: 0, _sum: {} };
    },
  };

  const prisma: any = {
    exam: { ...empty },
    examSession: { ...empty },
    result: { ...empty },
    submission: { ...empty },
    examViolation: { ...empty },
    timeExtension: { ...empty },
    examQuestion: { ...empty },
    classEnrollment: { ...empty },
  };
  for (const [key, value] of Object.entries(overrides)) {
    prisma[key] = { ...empty, ...value };
  }
  return { prisma: prisma as unknown as PrismaService, calls };
}

describe('AnalyticsService', () => {
  describe('scope resolution', () => {
    it('scopes a student-only viewer to their own rows', async () => {
      const { prisma, calls } = makePrisma();
      const service = new AnalyticsService(prisma);

      const result = await service.getOverview(asUser(student));

      expect(result.audience).toBe('STUDENT');
      // Every query that can reach a session, result, submission or violation
      // must carry the viewer's own id. A student dashboard must never be able
      // to aggregate another candidate's activity.
      const sessionScoped = ['count', 'findMany', 'groupBy'].flatMap((op) =>
        (calls[op] ?? [])
          .map(([arg]: any[]) => JSON.stringify(arg ?? {}))
          .filter((json: string) => json.includes('session') || json.includes('studentId')),
      );
      expect(sessionScoped.length).toBeGreaterThan(0);
      for (const json of sessionScoped) {
        expect(json).toContain('student-1');
      }
    });

    it('restricts an instructor to exams they created or that were shared', async () => {
      const { prisma, calls } = makePrisma();
      const service = new AnalyticsService(prisma);

      await service.getOverview(asUser(instructor));

const examCounts = calls.count.filter(([arg]: any[]) => arg?.where?.OR);
      expect(examCounts.length).toBeGreaterThan(0);
      const json = JSON.stringify(examCounts[0]![0]);
      expect(json).toContain('instructor-1');
      expect(json).toContain('shares');
    });

    it('gives an ADMIN unrestricted access', async () => {
      const { prisma, calls } = makePrisma();
      const service = new AnalyticsService(prisma);

      const result = await service.getOverview(asUser(admin));

      expect(result.audience).toBe('ADMIN');
      // An admin still passes an `exam` relation, but it must be empty — an empty
      // object is Prisma's "no restriction". A populated filter here would mean
      // the admin branch narrowed itself by mistake.
      const restrictive = calls.count.filter(
        ([arg]: any[]) => arg?.where?.exam && Object.keys(arg.where.exam).length > 0,
      );
expect(restrictive).toHaveLength(0);
    });

    it('gives a SUPER_ADMIN unrestricted access', async () => {
      const { prisma, calls } = makePrisma();
      const service = new AnalyticsService(prisma);

      const result = await service.getOverview(asUser(superAdmin));

      expect(result.audience).toBe('ADMIN');
      expect(
      calls.count.filter(
        ([arg]: any[]) => arg?.where?.exam && Object.keys(arg.where.exam).length > 0,
      ),
    ).toHaveLength(0);
    });
  });

  describe('metrics', () => {
    it('counts only official attempts toward the pass rate', async () => {
      const now = new Date();
      const { prisma } = makePrisma({
        result: {
          findMany: async () => [
            // Same student, same exam, three attempts. Only the best is official.
            { id: 'r1', examId: 'e1', studentId: 's1', percentage: 40, passed: false, manualAdjusted: false, regradeCount: 0, createdAt: now, publishedAt: null, submission: { submittedAt: now, session: { attemptNumber: 1, startedAt: null } } },
            { id: 'r2', examId: 'e1', studentId: 's1', percentage: 55, passed: false, manualAdjusted: false, regradeCount: 0, createdAt: now, publishedAt: null, submission: { submittedAt: now, session: { attemptNumber: 2, startedAt: null } } },
            { id: 'r3', examId: 'e1', studentId: 's1', percentage: 90, passed: true, manualAdjusted: false, regradeCount: 0, createdAt: now, publishedAt: null, submission: { submittedAt: now, session: { attemptNumber: 3, startedAt: null } } },
            // A different student on a different exam, so it is its own cohort.
            { id: 'r4', examId: 'e2', studentId: 's2', percentage: 30, passed: false, manualAdjusted: false, regradeCount: 0, createdAt: now, publishedAt: null, submission: { submittedAt: now, session: { attemptNumber: 1, startedAt: null } } },
          ],
          count: async () => 0,
          groupBy: async () => [],
          aggregate: async () => ({ _avg: { percentage: 53.75 }, _sum: { regradeCount: 0 } }),
        },
      });
      const service = new AnalyticsService(prisma);

      const result = await service.getOverview(asUser(student));

      // 4 rows exist, but only 2 are official (one per student+exam pair).
      expect(result.metrics.totalResults).toBe(4);
      expect(result.metrics.officialResults).toBe(2);
      // s1 passes officially, s2 does not => 50%.
      expect(result.metrics.passedCount).toBe(1);
      expect(result.metrics.passRate).toBe(50);
    });

    it('reports a zero pass rate rather than NaN when there are no results', async () => {
      const { prisma } = makePrisma();
      const service = new AnalyticsService(prisma);

      const result = await service.getOverview(asUser(student));

      expect(result.metrics.passRate).toBe(0);
      expect(result.metrics.officialResults).toBe(0);
      expect(Number.isNaN(result.metrics.averagePercentage)).toBe(false);
    });
  });

  describe('charts', () => {
    it('produces a gapless 14-day trend axis', async () => {
      const { prisma } = makePrisma();
      const service = new AnalyticsService(prisma);

      const result = await service.getOverview(asUser(admin));

      expect(result.charts.trend).toHaveLength(14);
      for (const point of result.charts.trend) {
        expect(point).toMatchObject({
          date: expect.any(String),
          submissions: expect.any(Number),
          sessionsStarted: expect.any(Number),
          resultsPublished: expect.any(Number),
        });
      }
      const dates = result.charts.trend.map((p) => p.date);
      expect([...dates].sort()).toEqual(dates);
    });

    it('buckets scores into fixed bands that never overlap', async () => {
      const now = new Date();
      const mk = (id: string, pct: number) => ({
        id,
        examId: 'e1',
        studentId: `s-${id}`,
        percentage: pct,
        passed: pct >= 50,
        manualAdjusted: false,
        regradeCount: 0,
        createdAt: now,
        publishedAt: null,
        submission: { submittedAt: now, session: { attemptNumber: 1, startedAt: null } },
      });
      const { prisma } = makePrisma({
        result: {
          findMany: async () => [mk('a', 10), mk('b', 45), mk('c', 62), mk('d', 80), mk('e', 95)],
          count: async () => 0,
          groupBy: async () => [],
          aggregate: async () => ({ _avg: { percentage: 58.4 }, _sum: { regradeCount: 0 } }),
        },
      });
      const service = new AnalyticsService(prisma);

      const result = await service.getOverview(asUser(admin));
      const bands = result.charts.scoreDistribution;

      expect(bands.map((b) => b.label)).toEqual(['0-39', '40-59', '60-74', '75-89', '90-100']);
      expect(bands.reduce((sum, b) => sum + b.count, 0)).toBe(5);
      // Every score lands in exactly one band, and shares total 100%.
      expect(bands.reduce((sum, b) => sum + b.share, 0)).toBeCloseTo(100, 5);
    });
  });

  describe('getExamBreakdown', () => {
    it('returns nothing for a student-only viewer', async () => {
      const { prisma, calls } = makePrisma();
      const service = new AnalyticsService(prisma);

      const result = await service.getExamBreakdown(asUser(student));

      expect(result.exams).toEqual([]);
      // Critically, it must not even query the exam table.
      expect(calls.findMany).toHaveLength(0);
    });

    it('filters the exam list to what an instructor may monitor', async () => {
      const { prisma, calls } = makePrisma();
      const service = new AnalyticsService(prisma);

      await service.getExamBreakdown(asUser(instructor));

const examQuery = calls.findMany.find(([arg]: any[]) => arg?.where?.OR);
expect(examQuery).toBeDefined();
      expect(JSON.stringify(examQuery![0])).toContain('instructor-1');
    });
  });
});