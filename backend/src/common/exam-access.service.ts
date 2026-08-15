import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExamPermissionLevel, RoleName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './types/authenticated-user.type';

const ADMIN_ROLES = [RoleName.SUPER_ADMIN, RoleName.ADMIN];

export const PERMISSION_LEVEL_RANK: Record<ExamPermissionLevel, number> = {
  VIEWER: 1,
  MONITOR: 2,
  PROCTOR: 3,
  CO_OWNER: 4,
};

// Monitoring actions -> minimum permission level required.
export const ACTION_LEVEL: Record<string, ExamPermissionLevel> = {
  warning: ExamPermissionLevel.PROCTOR,
  message: ExamPermissionLevel.PROCTOR,
  note: ExamPermissionLevel.VIEWER,
  pause: ExamPermissionLevel.PROCTOR,
  resume: ExamPermissionLevel.PROCTOR,
  extend: ExamPermissionLevel.CO_OWNER,
  force_submit: ExamPermissionLevel.CO_OWNER,
  disconnect: ExamPermissionLevel.CO_OWNER,
};

@Injectable()
export class ExamAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.roles.some((role) => ADMIN_ROLES.some((admin) => admin === role));
  }

  async getPermissionLevel(examId: string, userId: string): Promise<ExamPermissionLevel | null> {
    const share = await this.prisma.examShare.findUnique({
      where: { examId_instructorId: { examId, instructorId: userId } },
      select: { permissionLevel: true },
    });
    return share?.permissionLevel ?? null;
  }

  async isOwner(examId: string, userId: string): Promise<boolean> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { createdById: true },
    });
    return !!exam && exam.createdById === userId;
  }

  async hasAtLeast(examId: string, user: AuthenticatedUser, level: ExamPermissionLevel): Promise<boolean> {
    if (this.isAdmin(user)) return true;
    if (await this.isOwner(examId, user.sub)) return true;
    const granted = await this.getPermissionLevel(examId, user.sub);
    if (!granted) return false;
    return PERMISSION_LEVEL_RANK[granted] >= PERMISSION_LEVEL_RANK[level];
  }

  async canMonitor(examId: string, user: AuthenticatedUser): Promise<boolean> {
    if (this.isAdmin(user)) return true;
    if (await this.isOwner(examId, user.sub)) return true;
    return (await this.getPermissionLevel(examId, user.sub)) !== null;
  }

  async assertCanMonitor(examId: string, user: AuthenticatedUser): Promise<void> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, createdById: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (this.isAdmin(user) || exam.createdById === user.sub) return;
    const share = await this.prisma.examShare.findUnique({
      where: { examId_instructorId: { examId, instructorId: user.sub } },
      select: { id: true },
    });
    if (!share) {
      throw new ForbiddenException('You do not have access to monitor this exam');
    }
  }

  async assertCanMonitorSession(sessionId: string, user: AuthenticatedUser): Promise<void> {
    const session = await this.prisma.examSession.findUnique({
      where: { id: sessionId },
      select: { examId: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.assertCanMonitor(session.examId, user);
  }

  async assertCanAct(examId: string, user: AuthenticatedUser, level: ExamPermissionLevel): Promise<void> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, createdById: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (this.isAdmin(user) || exam.createdById === user.sub) return;
    const granted = await this.getPermissionLevel(examId, user.sub);
    if (!granted || PERMISSION_LEVEL_RANK[granted] < PERMISSION_LEVEL_RANK[level]) {
      throw new ForbiddenException(`This action requires ${level} access or higher on the exam`);
    }
  }

  async assertCanPerformAction(examId: string, user: AuthenticatedUser, action: string): Promise<void> {
    const required = ACTION_LEVEL[action];
    if (!required) throw new ForbiddenException('Unknown monitoring action');
    await this.assertCanAct(examId, user, required);
  }

  async assertCanManage(examId: string, user: AuthenticatedUser): Promise<void> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, createdById: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (this.isAdmin(user) || exam.createdById === user.sub) return;
    const granted = await this.getPermissionLevel(examId, user.sub);
    if (!granted || PERMISSION_LEVEL_RANK[granted] < PERMISSION_LEVEL_RANK[ExamPermissionLevel.CO_OWNER]) {
      throw new ForbiddenException('This action requires CO_OWNER access or higher on the exam');
    }
  }
}
