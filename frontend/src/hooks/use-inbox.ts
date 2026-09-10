'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSocket } from '@/services/socket.service';

export const MESSAGES_QUERY_KEY = ['messages'];

export function useInboxLive() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const onMessage = () => {
      queryClient.invalidateQueries({ queryKey: MESSAGES_QUERY_KEY });
      toast.info('New message received');
    };
    socket.on('message:new', onMessage);
    const subscribe = () => socket.emit('staff:subscribe');
    if (socket.connected) {
      subscribe();
    } else {
      socket.once('connect', subscribe);
      socket.connect();
    }
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [queryClient]);
}