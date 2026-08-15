'use client';

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

let socket: Socket | undefined;

export function getSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000/realtime', {
      withCredentials: true,
      autoConnect: false,
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? undefined }),
    });
    socket.on('connect_error', () => {
      /* surface via connecting UI if needed */
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = undefined;
}
