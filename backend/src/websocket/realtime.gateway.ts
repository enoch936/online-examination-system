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

const MAX_CONNECTIONS_PER_USER = 5;
const MAX_TOTAL_CONNECTIONS = 50000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60_000;

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

    server.use((socket, next) => {
      const token = this.extractToken(socket);
      if (!token) {
        next(new Error('unauthorized'));
        return;
      }
      try {
        const payload = this.jwt.verify(token) as SocketUser;
        socket.data.user = { sub: payload.sub, email: payload.email, roles: payload.roles ?? [] };
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

    const sessions = this.socketSessions.get(client.id);
    if (sessions) {
      for (const sessionId of sessions) {
        void this.monitoring.setConnection(sessionId, 'DISCONNECTED', 'socket disconnected');
      }
      this.socketSessions.delete(client.id);
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

  @SubscribeMessage('notifications:subscribe')
  subscribeNotifications(@MessageBody() body: { userId: string }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (user && body.userId === user.sub) client.join(`user:${body.userId}`);
    return { subscribed: user ? body.userId === user.sub : false };
  }

  @SubscribeMessage('exam:join')
  async joinExam(@MessageBody() body: { sessionId: string }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    // Authorization: only the session owner (or monitoring staff) may join a
    // session room — joining previously also flipped connection state, so an
    // unauthorized join would corrupt another student's live status.
    if (!user || !isValidId(body?.sessionId) || !(await this.monitoring.assertSessionAccess(body.sessionId, user.sub, user.roles))) {
      return { denied: true };
    }
    client.join(`session:${body.sessionId}`);
    const sessions = this.socketSessions.get(client.id) ?? new Set<string>();
    sessions.add(body.sessionId);
    this.socketSessions.set(client.id, sessions);
    void this.monitoring.setConnection(body.sessionId, 'CONNECTED', 'socket joined');
    return { joined: body.sessionId };
  }

  @SubscribeMessage('monitor:join')
  joinMonitor(@MessageBody() body: { examId: string }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!this.isMonitor(user) || !isValidId(body?.examId)) return { denied: true };
    client.join(`monitor:${body.examId}`);
    return { joined: body.examId };
  }

  @SubscribeMessage('exam:heartbeat')
  heartbeat(
    @MessageBody() body: { sessionId: string; remainingSeconds?: number; currentQuestionId?: string; currentQuestionIndex?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.getUser(client);
    if (!user || this.isRateLimited(client, `${user.sub}:hb`, 60)) return { ok: false };
    if (!isValidId(body?.sessionId)) return { ok: false };
    void this.monitoring.recordHeartbeat(body.sessionId, {
      remainingSeconds: typeof body.remainingSeconds === 'number' && Number.isFinite(body.remainingSeconds) ? Math.max(0, Math.floor(body.remainingSeconds)) : undefined,
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
    void this.monitoring
      .recordEvent({
        sessionId: body.sessionId,
        studentId: user.sub,
        type: body.type as ExamEventType,
        metadata: body.metadata,
        riskScore: typeof body.riskScore === 'number' && Number.isFinite(body.riskScore) ? body.riskScore : undefined,
        asStudent: true,
      })
      .catch(() => undefined);
    return { ok: true };
  }

  @SubscribeMessage('proctoring:offer')
  async offer(@MessageBody() body: { sessionId: string; examId: string; offer: unknown }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    // Only the session owner may publish their webcam offer to monitors.
    if (
      !user ||
      !isValidId(body?.sessionId) ||
      !isValidId(body.examId) ||
      body.offer === null ||
      typeof body.offer !== 'object' ||
      !(await this.monitoring.assertSessionAccess(body.sessionId, user.sub, user.roles))
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
  answer(
    @MessageBody() body: { sessionId: string; answer: unknown; peerSocketId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = this.getUser(client);
    // SDP answers are only ever sent by proctors back to students.
    if (!this.isMonitor(user) || !isValidId(body?.sessionId) || !isValidId(body.peerSocketId) || body.answer === null || typeof body.answer !== 'object') {
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
  ice(@MessageBody() body: { sessionId: string; candidate: unknown; peerSocketId: string }, @ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user || this.isRateLimited(client, `ice:${client.id}`, 120)) return { ok: false };
    if (!isValidId(body?.sessionId) || !isValidId(body.peerSocketId) || body.candidate === null || typeof body.candidate !== 'object') {
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
}
