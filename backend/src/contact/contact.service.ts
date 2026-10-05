import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../websocket/realtime.gateway';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import {
  CONTACT_MESSAGE_STATUSES,
  ContactMessageStatus,
  ListContactMessagesDto,
} from './dto/list-contact-messages.dto';

const MESSAGE_SELECT = {
  id: true,
  name: true,
  email: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactMessageSelect;

type MessageCounts = Record<ContactMessageStatus, number>;

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
  ) {}

  create(dto: CreateContactMessageDto) {
    const created = this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        message: dto.message,
        status: 'NEW',
      },
      select: MESSAGE_SELECT,
    });
    created.then((message) => {
      this.gateway.emitToStaff('message:new', { source: 'CONTACT', ...message });
    }).catch(() => undefined);
    return created;
  }

  // One request powers the whole inbox: the page of rows, the total for
  // pagination, and the per-status tallies for the stat cards. Counts are
  // computed over the whole table (ignoring `q`/`status`) so the admin always
  // sees how much is waiting in each state, not just inside the active filter.
  findMany(filters: Partial<ListContactMessagesDto> = {}) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const q = filters.q?.trim();

    const where: Prisma.ContactMessageWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { message: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    return this.prisma.$transaction([
      this.prisma.contactMessage.count(),
      this.prisma.contactMessage.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: MESSAGE_SELECT,
      }),
    ]).then(([total, grouped, data]) => {
      const counts = Object.fromEntries(
        CONTACT_MESSAGE_STATUSES.map((status) => [status, 0]),
      ) as MessageCounts;
      for (const row of grouped) {
        if (row.status in counts) {
          counts[row.status as ContactMessageStatus] = row._count._all;
        }
      }

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          counts,
        },
      };
    });
  }

  async findOne(id: string) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id }, select: MESSAGE_SELECT });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }

  async updateStatus(id: string, status: ContactMessageStatus) {
    await this.findOne(id);
    return this.prisma.contactMessage.update({
      where: { id },
      data: { status },
      select: MESSAGE_SELECT,
    });
  }
}
