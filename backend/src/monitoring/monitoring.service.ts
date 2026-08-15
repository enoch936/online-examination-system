import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { ExamEventType, NotificationType, RiskLevel, SessionStatus, ViolationType } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../websocket/realtime.gateway';
import { InstructorActionDto } from './dto/instructor-action.dto';
import { RiskEngine } from './risk.engine';

const VIOLATION_TO_EVENT: Record<ViolationType, ExamEventType> = {
  TAB_SWITCH: ExamEventType.TAB_SWITCHED,
  WINDOW_BLUR: ExamEventType.WINDOW_BLURRED,
  FULLSCREEN_EXIT: ExamEventType.FULLSCREEN_EXITED,
  COPY_PASTE: ExamEventType.COPY_ATTEMPT,
  MULTIPLE_FACE_READY: ExamEventType.MULTIPLE_FACES_DETECTED,
  NO_FACE_READY: ExamEventType.FACE_NOT_DETECTED,
  HEARTBEAT_MISSED: ExamEventType.CONNECTION_LOST,
  NETWORK_INTERRUPTION: ExamEventType.CONNECTION_LOST,
  MANUAL_FLAG: ExamEventType.MANUAL_FLAG,
};

const STUDENT_GENERATED_EVENTS = new Set<ExamEventType>([
  ExamEventType.QUESTION_VIEWED,
  ExamEventType.QUESTION_ANSWERED,
  ExamEventType.QUESTION_FLAGGED,
  ExamEventType.WINDOW_FOCUSED,
  ExamEventType.FULLSCREEN_ENTERED,
  ExamEventType.COPY_ATTEMPT,
  ExamEventType.PASTE_ATTEMPT,
  ExamEventType.CUT_ATTEMPT,
  ExamEventType.PRINT_ATTEMPT,
  ExamEventType.CONTEXT_MENU_ATTEMPT,
  ExamEventType.SHORTCUT_ATTEMPT,
  ExamEventType.CAMERA_CONNECTED,
  ExamEventType.CAMERA_DISCONNECTED,
  ExamEventType.MIC_CONNECTED,
  ExamEventType.MIC_DISCONNECTED,
  ExamEventType.FACE_DETECTED,
  ExamEventType.FACE_NOT_DETECTED,
  ExamEventType.MULTIPLE_FACES_DETECTED,
  ExamEventType.MOTION_DETECTED,
  ExamEventType.AUDIO_ACTIVITY,
  ExamEventType.AI_SIGNAL,
  ExamEventType.MANUAL_FLAG,
]);

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: RiskEngine,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => RealtimeGateway)) private readonly gateway: RealtimeGateway,
  ) {}

  private lastStatsAt = new Map<string, number>();

  async getConfig(examId: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) throw new NotFoundException('Exam not found');
    const stored = await this.prisma.examMonitoringConfig.findUnique({ where: { examId } });
    return this.mergeConfig(stored);
  }

  async getStudentRequirements(examId: string) {
    const config = await this.getConfig(examId);
    return {
      examId,
      webcamEnabled: config.webcamEnabled,
      micEnabled: config.micEnabled,
      screenMonitoring: config.screenMonitoring,
      recordingEnabled: config.recordingEnabled,
      aiDetectionEnabled: config.aiDetectionEnabled,
      eventLoggingEnabled: config.eventLoggingEnabled,
      requireConsent: config.requireConsent,
    };
  }

  async saveConfig(examId: string, dto: Record<string, unknown>) {
    const exam = await this.prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) throw new NotFoundException('Exam not found');

    const stored = await this.prisma.examMonitoringConfig.findUnique({ where: { examId } });
    const merged = this.mergeConfig(stored);
    const nextWeights = { ...merged.weights, ...(dto.weights as Record<string, number> | undefined) };
    const nextThresholds = { ...merged.thresholds, ...(dto.thresholds as Record<string, number> | undefined) };

    const data = {
      webcamEnabled: (dto.webcamEnabled as boolean | undefined) ?? stored?.webcamEnabled ?? false,
      micEnabled: (dto.micEnabled as boolean | undefined) ?? stored?.micEnabled ?? false,
      screenMonitoring: (dto.screenMonitoring as boolean | undefined) ?? stored?.screenMonitoring ?? false,
      recordingEnabled: (dto.recordingEnabled as boolean | undefined) ?? stored?.recordingEnabled ?? false,
      aiDetectionEnabled: (dto.aiDetectionEnabled as boolean | undefined) ?? stored?.aiDetectionEnabled ?? false,
      eventLoggingEnabled: (dto.eventLoggingEnabled as boolean | undefined) ?? stored?.eventLoggingEnabled ?? true,
      requireConsent: (dto.requireConsent as boolean | undefined) ?? stored?.requireConsent ?? true,
      weights: JSON.stringify(nextWeights),
      thresholds: JSON.stringify(nextThresholds),
    };

    const saved = await this.prisma.examMonitoringConfig.upsert({
      where: { examId },
      update: data,
      create: { examId, ...data },
    });

    this.gateway.emitToExam(examId, 'monitor:config-updated', { examId, config: this.mergeConfig(saved) });
    return this.mergeConfig(saved);
  }

  private mergeConfig(stored?: {
    webcamEnabled: boolean;
    micEnabled: boolean;
    screenMonitoring: boolean;
    recordingEnabled: boolean;
    aiDetectionEnabled: boolean;
    eventLoggingEnabled: boolean;
    requireConsent: boolean;
    weights: string;
    thresholds: string;
  } | null) {
    return {
      webcamEnabled: stored?.webcamEnabled ?? false,
      micEnabled: stored?.micEnabled ?? false,
      screenMonitoring: stored?.screenMonitoring ?? false,
      recordingEnabled: stored?.recordingEnabled ?? false,
      aiDetectionEnabled: stored?.aiDetectionEnabled ?? false,
      eventLoggingEnabled: stored?.eventLoggingEnabled ?? true,
      requireConsent: stored?.requireConsent ?? true,
      weights: this.risk.weights(stored?.weights),
      thresholds: this.risk.thresholds(stored?.thresholds),
    };
  }

  async recordEvent(input: {
    examId?: string;
    sessionId: string;
    studentId?: string;
    type: ExamEventType;
    metadata?: Record<string, unknown>;
    riskScore?: number;
    asStudent?: boolean;
  }) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: input.sessionId },
      include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!session) throw new NotFoundException('Exam session not found');
    if (input.studentId && session.studentId !== input.studentId) {
      throw new BadRequestException('Session does not belong to this user');
    }
    if (input.asStudent && !STUDENT_GENERATED_EVENTS.has(input.type)) {
      throw new BadRequestException(`Event type ${input.type} is not student-generatable`);
    }

    const config = await this.getConfig(session.examId);
    const points = input.riskScore ?? this.risk.weight(input.type, config.weights);
    const severity = this.risk.classify(points, config.thresholds);

    const event = await this.prisma.examEvent.create({
      data: {
        examId: session.examId,
        sessionId: session.id,
        studentId: session.studentId,
        type: input.type,
        riskScore: points,
        severity,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    await this.recomputeSessionRisk(session.id, config);
    this.emitEvent(session.examId, session.id, session.student, input.type, event, points, severity, config);
    return event;
  }

  async recordViolation(
    examId: string,
    sessionId: string,
    studentId: string,
    payload: { type: ViolationType; severity?: number; details?: unknown },
  ) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!session) throw new NotFoundException('Exam session not found');
    if (session.studentId !== studentId) throw new BadRequestException('Session does not belong to this user');

    const config = await this.getConfig(session.examId);
    const eventType = VIOLATION_TO_EVENT[payload.type];
    const points = this.risk.weight(eventType, config.weights);
    const severity = this.risk.classify(points, config.thresholds);

    const violation = await this.prisma.examViolation.create({
      data: {
        sessionId,
        type: payload.type,
        severity: payload.severity ?? 1,
        details: payload.details ? JSON.stringify(payload.details) : null,
      },
    });

    const event = await this.prisma.examEvent.create({
      data: {
        examId: session.examId,
        sessionId: session.id,
        studentId: session.studentId,
        type: eventType,
        riskScore: points,
        severity,
        metadata: JSON.stringify({
          violationId: violation.id,
          violationType: payload.type,
          details: payload.details ?? null,
        }),
      },
    });

    await this.recomputeSessionRisk(session.id, config);
    this.emitEvent(session.examId, session.id, session.student, eventType, event, points, severity, config);
    this.broadcastStatsThrottled(session.examId);
    return { violation, event };
  }

  async recordHeartbeat(
    sessionId: string,
    payload: { remainingSeconds?: number; currentQuestionId?: string; currentQuestionIndex?: number; studentId?: string },
  ) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        exam: { select: { id: true, status: true } },
      },
    });
    if (!session) return null;
    if (payload.studentId && session.studentId !== payload.studentId) return null;

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        lastHeartbeatAt: new Date(),
        heartbeatCount: { increment: 1 },
        lastActivityAt: new Date(),
        connectionState: 'CONNECTED',
        remainingSeconds: payload.remainingSeconds ?? session.remainingSeconds,
        currentQuestionId: payload.currentQuestionId ?? session.currentQuestionId,
        currentQuestionIndex: payload.currentQuestionIndex ?? session.currentQuestionIndex,
      },
    });

    const snapshot = await this.snapshot(sessionId);
    if (snapshot) this.gateway.emitToExam(session.examId, 'monitor:candidate-update', snapshot);
    return snapshot;
  }

  async setConnection(sessionId: string, state: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING', reason?: string) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        exam: { select: { id: true, status: true } },
      },
    });
    if (!session) return null;
    if (session.submittedAt || session.status === SessionStatus.SUBMITTED || session.status === SessionStatus.AUTO_SUBMITTED) return null;

    const wasConnected = session.connectionState === 'CONNECTED';

    await this.prisma.examSession.update({
      where: { id: sessionId },
      data: {
        connectionState: state,
        ...(state === 'CONNECTED' ? { lastHeartbeatAt: new Date(), heartbeatCount: { increment: 1 } } : {}),
        ...(state === 'DISCONNECTED' ? { disconnectCount: { increment: 1 } } : {}),
      },
    });

    if (state === 'DISCONNECTED' && wasConnected) {
      const config = await this.getConfig(session.examId);
      const points = this.risk.weight(ExamEventType.CONNECTION_LOST, config.weights);
      const severity = this.risk.classify(points, config.thresholds);
      const event = await this.prisma.examEvent.create({
        data: {
          examId: session.examId,
          sessionId,
          studentId: session.studentId,
          type: ExamEventType.CONNECTION_LOST,
          riskScore: points,
          severity,
          metadata: JSON.stringify({ reason: reason ?? 'socket disconnected' }),
        },
      });
      await this.recomputeSessionRisk(sessionId, config);
      this.emitEvent(session.examId, sessionId, session.student, ExamEventType.CONNECTION_LOST, event, points, severity, config, true);
    } else if (state === 'CONNECTED' && !wasConnected) {
      const config = await this.getConfig(session.examId);
      const event = await this.prisma.examEvent.create({
        data: {
          examId: session.examId,
          sessionId,
          studentId: session.studentId,
          type: ExamEventType.CONNECTION_RESTORED,
          riskScore: 0,
          severity: RiskLevel.LOW,
          metadata: JSON.stringify({ reason: reason ?? 'socket reconnected' }),
        },
      });
      await this.recomputeSessionRisk(sessionId, config);
      this.gateway.emitToExam(session.examId, 'monitor:event', {
        ...event,
        metadata: event.metadata ? JSON.parse(event.metadata) : null,
        student: session.student,
      });
      this.emitAlert(session.examId, session.student, 'CONNECTION_RESTORED', 'RECOVERED', 'Connection restored.');
    }

    const snapshot = await this.snapshot(sessionId);
    if (snapshot) this.gateway.emitToExam(session.examId, 'monitor:candidate-update', snapshot);
    this.broadcastStatsThrottled(session.examId);
    return snapshot;
  }

  private async recomputeSessionRisk(sessionId: string, config?: ReturnType<MonitoringService['mergeConfig']>) {
    const agg = await this.prisma.examEvent.aggregate({
      where: { sessionId },
      _sum: { riskScore: true },
    });
    const total = Math.min(100, Math.round(agg._sum.riskScore ?? 0));
    const cfg = config ?? (await this.getConfigFromSession(sessionId));
    const level = this.risk.classify(total, cfg.thresholds);
    await this.prisma.examSession.update({ where: { id: sessionId }, data: { riskScore: total, riskLevel: level } });
    return { score: total, level };
  }

  private async getConfigFromSession(sessionId: string) {
    const session = await this.prisma.examSession.findUnique({ where: { id: sessionId }, select: { examId: true } });
    if (!session) return this.mergeConfig(undefined);
    return this.getConfig(session.examId);
  }

  private emitEvent(
    examId: string,
    sessionId: string,
    student: { id: string; firstName: string; lastName: string; email: string },
    type: ExamEventType,
    event: { id: string; type: ExamEventType; timestamp: Date; riskScore: number; severity: RiskLevel; acknowledgedAt: Date | null; acknowledgedBy: string | null; note: string | null },
    points: number,
    severity: RiskLevel,
    config: ReturnType<MonitoringService['mergeConfig']>,
    forceAlert = false,
  ) {
    this.gateway.emitToExam(examId, 'monitor:event', { ...event, student });

    const snapshotPromise = this.snapshot(sessionId);
    snapshotPromise.then((snapshot) => {
      if (snapshot) this.gateway.emitToExam(examId, 'monitor:candidate-update', snapshot);
    });

    if (forceAlert || severity === RiskLevel.HIGH || severity === RiskLevel.CRITICAL || type === ExamEventType.MANUAL_FLAG) {
      this.emitAlert(examId, student, type, severity, this.alertMessage(type, student));
    }
    this.broadcastStatsThrottled(examId);
  }

  private alertMessage(type: ExamEventType, student: { firstName: string; lastName: string }) {
    const label = student.firstName ? `${student.firstName} ${student.lastName}` : 'Student';
    const messages: Partial<Record<ExamEventType, string>> = {
      TAB_SWITCHED: 'switched tabs',
      WINDOW_BLURRED: 'window lost focus',
      FULLSCREEN_EXITED: 'exited fullscreen',
      COPY_ATTEMPT: 'attempted to copy content',
      PASTE_ATTEMPT: 'attempted to paste content',
      CUT_ATTEMPT: 'attempted to cut content',
      PRINT_ATTEMPT: 'attempted to print',
      CONTEXT_MENU_ATTEMPT: 'opened context menu',
      SHORTCUT_ATTEMPT: 'triggered a keyboard shortcut',
      CAMERA_DISCONNECTED: 'camera disconnected',
      MIC_DISCONNECTED: 'microphone disconnected',
      FACE_NOT_DETECTED: 'face not detected',
      MULTIPLE_FACES_DETECTED: 'multiple faces detected',
      MOTION_DETECTED: 'excessive movement detected',
      AUDIO_ACTIVITY: 'unusual audio activity',
      AI_SIGNAL: 'AI analysis flagged a signal',
      MANUAL_FLAG: 'was flagged for review',
      CONNECTION_LOST: 'lost connection',
      SESSION_DISCONNECTED: 'was disconnected by instructor',
    };
    return messages[type] ? `${label} ${messages[type]}.` : `${label}: ${type.replace(/_/g, ' ').toLowerCase()}.`;
  }

  private emitAlert(
    examId: string,
    student: { id: string; firstName: string; lastName: string; email: string },
    type: string,
    severity: string,
    message: string,
  ) {
    this.gateway.emitToExam(examId, 'monitor:alert', {
      studentId: student.id,
      student: `${student.firstName} ${student.lastName}`,
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  async snapshot(sessionId: string) {
    const s = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        answers: { select: { questionId: true, selectedOptionIds: true, answerText: true, answerJson: true, isMarkedForReview: true } },
        submission: { select: { submittedAt: true, status: true } },
        exam: { select: { id: true, _count: { select: { questions: true } } } },
        _count: { select: { violations: true } },
      },
    });
    if (!s) return null;

    const totalQuestions = s.exam._count.questions;
    const answeredCount = s.answers.filter((a) => this.isAnswered(a)).length;
    const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
    const reportCount = await this.prisma.examEvent.count({
      where: { sessionId: s.id, type: ExamEventType.MANUAL_FLAG },
    });

    return {
      sessionId: s.id,
      examId: s.exam.id,
      studentId: s.student.id,
      student: s.student,
      status: s.status,
      connectionState: s.connectionState,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt ?? s.submission?.submittedAt ?? null,
      expiresAt: s.expiresAt,
      remainingSeconds: s.remainingSeconds,
      lastHeartbeatAt: s.lastHeartbeatAt,
      lastActivityAt: s.lastActivityAt,
      currentQuestionId: s.currentQuestionId,
      currentQuestionIndex: s.currentQuestionIndex,
      answeredCount,
      totalQuestions,
      unansweredCount: Math.max(0, totalQuestions - answeredCount),
      flaggedCount: s.answers.filter((a) => a.isMarkedForReview).length,
      progress,
      riskScore: s.riskScore,
      riskLevel: s.riskLevel,
      violationsCount: s._count.violations,
      reportCount,
    };
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

  async listSessions(examId: string) {
    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      select: { id: true },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
    const snapshots: Array<Record<string, unknown> | null> = [];
    for (const { id } of sessions) {
      snapshots.push(await this.snapshot(id));
    }
    return snapshots.filter((s): s is Record<string, unknown> => s !== null);
  }

  emitSessionControl(sessionId: string, payload: Record<string, unknown>) {
    this.gateway.emitToSession(sessionId, 'exam:control', payload);
  }

  async getLiveStats(examId: string) {
    const config = await this.getConfig(examId);
    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      select: {
        status: true,
        connectionState: true,
        submittedAt: true,
        riskLevel: true,
        remainingSeconds: true,
        disconnectCount: true,
        answers: { select: { selectedOptionIds: true, answerText: true, answerJson: true } },
        exam: { select: { _count: { select: { questions: true } } } },
      },
    });

    const total = sessions.length;
    const submitted = sessions.filter(
      (s) => s.submittedAt || s.status === SessionStatus.SUBMITTED || s.status === SessionStatus.AUTO_SUBMITTED,
    ).length;
    const active = sessions.filter(
      (s) =>
        !(s.submittedAt || s.status === SessionStatus.SUBMITTED || s.status === SessionStatus.AUTO_SUBMITTED) &&
        (s.status === SessionStatus.IN_PROGRESS || s.status === SessionStatus.PAUSED),
    );
    const online = active.filter((s) => s.connectionState === 'CONNECTED').length;
    const disconnected = active.filter((s) => s.connectionState === 'DISCONNECTED' || s.connectionState === 'RECONNECTING').length;
    const atRisk = active.filter((s) => s.riskLevel === RiskLevel.HIGH || s.riskLevel === RiskLevel.CRITICAL).length;
    const warning = active.filter((s) => s.riskLevel === RiskLevel.MEDIUM).length;
    const critical = active.filter((s) => s.riskLevel === RiskLevel.CRITICAL).length;

    let completionSum = 0;
    let completionCount = 0;
    let remainingSum = 0;
    for (const s of active) {
      const q = s.exam._count.questions;
      if (q > 0) {
        completionSum += Math.min(100, Math.round((s.answers.filter((a) => this.isAnswered(a)).length / q) * 100));
        completionCount++;
      }
      remainingSum += s.remainingSeconds ?? 0;
    }

    const suspiciousEvents = await this.prisma.examEvent.count({ where: { examId, riskScore: { gt: 0 } } });
    const connectionFailures = sessions.reduce((sum, s) => sum + s.disconnectCount, 0);

    return {
      examId,
      total,
      active: active.length,
      online,
      submitted,
      atRisk,
      warning,
      critical,
      disconnected,
      avgCompletion: completionCount > 0 ? Math.round(completionSum / completionCount) : 0,
      avgRemainingSeconds: active.length > 0 ? Math.round(remainingSum / active.length) : 0,
      submissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
      connectionFailures,
      suspiciousEvents,
      thresholds: config.thresholds,
    };
  }

  private async broadcastStatsThrottled(examId: string) {
    const now = Date.now();
    const last = this.lastStatsAt.get(examId) ?? 0;
    if (now - last < 3000) return;
    this.lastStatsAt.set(examId, now);
    try {
      const stats = await this.getLiveStats(examId);
      this.gateway.emitToExam(examId, 'monitor:stats', stats);
    } catch {
      /* ignore transient stats errors */
    }
  }

  async getTimeline(sessionId: string) {
    const [events, violations] = await Promise.all([
      this.prisma.examEvent.findMany({ where: { sessionId }, orderBy: { timestamp: 'desc' }, take: 500 }),
      this.prisma.examViolation.findMany({ where: { sessionId }, orderBy: { occurredAt: 'desc' }, take: 500 }),
    ]);

    const timeline = [
      ...events.map((e) => ({
        id: e.id,
        kind: 'event',
        type: e.type,
        timestamp: e.timestamp,
        riskScore: e.riskScore,
        severity: e.severity,
        metadata: this.tryParse(e.metadata),
        acknowledgedAt: e.acknowledgedAt,
        acknowledgedBy: e.acknowledgedBy,
        note: e.note,
      })),
      ...violations.map((v) => ({
        id: v.id,
        kind: 'violation',
        type: v.type,
        timestamp: v.occurredAt,
        severity: v.severity,
        metadata: this.tryParse(v.details),
        acknowledgedAt: null,
        acknowledgedBy: null,
        note: null,
      })),
    ];

    return timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async acknowledgeEvent(eventId: string, instructorId: string, note?: string) {
    const event = await this.prisma.examEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const updated = await this.prisma.examEvent.update({
      where: { id: eventId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: instructorId,
        ...(note !== undefined ? { note } : {}),
      },
    });
    this.gateway.emitToExam(event.examId, 'monitor:event-ack', updated);
    return updated;
  }

  async getQuestionActivity(examId: string, questionId: string) {
    const sessions = await this.prisma.examSession.findMany({
      where: { examId },
      select: { id: true, status: true, submittedAt: true },
    });
    const sessionIds = sessions
      .filter((s) => !(s.submittedAt || s.status === SessionStatus.SUBMITTED || s.status === SessionStatus.AUTO_SUBMITTED))
      .map((s) => s.id);

    const [answers, flags] = await Promise.all([
      this.prisma.studentAnswer.findMany({
        where: { sessionId: { in: sessionIds }, questionId },
        select: { selectedOptionIds: true, answerText: true, answerJson: true },
      }),
      this.prisma.studentAnswer.count({
        where: { sessionId: { in: sessionIds }, questionId, isMarkedForReview: true },
      }),
    ]);

    const answered = answers.filter((a) => this.isAnswered(a)).length;
    return {
      questionId,
      examId,
      activeSessions: sessionIds.length,
      answered,
      unanswered: Math.max(0, sessionIds.length - answered),
      flagged: flags,
      avgResponseSeconds: null,
    };
  }

  async getSessionExamId(sessionId: string): Promise<string> {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { examId: true },
    });
    if (!session) throw new NotFoundException('Exam session not found');
    return session.examId;
  }

  async instructorAction(instructorId: string, sessionId: string, dto: InstructorActionDto) {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        exam: { select: { id: true, title: true } },
      },
    });
    if (!session) throw new NotFoundException('Exam session not found');

    const { action, message, minutes } = dto;
    const studentName = `${session.student.firstName} ${session.student.lastName}`;
    const studentId = session.studentId;

    switch (action) {
      case 'warning':
      case 'message': {
        if (!message) throw new BadRequestException('message is required for warning/message');
        await this.prisma.notification.create({
          data: {
            userId: studentId,
            type: action === 'warning' ? NotificationType.WARNING : NotificationType.INFO,
            title: action === 'warning' ? 'Exam warning' : 'Message from proctor',
            message,
            metadata: JSON.stringify({ examId: session.examId, sessionId: session.id, fromInstructorId: instructorId }),
          },
        });
        await this.recordInstructorEvent(session, action === 'warning' ? 'WARNING_SENT' : 'NOTE_ADDED', { message, note: message });
        this.gateway.emitToSession(session.id, 'exam:control', {
          type: action === 'warning' ? 'warning' : 'message',
          message,
          title: action === 'warning' ? 'Exam warning' : 'Message from proctor',
        });
        break;
      }
      case 'pause': {
        if (session.status === SessionStatus.PAUSED) break;
        await this.prisma.examSession.update({ where: { id: sessionId }, data: { status: SessionStatus.PAUSED } });
        await this.recordInstructorEvent(session, 'PAUSED', {});
        this.gateway.emitToSession(session.id, 'exam:control', { type: 'pause' });
        break;
      }
      case 'resume': {
        if (session.status !== SessionStatus.PAUSED) throw new BadRequestException('Session is not paused');
        await this.prisma.examSession.update({ where: { id: sessionId }, data: { status: SessionStatus.IN_PROGRESS } });
        await this.recordInstructorEvent(session, 'RESUMED', {});
        this.gateway.emitToSession(session.id, 'exam:control', { type: 'resume' });
        break;
      }
      case 'extend': {
        if (!minutes) throw new BadRequestException('minutes is required for extend');
        const current = session.remainingSeconds ?? 0;
        const added = minutes * 60;
        const remainingSeconds = current + added;
        const expiresAt = new Date(
          (session.expiresAt?.getTime() ?? Date.now()) + added * 1000,
        );
        await this.prisma.examSession.update({
          where: { id: sessionId },
          data: { remainingSeconds, expiresAt },
        });
        await this.recordInstructorEvent(session, 'TIME_EXTENDED', { minutes });
        this.gateway.emitToSession(session.id, 'exam:control', { type: 'extend', minutes, remainingSeconds });
        break;
      }
      case 'force_submit': {
        if (session.submittedAt || session.status === SessionStatus.SUBMITTED || session.status === SessionStatus.AUTO_SUBMITTED) break;
        await this.prisma.examSession.update({
          where: { id: sessionId },
          data: { status: SessionStatus.SUBMITTED, submittedAt: new Date() },
        });
        await this.recordInstructorEvent(session, 'FORCE_SUBMITTED', {});
        this.gateway.emitToSession(session.id, 'exam:control', { type: 'force-submit' });
        break;
      }
      case 'disconnect': {
        await this.prisma.examSession.update({ where: { id: sessionId }, data: { connectionState: 'DISCONNECTED' } });
        await this.recordInstructorEvent(session, 'SESSION_DISCONNECTED', {});
        this.gateway.emitToSession(session.id, 'exam:control', { type: 'disconnect' });
        break;
      }
      case 'note': {
        await this.recordInstructorEvent(session, 'NOTE_ADDED', { note: message ?? null });
        break;
      }
    }

    await this.prisma.activityLog.create({
      data: {
        actorId: instructorId,
        examSessionId: session.id,
        action: `monitoring.${action}`,
        metadata: JSON.stringify({ action, message: message ?? null, minutes: minutes ?? null, studentId }),
      },
    });

    await this.audit.log(
      instructorId,
      'EXAM',
      session.examId,
      `MONITOR_${action.toUpperCase()}`,
      { after: JSON.stringify({ action, sessionId: session.id, studentId, studentName, message: message ?? null, minutes: minutes ?? null }) },
    );

    const snapshot = await this.snapshot(session.id);
    if (snapshot) this.gateway.emitToExam(session.examId, 'monitor:candidate-update', snapshot);
    this.broadcastStatsThrottled(session.examId);
    return snapshot ?? { sessionId };
  }

  private async recordInstructorEvent(
    session: { id: string; examId: string; studentId: string; student: { firstName: string; lastName: string } },
    type: ExamEventType,
    metadata: Record<string, unknown>,
  ) {
    const config = await this.getConfig(session.examId);
    const event = await this.prisma.examEvent.create({
      data: {
        examId: session.examId,
        sessionId: session.id,
        studentId: session.studentId,
        type,
        riskScore: 0,
        severity: RiskLevel.LOW,
        metadata: JSON.stringify({ instructor: true, ...metadata }),
      },
    });
    this.gateway.emitToExam(session.examId, 'monitor:event', { ...event, student: session.student });
    await this.recomputeSessionRisk(session.id, config);
  }

  private tryParse(value: string | null): unknown {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
