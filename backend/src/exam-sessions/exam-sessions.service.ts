import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExamConnectionLossPolicy,
  ExamEventType,
  ExamResumePolicy,
  ExamRetakePolicy,
  ExamStatus,
  RetakeRequestStatus,
  SessionStatus,
} from '@prisma/client';
import { MonitoringService } from '../monitoring/monitoring.service';
import { PrismaService } from '../prisma/prisma.service';
import { LogViolationDto } from './dto/log-violation.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';

@Injectable()
export class ExamSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoring: MonitoringService,
  ) {}

  async findByExam(examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) throw new NotFoundException('Exam not found');

    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        submission: { select: { submittedAt: true, status: true } },
        answers: { select: { selectedOptionIds: true, answerText: true, answerJson: true, isMarkedForReview: true } },
        exam: {
          select: {
            resumeApprovalRequired: true,
            resumePolicy: true,
            connectionLossPolicy: true,
            retakePolicy: true,
            _count: { select: { questions: true } },
          },
        },
        _count: { select: { violations: true, retakeRequests: true, resumeRequests: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return sessions.map((s) => {
      const totalQuestions = s.exam._count.questions;
      const answeredCount = s.answers.filter((a) => this.isAnswered(a)).length;
      const resumeApprovalRequired =
        s.exam.resumeApprovalRequired ||
        s.exam.resumePolicy === ExamResumePolicy.INSTRUCTOR_APPROVAL ||
        s.exam.resumePolicy === ExamResumePolicy.ADMIN_APPROVAL ||
        s.exam.connectionLossPolicy === ExamConnectionLossPolicy.APPROVAL_REQUIRED ||
        s.exam.connectionLossPolicy === ExamConnectionLossPolicy.MARK_REVIEW;
      return {
        id: s.id,
        examId: s.examId,
        studentId: s.studentId,
        student: s.student,
        attemptNumber: s.attemptNumber,
        status: s.status,
        resumeApprovalRequired,
        resumePolicy: s.exam.resumePolicy,
        connectionLossPolicy: s.exam.connectionLossPolicy,
        retakePolicy: s.exam.retakePolicy,
        resumeApprovedAt: s.resumeApprovedAt,
        resumeDeniedAt: s.resumeDeniedAt,
        resumeRequested: s._count.resumeRequests > 0,
        retakeRequested: s._count.retakeRequests > 0,
        resumePending: resumeApprovalRequired && s.status === SessionStatus.PAUSED && !s.resumeApprovedAt,
        submittedAt: s.submittedAt ?? s.submission?.submittedAt ?? null,
        violationsCount: s._count.violations,
        remainingSeconds: s.remainingSeconds,
        expiresAt: s.expiresAt,
        connectionState: s.connectionState,
        lastHeartbeatAt: s.lastHeartbeatAt,
        lastActivityAt: s.lastActivityAt,
        currentQuestionId: s.currentQuestionId,
        currentQuestionIndex: s.currentQuestionIndex,
        riskScore: s.riskScore,
        riskLevel: s.riskLevel,
        retakePermitted: s.retakePermitted,
        answeredCount,
        totalQuestions,
        unansweredCount: Math.max(0, totalQuestions - answeredCount),
        flaggedCount: s.answers.filter((a) => a.isMarkedForReview).length,
        progress: totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0,
      };
    });
  }

  private isAnswered(a: { selectedOptionIds: string; answerText: string | null; answerJson: string | null }) {
    try {
      const selected: string[] = JSON.parse(a.selectedOptionIds ?? '[]');
      if (Array.isArray(selected) && selected.length > 0) return true;
    } catch {
      /* ignore */
    }
    if (a.answerText && a.answerText.trim().length > 0) return true;
    if (a.answerJson && a.answerJson !== 'null' && a.answerJson !== '{}' && a.answerJson !== '[]') return true;
    return false;
  }

  async startExam(examId: string, studentId: string) {
    const existing = await this.prisma.examSession.findFirst({
      where: { examId, studentId, status: { in: [SessionStatus.IN_PROGRESS, SessionStatus.PAUSED] } },
      include: this.sessionInclude(),
    });
    if (existing) {
      await this.assertResumeAllowed(existing);
      return this.sanitizeSession(existing);
    }

    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { question: { include: { options: { orderBy: { sortOrder: 'asc' } } } } },
        },
      },
    });
    if (!exam) {
      throw new NotFoundException('Exam not found');
    }

    if (exam.status !== ExamStatus.LIVE) {
      throw new ForbiddenException('Exam has not been started yet. Please wait for the instructor to begin the exam.');
    }

    const submittedSession = await this.prisma.examSession.findFirst({
      where: {
        examId,
        studentId,
        status: { in: [SessionStatus.SUBMITTED, SessionStatus.AUTO_SUBMITTED] },
      },
      orderBy: { attemptNumber: 'desc' },
      include: {
        retakeRequests: { where: { studentId, status: { in: [RetakeRequestStatus.PENDING, RetakeRequestStatus.APPROVED] } } },
      },
    });
    let approvedRetake = false;
    if (submittedSession) {
      const hasApprovedRetake = submittedSession.retakeRequests.some(
        (r) => r.status === RetakeRequestStatus.APPROVED,
      );
      approvedRetake =
        exam.retakePolicy !== ExamRetakePolicy.DISABLED &&
        (submittedSession.retakePermitted || hasApprovedRetake);
      if (!approvedRetake) {
        if (exam.retakePolicy === ExamRetakePolicy.AUTO) {
          const attemptsUsed = await this.prisma.examSession.count({ where: { examId, studentId } });
          if (attemptsUsed >= exam.attemptsAllowed) {
            throw new HttpException(
              { code: 'RETAKE_REQUIRED', message: 'No retake attempts remaining', retakePolicy: exam.retakePolicy },
              HttpStatus.LOCKED,
            );
          }
        } else {
          const hasPending = submittedSession.retakeRequests.some(
            (r) => r.status === RetakeRequestStatus.PENDING,
          );
          throw new HttpException(
            {
              code: hasPending ? 'RETAKE_PENDING' : 'RETAKE_REQUIRED',
              retakePolicy: exam.retakePolicy,
              message: hasPending
                ? 'Your retake request is pending approval. Contact your instructor if this takes too long.'
                : 'You have already submitted this exam. Contact your instructor to retake.',
            },
            HttpStatus.LOCKED,
          );
        }
      }
    }

    const attemptsUsed = await this.prisma.examSession.count({ where: { examId, studentId } });
    if (attemptsUsed >= exam.attemptsAllowed && !approvedRetake) {
      throw new ForbiddenException('No attempts remaining');
    }

    const orderedQuestions = exam.randomizeQuestions ? this.shuffle(exam.questions) : exam.questions;
    const questionOrder = orderedQuestions.map((examQuestion) => examQuestion.questionId);
    const optionOrder = Object.fromEntries(
      orderedQuestions.map((examQuestion) => {
        const options = exam.randomizeOptions
          ? this.shuffle(examQuestion.question.options)
          : examQuestion.question.options;
        return [examQuestion.questionId, options.map((option) => option.id)];
      }),
    );

    const session = await this.prisma.examSession.create({
      data: {
        examId,
        studentId,
        attemptNumber: attemptsUsed + 1,
        status: SessionStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + exam.durationMinutes * 60 * 1000),
        remainingSeconds: exam.durationMinutes * 60,
        questionOrder: JSON.stringify(questionOrder),
        optionOrder: JSON.stringify(optionOrder),
        currentQuestionIndex: 0,
      },
      include: this.sessionInclude(),
    });

    try {
      await this.monitoring.recordEvent({
        examId,
        sessionId: session.id,
        type: ExamEventType.EXAM_STARTED,
        metadata: { questionCount: questionOrder.length, durationMinutes: exam.durationMinutes },
      });
    } catch {
      /* monitoring must not block exam start */
    }

    return this.sanitizeSession(session);
  }

  async resumeSession(sessionId: string, studentId: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, studentId },
      include: this.sessionInclude(),
    });
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }
    await this.assertResumeAllowed(session);
    try {
      await this.monitoring.recordEvent({
        examId: session.examId,
        sessionId: session.id,
        type: ExamEventType.EXAM_RESUMED,
      });
    } catch {
      /* best effort */
    }
    return this.sanitizeSession(session);
  }

  /**
   * When the exam has resume protection enabled, a student whose session was
   * paused (e.g. dropped connection) must wait for an instructor to approve
   * before they can continue. Approving flips the session back to IN_PROGRESS
   * server-side; denying leaves it PAUSED.
   */
  private async assertResumeAllowed(session: {
    status: SessionStatus;
    exam: {
      resumeApprovalRequired: boolean;
      resumePolicy: ExamResumePolicy;
      connectionLossPolicy: ExamConnectionLossPolicy;
    };
    resumeApprovedAt: Date | null;
    resumeDeniedAt: Date | null;
  }) {
    if (session.exam.resumePolicy === ExamResumePolicy.DISABLED) {
      throw new HttpException(
        {
          code: 'RESUME_DISABLED',
          message: 'Resuming interrupted sessions is disabled for this exam. Contact your instructor for help.',
        },
        HttpStatus.LOCKED,
      );
    }
    if (session.exam.connectionLossPolicy === ExamConnectionLossPolicy.END_SESSION) {
      throw new HttpException(
        {
          code: 'SESSION_ENDED',
          message: 'Your session was ended after a connection loss. Contact your instructor for help.',
        },
        HttpStatus.LOCKED,
      );
    }
    if (session.status !== SessionStatus.PAUSED) {
      return;
    }

    if (!this.resumeApprovalRequiredFor(session.exam) || session.resumeApprovedAt) {
      return;
    }
    if (session.resumeDeniedAt) {
      throw new HttpException(
        {
          code: 'RESUME_DENIED',
          message: 'Your resume request was denied by your instructor. Contact them for help.',
        },
        HttpStatus.LOCKED,
      );
    }
    throw new HttpException(
      {
        code: 'RESUME_PENDING',
        message: 'Your session was interrupted and is paused. An instructor must approve you before you can resume.',
      },
      HttpStatus.LOCKED,
    );
  }

  private resumeApprovalRequiredFor(exam: {
    resumeApprovalRequired: boolean;
    resumePolicy: ExamResumePolicy;
    connectionLossPolicy: ExamConnectionLossPolicy;
  }) {
    return (
      exam.resumeApprovalRequired ||
      exam.resumePolicy === ExamResumePolicy.INSTRUCTOR_APPROVAL ||
      exam.resumePolicy === ExamResumePolicy.ADMIN_APPROVAL ||
      exam.connectionLossPolicy === ExamConnectionLossPolicy.APPROVAL_REQUIRED ||
      exam.connectionLossPolicy === ExamConnectionLossPolicy.MARK_REVIEW
    );
  }

  async saveAnswer(sessionId: string, studentId: string, dto: SaveAnswerDto) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: sessionId, studentId },
      include: {
        exam: { select: { resumeApprovalRequired: true, resumePolicy: true, connectionLossPolicy: true } },
      },
    });
    if (!session || !([SessionStatus.IN_PROGRESS, SessionStatus.PAUSED] as SessionStatus[]).includes(session.status)) {
      throw new ForbiddenException('Session is not active');
    }
    await this.assertResumeAllowed(session);

    const answer = await this.prisma.studentAnswer.upsert({
      where: { sessionId_questionId: { sessionId, questionId: dto.questionId } },
      update: {
        selectedOptionIds: JSON.stringify(dto.selectedOptionIds ?? []),
        answerText: dto.answerText,
        answerJson: dto.answerJson !== undefined ? JSON.stringify(dto.answerJson) : undefined,
        isBookmarked: dto.isBookmarked ?? false,
        isMarkedForReview: dto.isMarkedForReview ?? false,
        savedAt: new Date(),
      },
      create: {
        sessionId,
        questionId: dto.questionId,
        selectedOptionIds: JSON.stringify(dto.selectedOptionIds ?? []),
        answerText: dto.answerText,
        answerJson: dto.answerJson !== undefined ? JSON.stringify(dto.answerJson) : undefined,
        isBookmarked: dto.isBookmarked ?? false,
        isMarkedForReview: dto.isMarkedForReview ?? false,
      },
    });

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        remainingSeconds: dto.remainingSeconds ?? session.remainingSeconds,
        currentQuestionId: dto.questionId,
        currentQuestionIndex: dto.currentQuestionIndex ?? session.currentQuestionIndex,
        lastActivityAt: new Date(),
      },
    });

    return answer;
  }

  async logViolation(sessionId: string, studentId: string, dto: LogViolationDto) {
    const session = await this.prisma.examSession.findFirst({ where: { id: sessionId, studentId } });
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }
    const result = await this.monitoring.recordViolation(session.examId, sessionId, studentId, dto);
    return result.violation;
  }

  async permitRetake(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }
    if (!([SessionStatus.SUBMITTED, SessionStatus.AUTO_SUBMITTED] as SessionStatus[]).includes(session.status)) {
      throw new ForbiddenException('Can only permit retake for submitted sessions');
    }
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { retakePermitted: true },
    });
  }

  async revokeRetake(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }
    return this.prisma.examSession.update({
      where: { id: sessionId },
      data: { retakePermitted: false },
    });
  }

  async getExamIdForSession(sessionId: string): Promise<string> {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { examId: true },
    });
    if (!session) throw new NotFoundException('Exam session not found');
    return session.examId;
  }

  private sessionInclude() {
    return {
      exam: {
        include: {
          questions: {
            orderBy: { sortOrder: 'asc' },
            include: { question: { include: { options: { orderBy: { sortOrder: 'asc' } } } } },
          },
        },
      },
      answers: true,
      violations: true,
    } as const;
  }

  private sanitizeSession(session: { exam: { questions: Array<{ question: { options: Array<{ isCorrect: boolean }> } }> } } & Record<string, unknown>) {
    return {
      ...session,
      exam: {
        ...session.exam,
        questions: session.exam.questions.map((examQuestion) => ({
          ...examQuestion,
          question: {
            ...examQuestion.question,
            options: examQuestion.question.options.map(({ isCorrect: _isCorrect, ...option }) => option),
          },
        })),
      },
    };
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }
}
