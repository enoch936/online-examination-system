import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../websocket/realtime.gateway';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

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
      select: {
        id: true,
        name: true,
        email: true,
        message: true,
        status: true,
        createdAt: true,
      },
    });
    created.then((message) => {
      this.gateway.emitToStaff('message:new', { source: 'CONTACT', ...message });
    }).catch(() => undefined);
    return created;
  }

  findMany(status?: string) {
    return this.prisma.contactMessage.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);
    return this.prisma.contactMessage.update({
      where: { id },
      data: { status },
    });
  }
}
