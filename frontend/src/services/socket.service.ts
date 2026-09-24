'use client';

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

let socket: Socket | undefined;

function resolveSocketUrl(): string {
  let envUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();

  if (!envUrl && process.env.NEXT_PUBLIC_API_URL) {
    try {
      const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL).origin;
      envUrl = `${apiOrigin}/realtime`;
    } catch {
      /* ignore */
    }
  }

  if (!envUrl && typeof window !== 'undefined') {
    envUrl = `${window.location.protocol}//${window.location.host}/realtime`;
  }

  if (!envUrl) {
    envUrl = 'http://localhost:4000/realtime';
  }

  if (!envUrl.endsWith('/realtime')) {
    envUrl = envUrl.replace(/\/+$/, '') + '/realtime';
  }

  return envUrl;
}

export function getSocket() {
  if (!socket) {
    const targetUrl = resolveSocketUrl();
    socket = io(targetUrl, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? undefined }),
    });
    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err?.message || err);
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = undefined;
}

