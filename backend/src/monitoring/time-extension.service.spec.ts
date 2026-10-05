import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType, RoleName, SessionStatus, TimeExtension } from '@prisma/client';
import { TimeExtensionService } from './time-extension.service';

type Row = {
  id: string;
  studentId: string;
  status: string;
  submittedAt: Date | null;
  expiresAt: Date;
  remainingSeconds?: number;
  originalExpiresAt: Date | null;
  totalExtensionMinutes: number;
};

const BASE_EXPIRY_MS = Date.now() + 30 * 60_000;

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 'session-1',
    studentId: 'student-1',
    status: SessionStatus.IN_PROGRESS,
    submittedAt: null,
    expiresAt: new Date(BASE_EXPIRY_MS),
    originalExpiresAt: null,
    totalExtensionMinutes: 0,
    ...overrides,
  };
}

function makeHarness(initial: Row[] = [row()]) {
  const sessions = new Map(initial.map((r) => [r.id, { ...r }]));
  const extensions: Partial<TimeExtension>[] = [];
  const events: Array<{ type: string; metadata: string | null }> = [];
  const notifications: Array<{ userId: string; type: NotificationType }> = [];
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];

  const tx = {
    examSession: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const found = sessions.get(where.id);
        return found ? { ...found } : null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        sessions.set(where.id, { ...sessions.get(where.id)!, ...data });
        return sessions.get(where.id)!;
      }),
    },
    timeExtension: {
      create: jest.fn(async ({ data }: { data: Partial<TimeExtension> }) => {
        extensions.push(data);
        return data;
      }),
    },
    examEvent: {
      create: jest.fn(async ({ data }: { data: { type: string; metadata: string | null } }) => {
        events.push(data);
        return data;
      }),
    },
    notification: {
      create: jest.fn(async ({ data }: { data: { userId: string; type: NotificationType } }) => {
        notifications.push(data);
        return data;
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    exam: {
      findUnique: jest.fn(async () => ({ id: 'exam-1', title: 'Midterm' })),
    },
    examSession: {
      findMany: jest.fn(async () => [...sessions.values()].map((r) => ({ ...r }))),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const found = sessions.get(where.id);
        return found ? { ...found } : null;
      }),
    },
    classEnrollment: {
      findMany: jest.fn(async () => [{ studentId: 'student-1' }, { studentId: 'student-2' }]),
    },
    timeExtension: {
      findMany: jest.fn(async () => extensions),
    },
    auditLog: { create: jest.fn(async () => ({})) },
  };

  const access = {
    assertCanAct: jest.fn(async () => undefined),
    assertCanMonitor: jest.fn(async () => undefined),
    assertCanMonitorSession: jest.fn(async () => undefined),
    assertCanManage: jest.fn(async () => undefined),
  };

  const gateway = {
    emitToSession: jest.fn((room: string, event: string, payload: unknown) =>
      emitted.push({ room, event, payload }),
    ),
  };

  const service = new TimeExtensionService(prisma as never, access as never, gateway as never);
  const instructor = { sub: 'instructor-1', roles: [RoleName.INSTRUCTOR] } as never;
  return { service, prisma, access, gateway, sessions, extensions, events, notifications, emitted, instructor, tx };
}

