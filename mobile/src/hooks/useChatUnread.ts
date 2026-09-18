import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { can } from '../lib/roles';

/**
 * Total unread across direct threads and groups, for the tab badge.
 *
 * `GET /chat/unread-count` has existed since direct chat shipped and the app
 * never called it, so there was no badge anywhere. A super admin has no gym
 * inbox, so the query is skipped for them rather than 400-ing on a missing gym.
 */
export function useChatUnread(): number {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const enabled = can(user, 'canChatWithGym') || can(user, 'canAnswerMemberChat');

  const { data } = useQuery<{ count: number }>({
    queryKey: ['chat-unread'],
    queryFn: () => api.get('/chat/unread-count') as any,
    enabled,
    staleTime: 20_000,
  });

  useEffect(() => {
    if (!enabled) return;
    let socket: any;
    try {
      socket = getSocket();
      const refresh = () => queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
      socket.on('chat:message', refresh);
      socket.on('chat:group-message', refresh);
      socket.on('chat:group-inbox', refresh);
      if (!socket.connected) socket.connect();
      return () => {
        socket?.off('chat:message', refresh);
        socket?.off('chat:group-message', refresh);
        socket?.off('chat:group-inbox', refresh);
      };
    } catch {
      return undefined;
    }
  }, [enabled, queryClient]);

  return data?.count ?? 0;
}
