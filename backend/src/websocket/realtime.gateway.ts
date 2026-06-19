import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'realtime',
  cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    client.emit('connection:ready', { socketId: client.id, connectedAt: new Date().toISOString() });
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('notifications:subscribe')
  subscribeNotifications(@MessageBody() body: { userId: string }, @ConnectedSocket() client: Socket) {
    client.join(`user:${body.userId}`);
    return { subscribed: true };
  }

  @SubscribeMessage('exam:join')
  joinExam(@MessageBody() body: { sessionId: string }, @ConnectedSocket() client: Socket) {
    client.join(`session:${body.sessionId}`);
    return { joined: body.sessionId };
  }

  @SubscribeMessage('monitor:join')
  joinMonitor(@MessageBody() body: { examId: string }, @ConnectedSocket() client: Socket) {
    client.join(`monitor:${body.examId}`);
    return { joined: body.examId };
  }

  @SubscribeMessage('exam:heartbeat')
  heartbeat(@MessageBody() body: { examId: string; sessionId: string; remainingSeconds: number }) {
    this.server.to(`monitor:${body.examId}`).emit('monitor:candidate-update', {
      ...body,
      event: 'heartbeat',
      receivedAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  @SubscribeMessage('exam:violation')
  violation(@MessageBody() body: { examId: string; sessionId: string; type: string; severity?: number }) {
    this.server.to(`monitor:${body.examId}`).emit('monitor:candidate-update', {
      ...body,
      event: 'violation',
      receivedAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  emitNotification(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }
}
