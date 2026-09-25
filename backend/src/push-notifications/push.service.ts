import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey?: string;
  private readonly privateKey?: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.publicKey = config.get<string>('VAPID_PUBLIC_KEY');
    this.privateKey = config.get<string>('VAPID_PRIVATE_KEY');
    const subject =
      config.get<string>('VAPID_SUBJECT') ?? 'mailto:no-reply@online-examination-system.local';
    if (this.publicKey && this.privateKey) {
      webpush.setVapidDetails(subject, this.publicKey, this.privateKey);
    }
  }

  get configured(): boolean {
    return Boolean(this.publicKey && this.privateKey);
  }

  get vapidPublicKey(): string | null {
    return this.publicKey ?? null;
  }

  async saveSubscription(userId: string, input: PushSubscriptionInput) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      },
      update: {
        userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  async removeSubscription(userId: string, endpoint: string) {
    const deleted = await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { removed: deleted.count };
  }

  async sendToUser(userId: string, title: string, message: string, metadata?: Record<string, unknown>) {
    if (!this.configured) return;
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ title, message, metadata: metadata ?? null });
    await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 60 * 60 * 24, urgency: 'high' },
          )
          .catch(async (err: unknown) => {
            const statusCode = (err as { statusCode?: number })?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await this.prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
              return undefined;
            }
            this.logger.warn(`push send failed (${statusCode ?? 'unknown'}): ${sub.endpoint}`);
            return undefined;
          }),
      ),
    );
  }
}