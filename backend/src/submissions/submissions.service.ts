import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { QuestionType, SessionStatus, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitExamDto } from './dto/submit-exam.dto';

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: SubmitExamDto, studentId: string) {
    const session = await this.prisma.examSession.findFirst({
      where: { id: dto.sessionId, studentId },
      include: {
        exam: {
          include: {
            questions: {
              include: { question: { include: { options: true } } },
            },
          },
        },
        answers: true,
        submission: true,
      },
    });
    if (!session) {
      throw new NotFoundException('Exam session not found');
    }
    if (session.submission) {
      return session.submission;
    }
    if (!([SessionStatus.IN_PROGRESS, SessionStatus.PAUSED] as SessionStatus[]).includes(session.status)) {
      throw new ForbiddenException('Session cannot be submitted');
    }

    const optionBasedTypes: QuestionType[] = [QuestionType.MULTIPLE_CHOICE, QuestionType.MULTIPLE_SELECT, QuestionType.TRUE_FALSE];
    const textBasedTypes: QuestionType[] = [QuestionType.FILL_BLANK, QuestionType.SHORT_ANSWER];
    let totalScore = 0;
    let needsManualGrading = false;
    const answerByQuestion = new Map(session.answers.map((answer) => [answer.questionId, answer]));

    const updates: Array<{ id: string; score: number }> = [];

    for (const examQuestion of session.exam.questions) {
      const question = examQuestion.question;
      const answer = answerByQuestion.get(question.id);
      let score = 0;

      if (optionBasedTypes.includes(question.type)) {
        const correctIds = question.options
          .filter((option) => option.isCorrect)
          .map((option) => option.id)
          .sort();
        let selectedIds: string[] = [];
        try {
          selectedIds = JSON.parse(answer?.selectedOptionIds ?? '[]');
        } catch {
          selectedIds = [];
        }
        selectedIds.sort();
        score = this.sameSet(correctIds, selectedIds) ? Number(examQuestion.points) : 0;
      } else if (textBasedTypes.includes(question.type)) {
        const correctAnswers = question.options
          .filter((o) => o.isCorrect)
          .map((o) => o.text.toLowerCase().trim());
        const studentAnswer = (answer?.answerText ?? '').toLowerCase().trim();
        score = correctAnswers.some((ca) => studentAnswer.includes(ca) || ca.includes(studentAnswer))
          ? Number(examQuestion.points)
          : 0;
      } else {
        needsManualGrading = true;
        continue;
      }

      totalScore += score;

      if (answer) {
        updates.push({ id: answer.id, score });
      }
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(
        updates.map((u) => this.prisma.studentAnswer.update({ where: { id: u.id }, data: { score: u.score } })),
      );
    }

    const maxScore = Number(session.exam.totalMarks);
    const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
    const isPassed = totalScore >= Number(session.exam.passingMarks);
    const status = needsManualGrading ? SubmissionStatus.NEEDS_MANUAL_GRADING : SubmissionStatus.GRADED;

    const submission = await this.prisma.submission.create({
      data: {
        sessionId: session.id,
        status,
        autoSubmitted: dto.autoSubmitted ?? false,
        totalScore,
        maxScore,
        percentage,
        isPassed,
        gradingCompletedAt: needsManualGrading ? null : new Date(),
        result: {
          create: {
            examId: session.examId,
            studentId,
            score: totalScore,
            maxScore,
            percentage,
            passed: isPassed,
            publishedAt: session.exam.showResultImmediately && !needsManualGrading ? new Date() : null,
          },
        },
      },
      include: { result: true },
    });

    await this.prisma.examSession.update({
      where: { id: session.id },
      data: {
        status: dto.autoSubmitted ? SessionStatus.AUTO_SUBMITTED : SessionStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    return submission;
  }

  private sameSet(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
}
