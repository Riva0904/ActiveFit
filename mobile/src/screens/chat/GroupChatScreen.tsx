import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ChatHeader, ChatThread, type ChatThreadConfig } from '../../components/chat/ChatThread';

export interface GroupSummary {
  id: string;
  name: string | null;
  avatar: string | null;
  isOwner: boolean;
  participantCount: number;
  participants: { id: string; firstName: string; lastName: string; role: string; avatar?: string | null; groupRole: string }[];
}

/**
 * A group room. Everyone in it may post — the gate is membership, not the pair
 * of roles that blocks member → member direct messages. Only the owner (the gym
 * admin who made it) can rename it or change who is in it, from Group info.
 */
export default function GroupChatScreen({ route, navigation }: any) {
  const groupId: string = route.params?.groupId ?? route.params?.group?.id;
  const seed: Partial<GroupSummary> = route.params?.group ?? {};
  const queryClient = useQueryClient();

  const { data: group } = useQuery<GroupSummary>({
    queryKey: ['chat-group', groupId],
    queryFn: () => api.get(`/chat/groups/${groupId}`) as any,
    enabled: !!groupId,
    initialData: seed.id ? (seed as GroupSummary) : undefined,
  });

  const config: ChatThreadConfig = useMemo(() => ({
    queryKey: ['chat-group-messages', groupId],
    fetchMessages: async () => {
      const res: any = await api.get(`/chat/groups/${groupId}/messages`);
      return Array.isArray(res) ? res : res?.data ?? [];
    },
    markRead: () => api.patch(`/chat/groups/${groupId}/read`),
    incomingEvent: 'chat:group-message',
    belongsToThread: (msg) => msg.conversationId === groupId,
    sendEvent: 'chat:group-send',
    sendPayload: (content, attachment) => ({
      conversationId: groupId,
      content,
      ...(attachment && {
        attachmentUrl: attachment.url,
        attachmentName: attachment.name,
        attachmentType: attachment.type,
      }),
    }),
    typingEvent: {
      name: 'chat:group-typing',
      payload: { conversationId: groupId },
      belongsToThread: (p) => p.conversationId === groupId,
    },
    // A room needs names above each bubble; a 1:1 does not.
    showSenderNames: true,
    emptyTitle: 'No messages yet',
    emptySubtitle: 'Say something — everyone in this group will see it.',
    placeholder: 'Message the group',
  }), [groupId]);

  const count = group?.participantCount ?? seed.participantCount ?? 0;

  return (
    <ChatThread
      config={config}
      onThreadsChanged={() => queryClient.invalidateQueries({ queryKey: ['chat-threads'] })}
      header={
        <ChatHeader
          title={group?.name ?? seed.name ?? 'Group'}
          subtitle={`${count} ${count === 1 ? 'person' : 'people'} · tap for info`}
          icon="account-group-outline"
          onBack={() => navigation.goBack()}
          onPressTitle={() => navigation.navigate('GroupInfo', { groupId })}
        />
      }
    />
  );
}