describe('TimeExtensionService', () => {
  const scope = { examId: 'exam-1', minutes: 10, reason: 'technical failure' };

  it('extends the persisted deadline, never a client-supplied remaining time', async () => {
    const h = makeHarness();
    const before = h.sessions.get('session-1')!.expiresAt;

    const outcome = await h.service.extend(scope, h.instructor);

    expect(outcome.extended).toBe(1);
    const after = h.sessions.get('session-1')!;
    expect(after.expiresAt.getTime() - before.getTime()).toBe(10 * 60_000);
    expect(after.totalExtensionMinutes).toBe(10);
    expect(after.originalExpiresAt?.getTime()).toBe(before.getTime());
  });

  it('records an audit row carrying the grantor and the reason', async () => {
    const h = makeHarness();
    await h.service.extend(scope, h.instructor);

    expect(h.extensions).toHaveLength(1);
    expect(h.extensions[0]).toMatchObject({
      sessionId: 'session-1',
      minutes: 10,
      grantedById: 'instructor-1',
      reason: 'technical failure',
      totalExtensionMinutes: 10,
    });
  });

  it('notifies the student over the live session channel', async () => {
    const h = makeHarness();
    await h.service.extend(scope, h.instructor);

    expect(h.notifications[0]).toMatchObject({ userId: 'student-1', type: NotificationType.EXAM_TIME_EXTENDED });
    expect(h.emitted[0]).toMatchObject({ room: 'session-1', event: 'exam:control' });
    expect(h.emitted[0]!.payload).toMatchObject({ type: 'extend', minutes: 10 });
  });

  it('covers every active session when no students are named', async () => {
    const h = makeHarness([
      row({ id: 's1', studentId: 'a' }),
      row({ id: 's2', studentId: 'b' }),
    ]);

    const outcome = await h.service.extend({ examId: 'exam-1', minutes: 5 }, h.instructor);

    expect(outcome.extended).toBe(2);
    expect(h.extensions).toHaveLength(2);
  });

  it('skips sessions that are no longer running, and says why', async () => {
    const h = makeHarness([
      row({ id: 's1' }),
      row({ id: 's2', status: SessionStatus.SUBMITTED, submittedAt: new Date() }),
      row({ id: 's3', status: SessionStatus.EXPIRED }),
    ]);

    const outcome = await h.service.extend({ examId: 'exam-1', minutes: 5 }, h.instructor);

    expect(outcome.extended).toBe(1);
    expect(outcome.skipped.map((s) => s.sessionId).sort()).toEqual(['s2', 's3']);
    // A skipped session must not gain time or an audit row.
    expect(h.sessions.get('s2')!.totalExtensionMinutes).toBe(0);
    expect(h.extensions).toHaveLength(1);
  });

  it('stacks consecutive grants on the latest deadline', async () => {
    const h = makeHarness();
    await h.service.extend({ examId: 'exam-1', minutes: 10 }, h.instructor);
    const midway = h.sessions.get('session-1')!.expiresAt;
    await h.service.extend({ examId: 'exam-1', minutes: 5 }, h.instructor);

    const after = h.sessions.get('session-1')!;
    expect(after.totalExtensionMinutes).toBe(15);
    expect(after.expiresAt.getTime() - midway.getTime()).toBe(5 * 60_000);
    // The originally granted deadline survives both moves.
    expect(after.originalExpiresAt?.getTime()).toBe(BASE_EXPIRY_MS);
  });

  it('grants time from now when the stored deadline has already lapsed', async () => {
    const h = makeHarness([row({ expiresAt: new Date(Date.now() - 60_000) })]);
    const outcome = await h.service.extend({ examId: 'exam-1', minutes: 3 }, h.instructor);

    expect(outcome.extended).toBe(1);
    expect(h.sessions.get('session-1')!.remainingSeconds).toBeGreaterThan(150);
  });

  it('refuses an out-of-range grant', async () => {
    const h = makeHarness();
    await expect(h.service.extend({ examId: 'exam-1', minutes: 0 }, h.instructor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(h.service.extend({ examId: 'exam-1', minutes: 121 }, h.instructor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(h.extensions).toHaveLength(0);
  });

  it('authorises the exam before touching a single session', async () => {
    const h = makeHarness();
    h.access.assertCanAct.mockRejectedValueOnce(new ForbiddenException('nope'));
    await expect(h.service.extend(scope, h.instructor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when the selection matched no sessions at all', async () => {
    const h = makeHarness([]);
    await expect(h.service.extend(scope, h.instructor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('derives the effective deadline from persisted state, not the caller', async () => {
    const h = makeHarness([row({ expiresAt: new Date(Date.now() + 600_000) })]);

    const asOwner = await h.service.effectiveDeadline('session-1', 'student-1', false);
    expect(asOwner.remainingSeconds).toBeGreaterThan(0);
    expect(asOwner.remainingSeconds).toBeLessThanOrEqual(600);

    await expect(h.service.effectiveDeadline('session-1', 'someone-else', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('treats only staff roles as able to grant time', () => {
    expect(TimeExtensionService.canExtend([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR])).toBe(true);
    expect(TimeExtensionService.canExtend([RoleName.STUDENT])).toBe(false);
    expect(TimeExtensionService.canExtend([])).toBe(false);
  });
});