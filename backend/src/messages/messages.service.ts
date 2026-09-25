import { Injectable, NotFoundException } from '@nestjs/common';
import { ExamEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type MessageSource = 'CONTACT' | 'EXAM_REPORT';
export type MessageStatus = 'NEW' | 'READ' | 'RESOLVED';

export interface StudentMessage {
  id: string;
  source: MessageSource;
  name: string;
  email: string;
  message: string;
  status: MessageStatus;
  createdAt: Date;
  examId?: string;
  examTitle?: string;
  sessionId?: string;
  studentId?: string;
}

const KNOWN_STATUSES: MessageStatus[] = ['NEW', 'READ', 'RESOLVED'];

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filters: { examId?: string; source?: MessageSource }) {
    const [contacts, reports] = await Promise.all([
      this.findContacts(),
      this.findExamReports(filters.examId),
    ]);

    let messages: StudentMessage[];
    if (filters.source === 'CONTACT') {
      messages = contacts;
    } else if (filters.source === 'EXAM_REPORT') {
      messages = reports;
    } else {
      messages = [...contacts, ...reports];
    }

    return messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateStatus(id: string, source: MessageSource, status: string, actorId?: string) {
    const normalized: MessageStatus = KNOWN_STATUSES.includes(status as MessageStatus)
      ? (status as MessageStatus)
      : 'READ';

    if (source === 'CONTACT') {
      const exists = await this.prisma.contactMessage.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException('Message not found');
      return this.prisma.contactMessage.update({ where: { id }, data: { status: normalized } });
    }

    const event = await this.prisma.examEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Message not found');

    const data =
      normalized === 'NEW'
        ? { acknowledgedAt: null, acknowledgedBy: null, note: null }
        : normalized === 'RESOLVED'
          ? { acknowledgedAt: new Date(), acknowledgedBy: actorId ?? null, note: 'RESOLVED' }
          : { acknowledgedAt: new Date(), acknowledgedBy: actorId ?? null, note: null };

    return this.prisma.examEvent.update({ where: { id }, data });
  }

  private async findContacts(): Promise<StudentMessage[]> {
    const rows = await this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({
      id: row.id,
      source: 'CONTACT' as const,
      name: row.name,
      email: row.email,
      message: row.message,
      status: (KNOWN_STATUSES.includes(row.status as MessageStatus) ? row.status : 'NEW') as MessageStatus,
      createdAt: row.createdAt,
    }));
  }

  private async findExamReports(examId?: string): Promise<StudentMessage[]> {
    const events = await this.prisma.examEvent.findMany({
      where: {
        type: ExamEventType.MANUAL_FLAG,
        ...(examId ? { examId } : {}),
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        exam: { select: { id: true, title: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 300,
    });

    const messages: StudentMessage[] = [];
    for (const event of events) {
      const metadata = this.tryParse(event.metadata);
      const message = typeof metadata?.message === 'string' ? metadata.message.trim() : '';
      if (!message) continue;
      messages.push({
        id: event.id,
        source: 'EXAM_REPORT',
        name: [event.student.firstName, event.student.lastName].filter(Boolean).join(' '),
        email: event.student.email,
        message,
        status: event.note === 'RESOLVED' ? 'RESOLVED' : event.acknowledgedAt ? 'READ' : 'NEW',
        createdAt: event.timestamp,
        examId: event.examId,
        examTitle: event.exam.title,
        sessionId: event.sessionId,
        studentId: event.studentId,
      });
    }
    return messages;
  }

  private tryParse(value: string | null): Record<string, unknown> | null {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
