import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/Text';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';
import { Avatar, Icon } from '../../components';
import { colors } from '../../theme';

const roleLabel = (role?: string) =>
  role === 'GYM_ADMIN' ? 'Gym admin' : role ? role.charAt(0) + role.slice(1).toLowerCase() : '';

/**
 * One private thread. Messages are delivered to exactly two sockets — mine and
 * the other person's — so nothing here is visible to the rest of the gym.
 */
export default function DirectChatScreen({ route, navigation }: any) {
  const peer = route.params?.peer ?? {};
  const peerId: string = peer.id;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [socketReady, setSocketReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);

  const { isLoading } = useQuery({
    queryKey: ['chat-thread', peerId],
    queryFn: async () => {
      const res: any = await api.get(`/chat/threads/${peerId}/messages`);
      const msgs: any[] = Array.isArray(res) ? res : res?.data ?? [];
      setMessages([...msgs].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));
      // Opening the thread is what clears its unread count.
      api.patch(`/chat/threads/${peerId}/read`).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      return msgs;
    },
    enabled: !!peerId,
  });

  useEffect(() => {
    let mounted = true;
    let socket: any;
    try {
      socket = getSocket();
      socketRef.current = socket;

      const onMessage = (msg: any) => {
        if (!mounted) return;
        // Only messages on this thread: either the other person wrote to me, or
        // the echo of what I just sent to them.
        const from = msg.senderId ?? msg.sender?.id;
        const onThisThread = from === peerId || msg.threadWith === peerId || msg.peerId === peerId;
        if (!onThisThread) {
          queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
          return;
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id && m.id === msg.id)) return prev;
          const withoutTemp = prev.filter((m) => !(m._temp && m.content === msg.content));
          return [...withoutTemp, msg];
        });
        if (from === peerId) api.patch(`/chat/threads/${peerId}/read`).catch(() => {});
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
      };
      const onError = (e: any) => mounted && setError(e?.message ?? 'Message not delivered');

      socket.on('chat:message', onMessage);
      socket.on('chat:error', onError);
      socket.on('connect', () => mounted && setSocketReady(true));
      socket.on('disconnect', () => mounted && setSocketReady(false));

      if (!socket.connected) socket.connect();
      setSocketReady(socket.connected);

      return () => {
        mounted = false;
        socket?.off('chat:message', onMessage);
        socket?.off('chat:error', onError);
        socket?.off('connect');
        socket?.off('disconnect');
      };
    } catch {
      return undefined;
    }
  }, [peerId, queryClient]);

  function send() {
    const content = text.trim();
    if (!content || !peerId) return;
    const optimistic = { _temp: true, content, createdAt: new Date().toISOString(), senderId: user?.id };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setError(null);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 40);
    try {
      socketRef.current?.emit('chat:send', { toUserId: peerId, content });
    } catch {
      setMessages((prev) => prev.filter((m) => m !== optimistic));
      setError('Could not send. Check your connection.');
    }
  }

  const mine = (msg: any) => (msg.senderId ?? msg.sender?.id) === user?.id;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <Icon name="chevron-left" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Avatar uri={peer.avatar} firstName={peer.firstName} lastName={peer.lastName} size={38} />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{peer.firstName} {peer.lastName}</Text>
          <Text style={styles.sub}>
            {roleLabel(peer.role)}{socketReady ? '' : ' · reconnecting…'}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m, i) => m.id ?? `t-${i}`}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Only you and {peer.firstName} can see this chat.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const own = mine(item);
            const ts = new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return (
              <View style={[styles.msgRow, own && styles.msgRowOwn]}>
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  <View style={styles.msgLine}>
                    <Text style={[styles.msgText, own && styles.msgTextOwn]}>{item.content}</Text>
                    <Text style={[styles.ts, own && styles.tsOwn]}>{ts}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={`Message ${peer.firstName ?? ''}`}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]}
          onPress={send}
          disabled={!text.trim()}
          activeOpacity={0.85}
        >
          <Icon name="send" size={17} color={colors.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.surface, backgroundColor: colors.bg,
  },
  backBtn: { width: 30, alignItems: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },

  listContent: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },
  msgRow: { flexDirection: 'row', marginBottom: 3 },
  msgRowOwn: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10 },
  bubbleOwn: { backgroundColor: colors.primary, borderTopRightRadius: 2 },
  bubbleOther: {
    backgroundColor: colors.surface, borderTopLeftRadius: 2,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  msgLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 8 },
  msgText: { color: colors.text, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  msgTextOwn: { color: colors.white },
  ts: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginLeft: 'auto', paddingTop: 4 },
  tsOwn: { color: 'rgba(255,255,255,0.65)' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 6 },
  emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySub: { color: colors.textFaint, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  error: { color: colors.danger, fontSize: 12, textAlign: 'center', paddingBottom: 6 },
  inputBar: {
    flexDirection: 'row', gap: 10, padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1, borderTopColor: colors.surface, backgroundColor: colors.bg, alignItems: 'flex-end',
  },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1,
    borderColor: colors.border, color: colors.text, fontSize: 14,
    paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.35 },
});
