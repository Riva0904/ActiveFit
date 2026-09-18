import React, { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/Text';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';
import { can } from '../../lib/roles';
import { Avatar, EmptyState, Header, Icon, Loading, PressScale, Screen } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface Person { id: string; firstName: string; lastName: string; role: string; avatar?: string | null }
interface Thread {
  id: string;
  type: 'DIRECT' | 'GROUP';
  peer: Person | null;
  name: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  participantCount?: number;
}

const roleLabel = (role: string) =>
  role === 'GYM_ADMIN' ? 'Gym admin' : role.charAt(0) + role.slice(1).toLowerCase();

function when(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * The inbox: private 1:1 threads and the groups I am in, newest first. There is
 * no shared gym inbox — nobody reads a conversation they are not on, and a
 * group only appears for the people actually in it.
 */
export default function MessagesScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canCreateGroup = can(user, 'canCreateGroup');

  const threadsQ = useQuery<Thread[]>({
    queryKey: ['chat-threads'],
    queryFn: () => api.get('/chat/threads') as any,
    staleTime: 15_000,
  });

  // A new message must move the inbox even when the thread is not open.
  useEffect(() => {
    let socket: any;
    try {
      socket = getSocket();
      const refresh = () => queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      socket.on('chat:message', refresh);
      socket.on('chat:group-message', refresh);
      socket.on('chat:group-inbox', refresh);
      socket.on('chat:group-updated', refresh);
      if (!socket.connected) socket.connect();
      return () => {
        socket?.off('chat:message', refresh);
        socket?.off('chat:group-message', refresh);
        socket?.off('chat:group-inbox', refresh);
        socket?.off('chat:group-updated', refresh);
      };
    } catch {
      return undefined;
    }
  }, [queryClient]);

  const threads = Array.isArray(threadsQ.data) ? threadsQ.data : [];

  const open = (t: Thread) =>
    t.type === 'GROUP'
      ? navigation.navigate('GroupChat', { groupId: t.id, group: { id: t.id, name: t.name, participantCount: t.participantCount } })
      : navigation.navigate('DirectChat', { peer: t.peer });

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="Messages"
          subtitle={canCreateGroup ? 'One to one and groups' : 'Private, one to one'}
          right={
            <View style={styles.actions}>
              {canCreateGroup ? (
                <PressScale style={styles.newGroupBtn} onPress={() => navigation.navigate('CreateGroup')}>
                  <Icon name="account-group-outline" size={18} color={colors.primary} />
                </PressScale>
              ) : null}
              <PressScale style={styles.newBtn} onPress={() => navigation.navigate('ChatContacts')}>
                <Icon name="edit-2" size={17} color={colors.white} />
              </PressScale>
            </View>
          }
        />
      </View>

      {threadsQ.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => `${t.type}-${t.id}`}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={threadsQ.isRefetching} onRefresh={threadsQ.refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="message-circle"
              title="No messages yet"
              subtitle="Start a conversation with someone at your gym."
              action={{ label: 'New message', onPress: () => navigation.navigate('ChatContacts') }}
            />
          }
          renderItem={({ item }) => {
            const isGroup = item.type === 'GROUP';
            const title = isGroup
              ? item.name ?? 'Group'
              : `${item.peer?.firstName ?? ''} ${item.peer?.lastName ?? ''}`.trim();
            const fallback = isGroup
              ? `${item.participantCount ?? 0} people · no messages yet`
              : `Say hello to your ${roleLabel(item.peer?.role ?? '').toLowerCase()}`;

            return (
              <PressScale style={styles.row} scaleTo={0.98} onPress={() => open(item)}>
                {isGroup ? (
                  <View style={styles.groupAvatar}>
                    <Icon name="account-group-outline" size={22} color={colors.primary} />
                  </View>
                ) : (
                  <Avatar uri={item.peer?.avatar} firstName={item.peer?.firstName} lastName={item.peer?.lastName} size={46} />
                )}
                <View style={styles.body}>
                  <View style={styles.topLine}>
                    <Text style={styles.name} numberOfLines={1}>{title}</Text>
                    <Text style={styles.time}>{when(item.lastMessageAt)}</Text>
                  </View>
                  <View style={styles.topLine}>
                    <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                      {item.lastMessage ?? fallback}
                    </Text>
                    {item.unread > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </PressScale>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  newBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  newGroupBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: tint(colors.primary, '18'),
    borderWidth: 1, borderColor: tint(colors.primary, '38'),
    alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  groupAvatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, ...typography.h2, flex: 1 },
  time: { color: colors.textMuted, ...typography.micro },
  preview: { color: colors.textMuted, ...typography.caption, flex: 1 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.white, ...typography.micro, fontWeight: '800' },
});
