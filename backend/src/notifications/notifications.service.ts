import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../websocket/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async create(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = NotificationType.INFO,
    metadata?: Record<string, unknown>,
  ) {
    const record = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
    this.gateway.emitNotification(userId, { ...record, metadata: metadata ?? null });
    return record;
  }

  async notifyMany(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType = NotificationType.INFO,
    metadata?: Record<string, unknown>,
  ) {
    if (userIds.length === 0) return { count: 0 };
    const created = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title,
        message,
        type,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      })),
    });
    for (const userId of userIds) {
      this.gateway.emitNotification(userId, {
        userId,
        type,
        title,
        message,
        readAt: null,
        createdAt: new Date().toISOString(),
        metadata: metadata ?? null,
      });
    }
    return { count: created.count };
  }

  markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
