import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, RoleName } from '@prisma/client';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ExamAccessService } from '../common/exam-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../websocket/realtime.gateway';
import {
  computeTimeExtension,
  EXTEND_REQUIRES_ACTIVE_SESSION,
  isExtendableSession,
} from '../monitoring/time-extension.util';

/** Bound on one grant, mirroring the single-session instructor action. */
const MAX_MINUTES = 120;

export interface ExtendScope {
  examId: string;
  minutes: number;
  /** Omitted or empty means every active session for the exam. */
  studentIds?: string[];
  classId?: string;
  reason?: string;
  /** Target one specific session, used by the per-student instructor action. */
  sessionId?: string;
}

export interface ExtendOutcome {
  extended: number;
  skipped: Array<{ sessionId: string; reason: string }>;
  notifications: number;
}

/**
 * Grants extra exam time to one student, a selected set, or every active
 * session on an exam.
 *
 * The session row is the single source of truth: `expiresAt` is recomputed from
 * the stored deadline (never from the client-writable `remainingSeconds`
 * snapshot), the extension is journalled to `time_extensions`, and the affected
 * student is notified over the existing Socket.IO channel. A student who is
 * offline simply reads the new deadline when they next fetch their session.
 */
@Injectable()
export class TimeExtensionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly examAccess: ExamAccessService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async extend(scope: ExtendScope, user: AuthenticatedUser): Promise<ExtendOutcome> {
    const minutes = Number(scope.minutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
      throw new BadRequestException(`minutes must be between 1 and ${MAX_MINUTES}`);
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: scope.examId },
      select: { id: true, title: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    // Authorisation follows the existing exam-share/ownership rules, so a
    // proctor cannot grant time on an exam they do not hold access to.
    await this.examAccess.assertCanAct(scope.examId, user, 'PROCTOR');

    let studentIds = scope.studentIds;
    if (scope.classId) {
      const enrolled = await this.prisma.classEnrollment.findMany({
        where: { classId: scope.classId },
        select: { studentId: true },
      });
      const inClass = enrolled.map((e) => e.studentId);
      studentIds = studentIds ? studentIds.filter((id) => inClass.includes(id)) : inClass;
    }

    const sessions = await this.prisma.examSession.findMany({
      where: {
        examId: scope.examId,
        ...(scope.sessionId ? { id: scope.sessionId } : {}),
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      select: {
        id: true,
        studentId: true,
        status: true,
        submittedAt: true,
        expiresAt: true,
        originalExpiresAt: true,
        totalExtensionMinutes: true,
      },
    });

    if (sessions.length === 0) {
      throw new NotFoundException('No exam sessions matched this selection');
    }

    const outcome: ExtendOutcome = { extended: 0, skipped: [], notifications: 0 };
    const now = new Date();

    // Sequential rather than parallel: each write re-reads its own row inside the
    // transaction, and a batch of 300 simultaneous transactions on the same exam
    // is exactly how two proctors granting time at once clobber each other.
    for (const session of sessions) {
      if (!isExtendableSession(session)) {
        outcome.skipped.push({ sessionId: session.id, reason: EXTEND_REQUIRES_ACTIVE_SESSION });
        continue;
      }

      const applied = await this.prisma.$transaction(async (tx) => {
        const fresh = await tx.examSession.findUnique({
          where: { id: session.id },
          select: {
            id: true,
            examId: true,
            studentId: true,
            status: true,
            submittedAt: true,
            expiresAt: true,
            originalExpiresAt: true,
            totalExtensionMinutes: true,
          },
        });
        if (!fresh) return null;
        if (!isExtendableSession(fresh)) return null;

        const next = computeTimeExtension({ expiresAt: fresh.expiresAt, minutes, now });
        const previousExpiresAt = fresh.expiresAt;
        const totalExtensionMinutes = fresh.totalExtensionMinutes + minutes;

        await tx.examSession.update({
          where: { id: fresh.id },
          data: {
            expiresAt: next.expiresAt,
            remainingSeconds: next.remainingSeconds,
            // Capture the starting deadline the first time time is granted, so
            // the original expiry stays knowable after expiresAt moves.
            originalExpiresAt: fresh.originalExpiresAt ?? fresh.expiresAt,
            totalExtensionMinutes,
            lastExtendedAt: now,
            lastExtendedById: user.sub,
          },
        });

        await tx.timeExtension.create({
          data: {
            sessionId: fresh.id,
            examId: fresh.examId,
            studentId: fresh.studentId,
            minutes,
            previousExpiresAt,
            newExpiresAt: next.expiresAt,
            totalExtensionMinutes,
            grantedById: user.sub,
            reason: scope.reason?.trim() || null,
          },
        });

        await tx.examEvent.create({
          data: {
            examId: fresh.examId,
            sessionId: fresh.id,
            studentId: fresh.studentId,
            type: 'TIME_EXTENDED',
            metadata: JSON.stringify({ minutes, previousExpiresAt, newExpiresAt: next.expiresAt }),
          },
        });

        await tx.notification.create({
          data: {
            userId: fresh.studentId,
            type: NotificationType.EXAM_TIME_EXTENDED,
            title: 'Exam time extended',
            message: `You have been granted ${minutes} more minute${minutes === 1 ? '' : 's'} for "${exam.title}".`,
            metadata: JSON.stringify({
              examId: fresh.examId,
              sessionId: fresh.id,
              minutes,
              expiresAt: next.expiresAt,
            }),
          },
        });

        return { sessionId: fresh.id, remainingSeconds: next.remainingSeconds, expiresAt: next.expiresAt };
      });

      if (!applied) {
        outcome.skipped.push({ sessionId: session.id, reason: EXTEND_REQUIRES_ACTIVE_SESSION });
        continue;
      }

      outcome.extended++;
      outcome.notifications++;
      // Live students update their countdown immediately; everyone else picks the
      // new deadline up from the session endpoint on reconnect.
      this.gateway.emitToSession(applied.sessionId, 'exam:control', {
        type: 'extend',
        minutes,
        remainingSeconds: applied.remainingSeconds,
        expiresAt: applied.expiresAt,
      });
    }

    void this.prisma.auditLog
      .create({
        data: {
          actorId: user.sub,
          action: 'TIME_EXTENDED',
          entity: 'EXAM_SESSION',
          entityId: null,
          before: JSON.stringify({
            examId: scope.examId,
            minutes,
            selected: studentIds?.length ?? 'all',
            classId: scope.classId ?? null,
            reason: scope.reason ?? null,
          }),
          after: JSON.stringify({ extended: outcome.extended, skipped: outcome.skipped.length }),
        },
      })
      .catch(() => undefined);

    return outcome;
  }

  /** Full audit history for one session, newest first. */
  async historyForSession(sessionId: string, user: AuthenticatedUser) {
    await this.examAccess.assertCanMonitorSession(sessionId, user);
    return this.prisma.timeExtension.findMany({
      where: { sessionId },
      include: {
        grantedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Audit history across an exam, for the monitoring view. */
  async historyForExam(examId: string, user: AuthenticatedUser) {
    await this.examAccess.assertCanMonitor(examId, user);
    return this.prisma.timeExtension.findMany({
      where: { examId },
      include: {
        grantedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Effective deadline for a session, derived from persisted state.
   *
   * Students use this as the authority for their countdown, so a tampered
   * client clock or a stale localStorage value cannot buy extra time.
   */
  async effectiveDeadline(sessionId: string, studentId: string, isStaff: boolean) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        examId: true,
        studentId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        originalExpiresAt: true,
        totalExtensionMinutes: true,
        submittedAt: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (!isStaff && session.studentId !== studentId) {
      throw new NotFoundException('Session not found');
    }
    return {
      sessionId: session.id,
      examId: session.examId,
      status: session.status,
      startedAt: session.startedAt,
      originalExpiresAt: session.originalExpiresAt,
      expiresAt: session.expiresAt,
      totalExtensionMinutes: session.totalExtensionMinutes,
      submittedAt: session.submittedAt,
      remainingSeconds: session.expiresAt
        ? Math.max(0, Math.round((session.expiresAt.getTime() - Date.now()) / 1000))
        : null,
    };
  }

  /** Roles that may grant time, used to gate the UI without trusting the client. */
  static canExtend(roles: readonly string[]): boolean {
    const allowed: readonly RoleName[] = [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR];
    return roles.some((role) => allowed.includes(role as RoleName));
  }
}