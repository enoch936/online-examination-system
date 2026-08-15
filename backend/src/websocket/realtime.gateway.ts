import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
import { RoleName } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { MonitoringService } from '../monitoring/monitoring.service';

interface SocketUser {
  sub: string;
  email: string;
  roles: RoleName[];
}

const MONITOR_ROLES: RoleName[] = [RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.INSTRUCTOR];

@Injectable()
@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private socketSessions = new Map<string, Set<string>>();
  private eventCounts = new Map<string, { minute: number; count: number }>();

  constructor(
    @Inject(forwardRef(() => MonitoringService)) private readonly monitoring: MonitoringService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server) {
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
    client.join(`peer:${client.id}`);
    const user = client.data.user as SocketUser | undefined;
    client.emit('connection:ready', {
      socketId: client.id,
      connectedAt: new Date().toISOString(),
      roles: user?.roles ?? [],
    });
  }

  handleDisconnect(client: Socket) {
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

  @SubscribeMessage('notifications:subscribe')
  subscribeNotifications(@MessageBody() body: { userId: string }, @ConnectedSocket() client: Socket) {
    const user = client.data.user as SocketUser | undefined;
    if (user && body.userId === user.sub) client.join(`user:${body.userId}`);
    return { subscribed: user ? body.userId === user.sub : false };
  }

  @SubscribeMessage('exam:join')
  joinExam(@MessageBody() body: { sessionId: string }, @ConnectedSocket() client: Socket) {
    client.join(`session:${body.sessionId}`);
    const sessions = this.socketSessions.get(client.id) ?? new Set<string>();
    sessions.add(body.sessionId);
    this.socketSessions.set(client.id, sessions);
    void this.monitoring.setConnection(body.sessionId, 'CONNECTED', 'socket joined');
    return { joined: body.sessionId };
  }

  @SubscribeMessage('monitor:join')
  joinMonitor(@MessageBody() body: { examId: string }, @ConnectedSocket() client: Socket) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || !MONITOR_ROLES.some((r) => user.roles.includes(r))) return { denied: true };
    client.join(`monitor:${body.examId}`);
    return { joined: body.examId };
  }

  @SubscribeMessage('exam:heartbeat')
  heartbeat(
    @MessageBody() body: { sessionId: string; remainingSeconds?: number; currentQuestionId?: string; currentQuestionIndex?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || this.isRateLimited(client, `${user.sub}:hb`, 60)) return { ok: false };
    void this.monitoring.recordHeartbeat(body.sessionId, {
      remainingSeconds: body.remainingSeconds,
      currentQuestionId: body.currentQuestionId,
      currentQuestionIndex: body.currentQuestionIndex,
      studentId: user.sub,
    });
    return { ok: true };
  }

  @SubscribeMessage('exam:violation')
  violation(
    @MessageBody() body: { examId: string; sessionId: string; type: string; severity?: number; details?: unknown },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user as SocketUser | undefined;
    if (!user || this.isRateLimited(client, `${user.sub}:violation`, 30)) return { ok: false };
    void this.monitoring
      .recordViolation(body.examId, body.sessionId, user.sub, {
        type: body.type as Parameters<MonitoringService['recordViolation']>[3]['type'],
        severity: body.severity,
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
    const user = client.data.user as SocketUser | undefined;
    if (!user || this.isRateLimited(client, `${user.sub}:event`, 60)) return { ok: false };
    void this.monitoring
      .recordEvent({
        sessionId: body.sessionId,
        studentId: user.sub,
        type: body.type as Parameters<MonitoringService['recordEvent']>[0]['type'],
        metadata: body.metadata,
        riskScore: body.riskScore,
        asStudent: true,
      })
      .catch(() => undefined);
    return { ok: true };
  }

  @SubscribeMessage('proctoring:offer')
  offer(@MessageBody() body: { sessionId: string; examId: string; offer: unknown }, @ConnectedSocket() client: Socket) {
    const user = client.data.user as SocketUser | undefined;
    if (!user) return { ok: false };
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
    this.server.to(`peer:${body.peerSocketId}`).emit('proctoring:answer', {
      sessionId: body.sessionId,
      answer: body.answer,
      peerSocketId: client.id,
    });
    return { ok: true };
  }

  @SubscribeMessage('proctoring:ice')
  ice(@MessageBody() body: { sessionId: string; candidate: unknown; peerSocketId: string }) {
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
