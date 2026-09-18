import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ChatHeader, ChatThread, type ChatThreadConfig } from '../../components/chat/ChatThread';

const roleLabel = (role?: string) =>
  role === 'GYM_ADMIN' ? 'Gym admin' : role ? role.charAt(0) + role.slice(1).toLowerCase() : '';

/**
 * One private thread. Messages are delivered to exactly two sockets — mine and
 * the other person's — so nothing here is visible to the rest of the gym. The
 * list, composer, attachments, typing, reactions and delete all come from the
 * shared `ChatThread`, which the group screen uses too.
 */
export default function DirectChatScreen({ route, navigation }: any) {
  const peer = route.params?.peer ?? {};
  const peerId: string = peer.id;
  const queryClient = useQueryClient();

  const config: ChatThreadConfig = useMemo(() => ({
    queryKey: ['chat-thread', peerId],
    fetchMessages: async () => {
      const res: any = await api.get(`/chat/threads/${peerId}/messages`);
      return Array.isArray(res) ? res : res?.data ?? [];
    },
    markRead: () => api.patch(`/chat/threads/${peerId}/read`),
    incomingEvent: 'chat:message',
    // Either the other person wrote to me, or this is the echo of what I sent.
    belongsToThread: (msg) => {
      const from = msg.senderId ?? msg.sender?.id;
      return from === peerId || msg.threadWith === peerId || msg.peerId === peerId;
    },
    sendEvent: 'chat:send',
    sendPayload: (content, attachment) => ({
      toUserId: peerId,
      content,
      ...(attachment && {
        attachmentUrl: attachment.url,
        attachmentName: attachment.name,
        attachmentType: attachment.type,
      }),
    }),
    typingEvent: {
      name: 'chat:typing',
      payload: { toUserId: peerId },
      belongsToThread: (p) => p.userId === peerId,
    },
    showSenderNames: false,
    emptyTitle: 'No messages yet',
    emptySubtitle: `Only you and ${peer.firstName ?? 'they'} can see this chat.`,
    placeholder: `Message ${peer.firstName ?? ''}`,
  }), [peerId, peer.firstName]);

  return (
    <ChatThread
      config={config}
      onThreadsChanged={() => queryClient.invalidateQueries({ queryKey: ['chat-threads'] })}
      header={
        <ChatHeader
          title={`${peer.firstName ?? ''} ${peer.lastName ?? ''}`.trim()}
          subtitle={roleLabel(peer.role)}
          avatar={peer.avatar}
          firstName={peer.firstName}
          lastName={peer.lastName}
          onBack={() => navigation.goBack()}
        />
      }
    />
  );
}
