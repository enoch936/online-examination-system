import { Injectable, Inject, forwardRef, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ExamEventType, RoleName, ViolationType } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { MonitoringService, STUDENT_GENERATED_EVENTS } from '../monitoring/monitoring.service';
import { parseOrigins } from '../config/app.config';
import { PrismaService } from '../prisma/prisma.service';

const MAX_CONNECTIONS_PER_USER = 5;
const MAX_TOTAL_CONNECTIONS = 50000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;
const MAX_SDP_BYTES = 128_000;
const MAX_CANDIDATE_BYTES = 16_000;
const MAX_MANUAL_FLAG_MESSAGE_LENGTH = 500;

interface SocketUser {
  sub: string;
  email: string;
  roles: RoleName[];
}

const MONITOR_ROLES: RoleName[] = [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR];

const VIOLATION_TYPES = new Set<string>(Object.values(ViolationType));

const CORS_ORIGINS = parseOrigins(process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL);

function isValidId(value: unknown, max = 64): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/\s/.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function estimatedBytes(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Bound the size/shape of client-supplied event metadata (8 KiB, plain object). */
function sanitizeEventMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(value)) return undefined;
  if (estimatedBytes(value) > 8_000) return undefined;
  return value;
}

@Injectable()
@WebSocketGateway({
  namespace: 'realtime',
  cors: {
    origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private socketSessions = new Map<string, Set<string>>();
  private eventCounts = new Map<string, { minute: number; count: number }>();
  private userConnections = new Map<string, number>();
  private totalConnections = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;

  constructor(
    @Inject(forwardRef(() => MonitoringService)) private readonly monitoring: MonitoringService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async afterInit(server: Server) {
    try {
      const redisUrl = this.config.get<string>('REDIS_URL', 'redis://localhost:6379');
      this.pubClient = createClient({ url: redisUrl });
      this.subClient = createClient({ url: redisUrl });
      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      server.adapter(createAdapter(this.pubClient, this.subClient));
      console.log('Socket.IO: Redis adapter connected — multi-instance scaling enabled');
    } catch (err) {
      console.warn('Socket.IO: Redis adapter failed, running single-process mode:', (err as Error).message);
    }

    server.use(async (socket, next) => {
      const token = this.extractToken(socket);
      if (!token) {
        next(new Error('unauthorized'));
        return;
      }
      let payload: SocketUser;
      try {
        payload = this.jwt.verify(token) as SocketUser;
      } catch {
        next(new Error('unauthorized'));
        return;
      }
      // Mirror JwtStrategy: re-resolve the account and its current roles from
      // the database on every connection, so suspended/demoted users are
      // rejected immediately instead of using stale (privileged) claims.
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            status: true,
            roles: { select: { role: { select: { name: true } } } },
          },
        });
        if (!user || user.status !== 'ACTIVE') {
          next(new Error('unauthorized'));
          return;
        }
        socket.data.user = {
          sub: user.id,
          email: user.email,
          roles: user.roles.map((userRole) => userRole.role.name),
        };
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });

    this.cleanupTimer = setInterval(() => this.cleanupRateLimits(), RATE_LIMIT_CLEANUP_INTERVAL_MS);
    console.log(`Socket.IO CORS: configured (${CORS_ORIGINS.length} origin(s))`);
  }

  async onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.pubClient?.quit().catch(() => {});
    await this.subClient?.quit().catch(() => {});
  }

  private cleanupRateLimits() {
    const now = Date.now();
    for (const [key, entry] of this.eventCounts) {
      if (now - entry.minute >= 60000) {
        this.eventCounts.delete(key);
      }
    }
  }

  private extractToken(socket: Socket): string | undefined {
    const auth = socket.handshake.auth?.token as string | undefined;
    if (auth) return auth;
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookie = socket.handshake.headers.cookie ?? '';
    const match = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }

  handleConnection(client: Socket) {
    if (this.totalConnections >= MAX_TOTAL_CONNECTIONS) {
      client.emit('error', { message: 'Server connection limit reached' });
      client.disconnect(true);
      return;
    }

    const user = client.data.user as SocketUser | undefined;
    if (user) {
      const count = (this.userConnections.get(user.sub) ?? 0) + 1;
      if (count > MAX_CONNECTIONS_PER_USER) {
        client.emit('error', { message: 'Too many connections' });
        client.disconnect(true);
        return;
      }
      this.userConnections.set(user.sub, count);
    }

    this.totalConnections++;
    client.join(`peer:${client.id}`);
    client.emit('connection:ready', {
      socketId: client.id,
      connectedAt: new Date().toISOString(),
      roles: user?.roles ?? [],
    });
  }

  handleDisconnect(client: Socket) {
    this.totalConnections = Math.max(0, this.totalConnections - 1);
    const user = client.data.user as SocketUser | undefined;
    if (user) {
      const count = (this.userConnections.get(user.sub) ?? 1) - 1;
      if (count <= 0) this.userConnections.delete(user.sub);
      else this.userConnections.set(user.sub, count);
    }

    // socketSessions only tracks sessions where this socket was the OWNER (see
    // joinExam), so monitor sockets never corrupt a student's state here.
    const sessions = this.socketSessions.get(client.id);
    if (sessions) {
      this.socketSessions.delete(client.id);
      for (const sessionId of sessions) {
        // A user may legitimately hold the same session from another tab/socket
        // (or reconnect before this disconnect processes). Only mark the session
        // DISCONNECTED when no other live socket of the same owner is still in
        // the session room.
        const room = this.server.sockets.adapter.rooms.get(`session:${sessionId}`);
        const hasOtherOwnerSocket =
          !!room && [...room].some((socketId) => {
            if (socketId === client.id) return false;
            return this.server.sockets.sockets.get(socketId)?.data.user?.sub === user?.sub;
          });
        if (!hasOtherOwnerSocket) {
          void this.monitoring.setConnection(sessionId, 'DISCONNECTED', 'socket disconnected');
        }
      }
    }
  }

  private isRateLimited(client: Socket, key: string, limit: number) {
    const now = Date.now();
    const entry = this.eventCounts.get(key);
    if (!entry || now - entry.minute >= 60000) {
      this.eventCounts.set(key, { minute: now, count: 1 });
      return false;
    }
    entry.count++;
    return entry.count > limit;
  }

  private getUser(client: Socket): SocketUser | undefined {
    return client.data.user as SocketUser | undefined;
  }

  private isMonitor(user?: SocketUser): boolean {
    return !!user && MONITOR_ROLES.some((role) => user.roles.includes(role));
  }

  private isMonitorRole(roles: RoleName[]): boolean {
    return MONITOR_ROLES.some((role) => roles.includes(role));
  }

  /**
   * Resolve a caller's relationship to an exam session. Returns null when the
   * user has no rights; otherwise whether they own the session and/or may
   * monitor its exam.
   */
  private async sessionAccess(
    sessionId: string,
    user: SocketUser,
  ): Promise<{ examId: string; owner: boolean; canMonitor: boolean } | null> {
    if (!isValidId(sessionId)) return null;
    const access = await this.monitoring.assertSessionAccess(sessionId, user.sub, user.roles);
    if (!access) return null;
    const canMonitor = this.isMonitor(user)
      ? await this.monitoring.assertCanMonitorExam(access.examId, {
          sub: user.sub,
          roles: user.roles,
          permissions: [],
          email: user.email,
        })
      : false;
    return { examId: access.examId, owner: access.studentId === user.sub, canMonitor };
  }

  /** Whether a live socket with the given id is a member of `room`. */
  private isRoomMember(socketId: string, room: string): boolean {
    const roomSet = this.server.sockets.adapter.rooms.get(room);
    return !!roomSet && roomSet.has(socketId);
  }

  @SubscribeMessage('notifications:subscribe')
  subscribeNotifications(@MessageBody() body: { userId: string }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (user && body.userId === user.sub) client.join(`user:${body.userId}`);
    return { subscribed: user ? body.userId === user.sub : false };
  }

  @SubscribeMessage('staff:subscribe')
  subscribeStaff(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (this.isMonitor(user)) client.join('staff');
    return { subscribed: this.isMonitor(user) };
  }

  @SubscribeMessage('exam:join')
  async joinExam(@MessageBody() body: { sessionId: string }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    // Authorization: only the session owner (or staff who can monitor the exam)
    // may join a session room — joining also flips connection state, so an
    // unauthorized join would corrupt another student's live status.
    if (!user || this.isRateLimited(client, `${user.sub}:join`, 30) || !isValidId(body?.sessionId)) {
      return { denied: true };
    }
    const access = await this.monitoring.assertSessionAccess(body.sessionId, user.sub, user.roles);
    if (!access) return { denied: true };
    if (await this.isMonitorRole(user.roles)) {
      const canMonitor = await this.monitoring.assertCanMonitorExam(access.examId, {
        sub: user.sub,
        roles: user.roles,
        permissions: [],
        email: user.email,
      });
      if (!canMonitor) return { denied: true };
    }
    client.join(`session:${body.sessionId}`);
    // Only the session OWNER is tracked for disconnect handling — monitor
    // observers joining the room must never trigger a DISCONNECTED write.
    if (access.studentId === user.sub) {
      const sessions = this.socketSessions.get(client.id) ?? new Set<string>();
      sessions.add(body.sessionId);
      this.socketSessions.set(client.id, sessions);
    }
    void this.monitoring.setConnection(body.sessionId, 'CONNECTED', 'socket joined');
    return { joined: body.sessionId };
  }

  @SubscribeMessage('monitor:join')
  async joinMonitor(@MessageBody() body: { examId: string }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!this.isMonitor(user) || this.isRateLimited(client, `${user!.sub}:join`, 30) || !isValidId(body?.examId)) {
      return { denied: true };
    }
    // Authorization: monitors may only join exam rooms they can actually monitor.
    const canMonitor = await this.monitoring.assertCanMonitorExam(body.examId, {
      sub: user!.sub,
      roles: user!.roles,
      permissions: [],
      email: user!.email,
    });
    if (!canMonitor) return { denied: true };
    client.join(`monitor:${body.examId}`);
    return { joined: body.examId };
  }

  @SubscribeMessage('exam:heartbeat')
  heartbeat(
    @MessageBody() body: { sessionId: string; currentQuestionId?: string; currentQuestionIndex?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.getUser(client);
    if (!user || this.isRateLimited(client, `${user.sub}:hb`, 60)) return { ok: false };
    if (!isValidId(body?.sessionId)) return { ok: false };
    // remainingSeconds is intentionally NOT accepted from the client and is
    // computed server-side from expiresAt/duration in MonitoringService.
    void this.monitoring.recordHeartbeat(body.sessionId, {
      currentQuestionId: isValidId(body.currentQuestionId) ? body.currentQuestionId : undefined,
      currentQuestionIndex: typeof body.currentQuestionIndex === 'number' && Number.isInteger(body.currentQuestionIndex) ? body.currentQuestionIndex : undefined,
      studentId: user.sub,
    });
    return { ok: true };
  }

  @SubscribeMessage('exam:violation')
  violation(
    @MessageBody() body: { examId: string; sessionId: string; type: string; severity?: number; details?: unknown },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.getUser(client);
    if (!user || this.isRateLimited(client, `${user.sub}:violation`, 30)) return { ok: false };
    if (!isValidId(body?.sessionId) || !isValidId(body.examId) || !VIOLATION_TYPES.has(body.type)) {
      return { ok: false };
    }
    void this.monitoring
      .recordViolation(body.examId, body.sessionId, user.sub, {
        type: body.type as ViolationType,
        severity: typeof body.severity === 'number' && Number.isFinite(body.severity) ? body.severity : undefined,
        details: body.details,
      })
      .catch(() => undefined);
    return { ok: true };
  }

  @SubscribeMessage('exam:event')
  event(
    @MessageBody() body: { sessionId: string; type: string; metadata?: Record<string, unknown>; riskScore?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.getUser(client);
    if (!user || this.isRateLimited(client, `${user.sub}:event`, 60)) return { ok: false };
    if (!isValidId(body?.sessionId) || !STUDENT_GENERATED_EVENTS.has(body.type as ExamEventType)) {
      return { ok: false };
    }
    let metadata: Record<string, unknown> | undefined = sanitizeEventMetadata(body.metadata);
    if (metadata && body.type === ExamEventType.MANUAL_FLAG) {
      const message = metadata.message;
      metadata = typeof message === 'string' && message.length <= MAX_MANUAL_FLAG_MESSAGE_LENGTH ? { message } : {};
    }
    void this.monitoring
      .recordEvent({
        sessionId: body.sessionId,
        studentId: user.sub,
        type: body.type as ExamEventType,
        metadata,
        riskScore: typeof body.riskScore === 'number' && Number.isFinite(body.riskScore) ? body.riskScore : undefined,
        asStudent: true,
      })
      .catch(() => undefined);
    return { ok: true };
  }

  @SubscribeMessage('proctoring:offer')
  async offer(@MessageBody() body: { sessionId: string; examId: string; offer: unknown }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    const access = user ? await this.sessionAccess(body?.sessionId, user) : null;
    // Only the session OWNER may publish their webcam offer, and the declared
    // examId must match the session's exam.
    if (
      !user ||
      this.isRateLimited(client, `${user.sub}:offer`, 30) ||
      !access ||
      !access.owner ||
      !isValidId(body.examId) ||
      access.examId !== body.examId ||
      !isPlainObject(body.offer) ||
      estimatedBytes(body.offer) > MAX_SDP_BYTES
    ) {
      return { ok: false };
    }
    this.server.to(`monitor:${body.examId}`).emit('proctoring:offer', {
      sessionId: body.sessionId,
      examId: body.examId,
      offer: body.offer,
      peerSocketId: client.id,
      student: { name: `${user.email}` },
    });
    return { ok: true };
  }

  @SubscribeMessage('proctoring:answer')
  async answer(
    @MessageBody() body: { sessionId: string; answer: unknown; peerSocketId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.getUser(client);
    const access = user ? await this.sessionAccess(body?.sessionId, user) : null;
    // SDP answers are only sent by proctors of THIS exam back to the session's
    // student. The target socket must be a live member of the session room, so
    // unrelated staff cannot inject answers into another exam's WebRTC plane.
    if (
      !user ||
      this.isRateLimited(client, `${user.sub}:answ`, 30) ||
      !access ||
      !access.canMonitor ||
      !isValidId(body.peerSocketId) ||
      !this.isRoomMember(body.peerSocketId, `session:${body.sessionId}`) ||
      !isPlainObject(body.answer) ||
      estimatedBytes(body.answer) > MAX_SDP_BYTES
    ) {
      return { ok: false };
    }
    this.server.to(`peer:${body.peerSocketId}`).emit('proctoring:answer', {
      sessionId: body.sessionId,
      answer: body.answer,
      peerSocketId: client.id,
    });
    return { ok: true };
  }

  @SubscribeMessage('proctoring:ice')
  async ice(@MessageBody() body: { sessionId: string; candidate: unknown; peerSocketId: string }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    const access = user ? await this.sessionAccess(body?.sessionId, user) : null;
    if (
      !user ||
      this.isRateLimited(client, `ice:${client.id}`, 120) ||
      !access ||
      !isValidId(body.peerSocketId) ||
      !isPlainObject(body.candidate) ||
      estimatedBytes(body.candidate) > MAX_CANDIDATE_BYTES
    ) {
      return { ok: false };
    }
    if (access.owner) {
      // Student relays ICE only to proctors of their exam (live, in the monitor room).
      if (!this.isRoomMember(body.peerSocketId, `monitor:${access.examId}`)) return { ok: false };
    } else if (access.canMonitor) {
      // Proctor relays ICE only to the session's own student.
      if (!this.isRoomMember(body.peerSocketId, `session:${body.sessionId}`)) return { ok: false };
    } else {
      return { ok: false };
    }
    this.server.to(`peer:${body.peerSocketId}`).emit('proctoring:ice', {
      sessionId: body.sessionId,
      candidate: body.candidate,
    });
    return { ok: true };
  }

  emitToExam(examId: string, event: string, payload: unknown) {
    this.server.to(`monitor:${examId}`).emit(event, payload);
  }

  emitToSession(sessionId: string, event: string, payload: unknown) {
    this.server.to(`session:${sessionId}`).emit(event, payload);
  }

  emitNotification(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }

  emitToStaff(event: string, payload: unknown) {
    this.server.to('staff').emit(event, payload);
  }
}
