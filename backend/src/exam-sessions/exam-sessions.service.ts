import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExamStatus, SessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LogViolationDto } from './dto/log-violation.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';

@Injectable()
export class ExamSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async startExam(examId: string, studentId: string) {
    const existing = await this.prisma.examSession.findFirst({
      where: { examId, studentId, status: { in: [SessionStatus.IN_PROGRESS, SessionStatus.PAUSED] } },
      include: this.sessionInclude(),
    });
    if (existing) {
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
    if (!([ExamStatus.PUBLISHED, ExamStatus.LIVE] as ExamStatus[]).includes(exam.status)) {
      throw new ForbiddenException('Exam is not available');
    }

    const attemptsUsed = await this.prisma.examSession.count({ where: { examId, studentId } });
    if (attemptsUsed >= exam.attemptsAllowed) {
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
      },
      include: this.sessionInclude(),
    });

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
    return this.sanitizeSession(session);
  }

  async saveAnswer(sessionId: string, studentId: string, dto: SaveAnswerDto) {
    const session = await this.prisma.examSession.findFirst({ where: { id: sessionId, studentId } });
    if (!session || !([SessionStatus.IN_PROGRESS, SessionStatus.PAUSED] as SessionStatus[]).includes(session.status)) {
      throw new ForbiddenException('Session is not active');
    }

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
      },
    });

    return answer;
  }

  async logViolation(sessionId: string, studentId: string, dto: LogViolationDto) {
    const session = await this.prisma.examSession.findFirst({ where: { id: sessionId, studentId } });
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }
    return this.prisma.examViolation.create({
      data: {
        sessionId,
        type: dto.type,
        severity: dto.severity ?? 1,
        details: dto.details ? JSON.stringify(dto.details) : null,
      },
    });
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
