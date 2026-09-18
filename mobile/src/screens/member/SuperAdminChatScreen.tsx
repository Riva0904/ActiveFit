import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Text } from '../../components/Text';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';
import { colors } from '../../theme';

/**
 * One row per gym on the platform, whether or not it has ever written in. The
 * old screen listed only existing SUPPORT threads, so a gym that never messaged
 * was unreachable — there was no way to start the conversation from here.
 */
interface SupportTarget {
  gymId: string;
  gymName: string;
  gymLogo?: string | null;
  city?: string | null;
  admin: { id: string; firstName: string; lastName: string; avatar?: string | null; role: string };
  conversationId: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
}

function GymInitials({ name }: { name: string }) {
  const init = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={convStyles.gymAvatar}>
      <Text style={convStyles.gymAvatarText}>{init}</Text>
    </View>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function SuperAdminChatScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SupportTarget | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [socketReady, setSocketReady] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);

  // The socket handler is registered once and must not close over a stale
  // `selected` — reading it from a ref is what stops a reply landing in the
  // previously opened gym's thread.
  const selectedRef = useRef<SupportTarget | null>(null);
  selectedRef.current = selected;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading: loadingGyms } = useQuery<SupportTarget[]>({
    queryKey: ['support-gyms', debounced],
    queryFn: () => api.get('/chat/support/gyms', { params: debounced ? { search: debounced } : undefined }) as any,
    staleTime: 30_000,
  });
  const gyms = Array.isArray(data) ? data : [];

  // Load messages when a gym is opened.
  useEffect(() => {
    if (!selected) return;
    const { admin, gymId } = selected;
    setLoadingMsgs(true);
    setMessages([]);
    api.get(`/chat/support/conversations/${admin.id}/messages`, { params: { gymId } })
      .then((res: any) => {
        const msgs: any[] = Array.isArray(res) ? res : res?.data ?? [];
        setMessages(msgs.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));

    api.patch(`/chat/support/conversations/${admin.id}/read`, null, { params: { gymId } })
      .then(() => queryClient.invalidateQueries({ queryKey: ['support-gyms'] }))
      .catch(() => {});
  }, [selected?.gymId, selected?.admin.id, queryClient]);

  useEffect(() => {
    let mounted = true;
    let socket: any;
    try {
      socket = getSocket();
      socketRef.current = socket;

      const onMessage = (msg: any) => {
        if (!mounted) return;
        // Always refresh the list so unread counts and previews stay honest.
        queryClient.invalidateQueries({ queryKey: ['support-gyms'] });

        const open = selectedRef.current;
        if (!open) return;
        const from = msg.senderId ?? msg.sender?.id;
        const onThisThread = from === open.admin.id || from === user?.id;
        if (!onThisThread) return;

        setMessages((prev) => {
          if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      };
      const onConnect = () => mounted && setSocketReady(true);
      const onDisconnect = () => mounted && setSocketReady(false);

      socket.on('chat:support-message', onMessage);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      if (!socket.connected) socket.connect();
      setSocketReady(socket.connected);

      return () => {
        mounted = false;
        // Named handlers: a bare `socket.off('chat:support-message')` removed
        // every listener for the event, app-wide.
        socket?.off('chat:support-message', onMessage);
        socket?.off('connect', onConnect);
        socket?.off('disconnect', onDisconnect);
      };
    } catch {
      return undefined;
    }
  }, [queryClient, user?.id]);

  function sendMessage() {
    const content = text.trim();
    if (!content || !selected) return;
    // Optimistic: the server creates the thread on first send, so a never-used
    // gym goes from empty to a live conversation right here.
    const optimistic = { _temp: true, content, createdAt: new Date().toISOString(), senderId: user?.id };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      socketRef.current?.emit('chat:support-send', {
        toGymAdminId: selected.admin.id,
        gymId: selected.gymId,
        content,
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m !== optimistic));
    }
  }

  const isOwn = (msg: any) => msg.senderId === user?.id || msg.sender?.id === user?.id;

  // ── Gym list ──
  if (!selected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Gym admin support</Text>
            <Text style={styles.sub}>
              {gyms.length} gym{gyms.length !== 1 ? 's' : ''} · {socketReady ? 'Live' : 'Connecting…'}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: socketReady ? colors.success : colors.textMuted }]} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search gyms by name or city"
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
          />
        </View>

        {loadingGyms ? (
          <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
        ) : (
          <FlatList
            data={gyms}
            keyExtractor={(g) => g.gymId}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 52, marginBottom: 12 }}>🏢</Text>
                <Text style={styles.emptyTitle}>{debounced ? 'No gyms match' : 'No gyms yet'}</Text>
                <Text style={styles.emptySub}>
                  {debounced ? 'Try a different name or city' : 'Gyms appear here as soon as they are created'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.convRow} onPress={() => setSelected(item)} activeOpacity={0.7}>
                <GymInitials name={item.gymName} />
                <View style={styles.convInfo}>
                  <View style={styles.convTop}>
                    <Text style={styles.convName} numberOfLines={1}>{item.gymName}</Text>
                    {item.lastMessageAt ? <Text style={styles.convTime}>{timeAgo(item.lastMessageAt)}</Text> : null}
                  </View>
                  <View style={styles.convBottom}>
                    <Text style={styles.convAdmin} numberOfLines={1}>
                      {item.admin.firstName} {item.admin.lastName}{item.city ? ` · ${item.city}` : ''}
                    </Text>
                    {item.unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread > 9 ? '9+' : item.unread}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.convPreview, !item.lastMessage && styles.convPreviewNew]} numberOfLines={1}>
                    {item.lastMessage ?? 'No messages yet — tap to start'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ── Thread ──
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View style={styles.convHeaderInfo}>
          <GymInitials name={selected.gymName} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{selected.gymName}</Text>
            <Text style={styles.sub}>{selected.admin.firstName} {selected.admin.lastName} · GYM ADMIN</Text>
          </View>
        </View>
        <View style={[styles.statusDot, { backgroundColor: socketReady ? colors.success : colors.textMuted }]} />
      </View>

      {loadingMsgs ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m, i) => m.id ?? `t-${i}`}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const own = isOwn(item);
            const ts = new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return (
              <View style={[styles.msgRow, own && styles.msgRowOwn]}>
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  {!own && <Text style={styles.senderName}>{item.sender?.firstName ?? 'Gym admin'}</Text>}
                  <Text style={[styles.msgText, own && styles.msgTextOwn]}>{item.content ?? item.message}</Text>
                  <Text style={[styles.ts, own && styles.tsOwn]}>{ts}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Send the first message to {selected.gymName}</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={`Message ${selected.gymName}…`}
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]}
          onPress={sendMessage}
          disabled={!text.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const convStyles = StyleSheet.create({
  gymAvatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: colors.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  gymAvatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.surface,
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.primary, fontSize: 28, lineHeight: 30 },
  convHeaderInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  search: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    color: colors.text, fontSize: 14, paddingHorizontal: 14, paddingVertical: 10,
  },

  convRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.surface,
  },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convName: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  convTime: { color: colors.textFaint, fontSize: 11 },
  convBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convAdmin: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  convPreview: { color: colors.textFaint, fontSize: 12 },
  convPreviewNew: { fontStyle: 'italic' },

  msgRow: { flexDirection: 'row', marginBottom: 3 },
  msgRowOwn: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10 },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: colors.surface, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  senderName: { color: colors.purple, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  msgText: { color: colors.text, fontSize: 15, lineHeight: 20 },
  msgTextOwn: { color: '#fff' },
  ts: { color: colors.textMuted, fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },
  tsOwn: { color: 'rgba(255,255,255,0.6)' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: colors.textFaint, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },

  inputBar: {
    flexDirection: 'row', gap: 10, padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1, borderTopColor: colors.surface,
    backgroundColor: colors.bg, alignItems: 'flex-end',
  },
  input: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1,
    borderColor: colors.border, color: colors.text, fontSize: 14,
    paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  sendBtnOff: { opacity: 0.35, shadowOpacity: 0 },
  sendIcon: { color: '#fff', fontSize: 18 },
});
