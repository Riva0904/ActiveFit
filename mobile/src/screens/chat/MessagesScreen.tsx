import React, { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/Text';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Avatar, EmptyState, Header, Icon, Loading, PressScale, Screen } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface Person { id: string; firstName: string; lastName: string; role: string; avatar?: string | null }
interface Thread { id: string; peer: Person; lastMessage: string | null; lastMessageAt: string; unread: number }

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
 * The inbox. Every row is a private thread with one person — there is no
 * shared gym inbox any more, so nobody reads a conversation they are not on.
 */
export default function MessagesScreen({ navigation }: any) {
  const queryClient = useQueryClient();

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
      const onMessage = () => queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      socket.on('chat:message', onMessage);
      if (!socket.connected) socket.connect();
      return () => { socket?.off('chat:message', onMessage); };
    } catch {
      return undefined;
    }
  }, [queryClient]);

  const threads = Array.isArray(threadsQ.data) ? threadsQ.data : [];

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="Messages"
          subtitle="Private, one to one"
          right={
            <PressScale style={styles.newBtn} onPress={() => navigation.navigate('ChatContacts')}>
              <Icon name="edit-2" size={17} color={colors.white} />
            </PressScale>
          }
        />
      </View>

      {threadsQ.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
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
          renderItem={({ item }) => (
            <PressScale
              style={styles.row}
              scaleTo={0.98}
              onPress={() => navigation.navigate('DirectChat', { peer: item.peer })}
            >
              <Avatar uri={item.peer?.avatar} firstName={item.peer?.firstName} lastName={item.peer?.lastName} size={46} />
              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.peer?.firstName} {item.peer?.lastName}
                  </Text>
                  <Text style={styles.time}>{when(item.lastMessageAt)}</Text>
                </View>
                <View style={styles.topLine}>
                  <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                    {item.lastMessage ?? `Say hello to your ${roleLabel(item.peer?.role ?? '').toLowerCase()}`}
                  </Text>
                  {item.unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </PressScale>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  newBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
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
  roleChip: { backgroundColor: tint(colors.primary, '18'), borderRadius: radius.pill, paddingHorizontal: 8 },
});
