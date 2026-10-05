import { NotFoundException } from '@nestjs/common';
import { ContactService } from './contact.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { RealtimeGateway } from '../websocket/realtime.gateway';

/**
 * The contact inbox backing the admin "Contact Message" page. Two properties
 * are worth locking down: a filter must never leak rows from outside the
 * requested scope, and the per-status tallies must be computed across the whole
 * table so the admin still sees how much is waiting behind an active filter.
 */

type Row = { id: string; name: string; email: string; message: string; status: string };

function makeService(rows: Row[] = []) {
  const prisma = {
    contactMessage: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(rows),
      count: jest.fn().mockResolvedValue(rows.length),
      groupBy: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };
  // `$transaction([...])` resolves the array of promises it is handed.
  prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
  const gateway = { emitToStaff: jest.fn() } as unknown as RealtimeGateway;
  const service = new ContactService(prisma as unknown as PrismaService, gateway);
  return { service, prisma, gateway };
}

describe('ContactService.findMany', () => {
  it('returns an unfiltered first page by default', async () => {
    const { service, prisma } = makeService();

    const result = await service.findMany();

    expect(prisma.contactMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 20 }),
    );
    expect(result.pagination).toMatchObject({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('searches name, email and body case-insensitively', async () => {
    const { service, prisma } = makeService();

    await service.findMany({ q: 'ada' });

    expect(prisma.contactMessage.findMany.mock.calls[0][0].where.OR).toEqual([
      { name: { contains: 'ada', mode: 'insensitive' } },
      { email: { contains: 'ada', mode: 'insensitive' } },
      { message: { contains: 'ada', mode: 'insensitive' } },
    ]);
  });

  it('combines the search term with the status filter', async () => {
    const { service, prisma } = makeService();

    await service.findMany({ q: 'ada', status: 'NEW' });

    expect(prisma.contactMessage.findMany.mock.calls[0][0].where).toMatchObject({
      status: 'NEW',
      OR: expect.any(Array),
    });
  });

  it('translates the page into skip/take and derives totalPages', async () => {
    const { service, prisma } = makeService();
    prisma.contactMessage.count.mockResolvedValue(45);

    const result = await service.findMany({ page: 3, limit: 20 });

    expect(prisma.contactMessage.findMany.mock.calls[0][0]).toMatchObject({ skip: 40, take: 20 });
    expect(result.pagination).toMatchObject({ page: 3, limit: 20, total: 45, totalPages: 3 });
  });

  // A hostile or fat-fingered page/limit must not turn into an unbounded query.
  it.each([
    [0, 1],
    [-5, 1],
    [1, 5000],
  ])('clamps page=%s limit=%s', async (page, limit) => {
    const { service, prisma } = makeService();

    await service.findMany({ page, limit });

    const args = prisma.contactMessage.findMany.mock.calls[0][0];
    expect(args.skip).toBeGreaterThanOrEqual(0);
    expect(args.take).toBeLessThanOrEqual(100);
  });

  it('tallies every status, defaulting the ones with no rows to zero', async () => {
    const { service, prisma } = makeService();
    prisma.contactMessage.groupBy.mockResolvedValue([
      { status: 'NEW', _count: { _all: 4 } },
      { status: 'RESOLVED', _count: { _all: 2 } },
    ]);

    const result = await service.findMany({ q: 'ada' });

    expect(result.pagination.counts).toEqual({ NEW: 4, READ: 0, RESOLVED: 2 });
  });

  it('ignores an unrecognised status in the tally instead of trusting it', async () => {
    const { service, prisma } = makeService();
    prisma.contactMessage.groupBy.mockResolvedValue([
      { status: 'ARCHIVED', _count: { _all: 9 } },
      { status: 'NEW', _count: { _all: 1 } },
    ]);

    const result = await service.findMany();

    expect(result.pagination.counts).toEqual({ NEW: 1, READ: 0, RESOLVED: 0 });
  });
});

describe('ContactService.updateStatus', () => {
  it('rejects an unknown message before writing', async () => {
    const { service, prisma } = makeService();

    await expect(service.updateStatus('missing', 'READ')).rejects.toThrow(NotFoundException);
    expect(prisma.contactMessage.update).not.toHaveBeenCalled();
  });

  it('writes the new status for an existing message', async () => {
    const { service, prisma } = makeService();
    prisma.contactMessage.findUnique.mockResolvedValue({ id: 'm1' });

    await service.updateStatus('m1', 'RESOLVED');

    expect(prisma.contactMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' }, data: { status: 'RESOLVED' } }),
    );
  });
});

describe('ContactService.create', () => {
  it('files every new message as NEW and never echoes a password-like field', async () => {
    const { service, prisma } = makeService();
    prisma.contactMessage.create.mockResolvedValue({ id: 'm1', name: 'Ada', email: 'ada@x.test', message: 'Hi', status: 'NEW' });

    await service.create({ name: 'Ada', email: 'ada@x.test', message: 'Hi' });

    expect(prisma.contactMessage.create.mock.calls[0][0].data).toEqual({
      name: 'Ada',
      email: 'ada@x.test',
      message: 'Hi',
      status: 'NEW',
    });
  });

  it('notifies staff over the realtime channel', async () => {
    const { service, prisma, gateway } = makeService();
    prisma.contactMessage.create.mockResolvedValue({ id: 'm1', name: 'Ada', email: 'ada@x.test', message: 'Hi', status: 'NEW' });

    await service.create({ name: 'Ada', email: 'ada@x.test', message: 'Hi' });
    await new Promise(process.nextTick);

    expect(gateway.emitToStaff).toHaveBeenCalledWith('message:new', expect.objectContaining({ source: 'CONTACT', id: 'm1' }));
  });
});
