import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExamPermissionLevel,
  ExamRetakePolicy,
  ExamResumePolicy,
  NotificationType,
  RetakeRequestStatus,
  RoleName,
  SessionStatus,
} from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { ExamAccessService } from '../common/exam-access.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../websocket/realtime.gateway';

const ADMIN_ROLES: RoleName[] = [RoleName.SUPER_ADMIN, RoleName.ADMIN];

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ExamAccessService,
    private readonly gateway: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  /** Student asks for a retake of an exam they have already submitted. */
  async requestRetake(studentId: string, examId: string, reason?: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, title: true, retakePolicy: true, resumePolicy: true, createdById: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    if (exam.resumePolicy === ExamResumePolicy.DISABLED || exam.retakePolicy === ExamRetakePolicy.DISABLED) {
      throw new ForbiddenException('Retakes are not enabled for this exam');
    }

    const session = await this.prisma.examSession.findFirst({
      where: {
        examId,
        studentId,
        status: { in: [SessionStatus.SUBMITTED, SessionStatus.AUTO_SUBMITTED] },
      },
      orderBy: { attemptNumber: 'desc' },
      select: { id: true, attemptNumber: true },
    });
    if (!session) {
      throw new BadRequestException('You have no submitted session for this exam');
    }

    const existing = await this.prisma.retakeRequest.findFirst({
      where: {
        sessionId: session.id,
        studentId,
        status: { in: [RetakeRequestStatus.PENDING, RetakeRequestStatus.APPROVED] },
      },
    });
    if (existing) {
      if (existing.status === RetakeRequestStatus.APPROVED) {
        throw new ForbiddenException('Your retake request was already approved — you can start a new attempt now');
      }
      return existing;
    }

    const request = await this.prisma.retakeRequest.create({
      data: {
        studentId,
        examId,
        sessionId: session.id,
        attemptNumber: session.attemptNumber,
        reason,
      },
    });

    await this.notifyExamStaff(
      exam,
      NotificationType.RETAKE_REQUEST,
      'Retake request',
      'A student requested a retake for this exam.',
      { kind: 'retake', requestId: request.id, examId, studentId },
    );

    return request;
  }

  /** Student asks for permission to resume an interrupted (paused) session. */
  async requestResume(studentId: string, sessionId: string, reason?: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, studentId },
      include: {
        exam: {
          select: { id: true, title: true, resumePolicy: true, connectionLossPolicy: true, createdById: true },
        },
      },
    });
    if (!session) throw new NotFoundException('Exam session not found');
    if (session.status !== SessionStatus.PAUSED) {
      throw new BadRequestException('Only paused sessions need a resume request');
    }
    if (session.exam.resumePolicy === ExamResumePolicy.DISABLED) {
      throw new ForbiddenException('Resuming sessions is not supported for this exam');
    }

    const existing = await this.prisma.resumeRequest.findFirst({
      where: {
        sessionId,
        studentId,
        status: { in: [RetakeRequestStatus.PENDING, RetakeRequestStatus.APPROVED] },
      },
    });
    if (existing) {
      if (existing.status === RetakeRequestStatus.APPROVED) {
        throw new ForbiddenException('Your resume request was already approved — you can resume now');
      }
      return existing;
    }

    const request = await this.prisma.resumeRequest.create({
      data: { studentId, examId: session.exam.id, sessionId, reason },
    });

    await this.notifyExamStaff(
      session.exam,
      NotificationType.RESUME_REQUEST,
      'Resume request',
      'A student requested approval to resume an interrupted session.',
      { kind: 'resume', requestId: request.id, examId: session.exam.id, sessionId, studentId },
    );

    return request;
  }

  /** Staff feed of pending requests across exams the user can monitor. */
  async listPending(user: AuthenticatedUser) {
    const exams = await this.examIdsFor(user);
    if (exams.length === 0) return { retake: [], resume: [] };

    const [retake, resume] = await Promise.all([
      this.prisma.retakeRequest.findMany({
        where: { status: RetakeRequestStatus.PENDING, examId: { in: exams } },
        orderBy: { requestedAt: 'desc' },
        take: 200,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
          exam: { select: { id: true, title: true } },
        },
      }),
      this.prisma.resumeRequest.findMany({
        where: { status: RetakeRequestStatus.PENDING, examId: { in: exams } },
        orderBy: { requestedAt: 'desc' },
        take: 200,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
          exam: { select: { id: true, title: true } },
        },
      }),
    ]);

    return {
      retake: retake.map((r) => ({ ...r, type: 'retake' as const })),
      resume: resume.map((r) => ({ ...r, type: 'resume' as const })),
    };
  }

  async listForExam(examId: string, user: AuthenticatedUser) {
    await this.access.assertCanMonitor(examId, user);
    const [retake, resume] = await Promise.all([
      this.prisma.retakeRequest.findMany({
        where: { examId },
        orderBy: { requestedAt: 'desc' },
        take: 200,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.resumeRequest.findMany({
        where: { examId },
        orderBy: { requestedAt: 'desc' },
        take: 200,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, email: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
    ]);
    return { retake, resume };
  }

  /**
   * Instructor/admin decides on a pending request. Retake/resume approval
   * requires CO_OWNER access (or ADMIN role when the exam policy says so);
   * rejecting requires PROCTOR access.
   */
  async decide(user: AuthenticatedUser, requestId: string, approve: boolean, note?: string) {
    const request = await this.prisma.retakeRequest.findUnique({ where: { id: requestId } });
    const resume = !request
      ? await this.prisma.resumeRequest.findUnique({ where: { id: requestId } })
      : null;

    const kind = request ? 'retake' : resume ? 'resume' : null;
    if (!kind) throw new NotFoundException('Request not found');
    const base = (request ?? resume)!;

    if (base.status !== RetakeRequestStatus.PENDING) {
      throw new BadRequestException('Request has already been decided');
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: base.examId },
      select: {
        id: true,
        title: true,
        retakePolicy: true,
        resumePolicy: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const adminOnlyApproval =
      (kind === 'retake' && exam.retakePolicy === ExamRetakePolicy.ADMIN_APPROVAL) ||
      (kind === 'resume' && exam.resumePolicy === ExamResumePolicy.ADMIN_APPROVAL);

    if (approve) {
      if (adminOnlyApproval) {
        const isAdmin = user.roles.some((role) => ADMIN_ROLES.some((admin) => admin === role));
        if (!isAdmin) throw new ForbiddenException('Only an administrator can approve this request');
      } else {
        await this.access.assertCanAct(base.examId, user, ExamPermissionLevel.CO_OWNER);
      }
    } else {
      await this.access.assertCanAct(base.examId, user, ExamPermissionLevel.PROCTOR);
    }

    const now = new Date();
    if (kind === 'retake') {
      await this.prisma.retakeRequest.update({
        where: { id: requestId },
        data: {
          status: approve ? RetakeRequestStatus.APPROVED : RetakeRequestStatus.REJECTED,
          reviewedById: user.sub,
          reviewNote: note ?? null,
          decisionAt: now,
        },
      });
      if (approve && base.sessionId) {
        await this.prisma.examSession.update({
          where: { id: base.sessionId },
          data: { retakePermitted: true },
        });
      }
      await this.notifyStudent(
        base.studentId,
        approve ? NotificationType.RETAKE_APPROVED : NotificationType.RETAKE_REJECTED,
        approve ? 'Retake approved' : 'Retake request rejected',
        approve
          ? 'Your retake request for this exam was approved. You can now start a new attempt.'
          : 'Your retake request was rejected.',
        { kind: 'retake', requestId, examId: base.examId, note: note ?? null },
      );
    } else {
      await this.prisma.resumeRequest.update({
        where: { id: requestId },
        data: {
          status: approve ? RetakeRequestStatus.APPROVED : RetakeRequestStatus.REJECTED,
          reviewedById: user.sub,
          reviewNote: note ?? null,
          decisionAt: now,
        },
      });
      if (approve && base.sessionId) {
        await this.prisma.examSession.update({
          where: { id: base.sessionId },
          data: { status: SessionStatus.IN_PROGRESS, resumeApprovedAt: now, resumeDeniedAt: null },
        });
        this.gateway.emitToSession(base.sessionId, 'exam:control', { type: 'resume', approved: true });
      } else {
        await this.prisma.examSession.update({
          where: { id: base.sessionId },
          data: { resumeDeniedAt: now },
        });
        this.gateway.emitToSession(base.sessionId, 'exam:control', {
          type: 'resume-denied',
          message: note ?? null,
        });
      }
      await this.notifyStudent(
        base.studentId,
        approve ? NotificationType.RESUME_APPROVED : NotificationType.RESUME_REJECTED,
        approve ? 'Resume approved' : 'Resume request rejected',
        approve
          ? 'Your request to resume the exam was approved. You may continue.'
          : 'Your request to resume the exam was rejected.',
        { kind: 'resume', requestId, examId: base.examId, sessionId: base.sessionId, note: note ?? null },
      );
    }

    await this.audit.log(
      user.sub,
      'EXAM',
      base.examId,
      approve ? `REQUEST_APPROVED_${kind.toUpperCase()}` : `REQUEST_REJECTED_${kind.toUpperCase()}`,
      {
        after: JSON.stringify({
          requestId,
          studentId: base.studentId,
          note: note ?? null,
          decidedBy: user.sub,
        }),
      },
    );

    return kind === 'retake'
      ? this.prisma.retakeRequest.findUnique({ where: { id: requestId } })
      : this.prisma.resumeRequest.findUnique({ where: { id: requestId } });
  }

  private async examIdsFor(user: AuthenticatedUser): Promise<string[]> {
    const isAdmin = user.roles.some((role) => ADMIN_ROLES.some((admin) => admin === role));
    const exams = await this.prisma.exam.findMany({
      where: isAdmin
        ? { status: { not: 'DRAFT' } }
        : {
            OR: [
              { createdById: user.sub },
              { shares: { some: { instructorId: user.sub } } },
            ],
          },
      select: { id: true },
    });
    return exams.map((e) => e.id);
  }

  private async notifyExamStaff(
    exam: { id: string; title: string; createdById: string },
    type: NotificationType,
    title: string,
    message: string,
    metadata: Record<string, unknown>,
  ) {
    const staffIds = new Set<string>([exam.createdById]);
    const admins = await this.prisma.user.findMany({
      where: { roles: { some: { role: { name: { in: ADMIN_ROLES } } } } },
      select: { id: true },
    });
    for (const admin of admins) staffIds.add(admin.id);

    for (const userId of staffIds) {
      await this.prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          metadata: JSON.stringify({ ...metadata, examTitle: exam.title }),
        },
      });
      this.gateway.emitNotification(userId, {
        type,
        title,
        message,
        metadata: { ...metadata, examTitle: exam.title },
      });
    }
  }

  private async notifyStudent(
    studentId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.notification.create({
      data: { userId: studentId, type, title, message, metadata: JSON.stringify(metadata) },
    });
    this.gateway.emitNotification(studentId, { type, title, message, metadata });
  }
}