import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';

interface Conversation {
  id: string;
  gymId: string;
  userId: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadAdmin: number;
  user: { id: string; firstName: string; lastName: string; role: string; avatar?: string };
  gym: { id: string; name: string; logo?: string };
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
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);

  // Load conversation list
  const { isLoading: loadingConvs } = useQuery({
    queryKey: ['super-admin-conversations'],
    queryFn: async () => {
      const res: any = await api.get('/chat/support/conversations');
      const list: Conversation[] = Array.isArray(res) ? res : res?.data ?? [];
      setConversations(list);
      return list;
    },
  });

  // Load messages when conversation selected
  useEffect(() => {
    if (!selected) return;
    setLoadingMsgs(true);
    setMessages([]);
    api.get(`/chat/support/conversations/${selected.userId}/messages?gymId=${selected.gymId}`)
      .then((res: any) => {
        const msgs: any[] = Array.isArray(res) ? res : res?.data ?? [];
        setMessages(msgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));

    // Mark read
    api.patch(`/chat/support/conversations/${selected.userId}/read?gymId=${selected.gymId}`).catch(() => {});
    setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, unreadAdmin: 0 } : c));
  }, [selected?.id]);

  // Socket setup
  useEffect(() => {
    let mounted = true;
    (() => {
      try {
        const socket = getSocket();
        if (!mounted) return;
        socketRef.current = socket;

        socket.on('chat:support-message', (msg: any) => {
          // Update conversation list
          setConversations((prev) => {
            const updated = prev.map((c) => {
              const isThis = c.userId === msg.sender?.id || c.userId === selected?.userId;
              if (!isThis) return c;
              return {
                ...c,
                lastMessage: msg.content,
                lastMessageAt: msg.createdAt,
                unreadAdmin: selected?.userId === c.userId ? 0 : c.unreadAdmin + 1,
              };
            });
            return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
          });

          // Append to open conversation
          if (selected) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
          }
        });

        socket.on('connect', () => setSocketReady(true));
        socket.on('disconnect', () => setSocketReady(false));
        setSocketReady(socket.connected);
      } catch (e) {
        console.warn('SuperAdmin chat socket error', e);
      }
    })();
    return () => {
      mounted = false;
      socketRef.current?.off('chat:support-message');
    };
  }, [selected]);

  function sendMessage() {
    if (!text.trim() || !selected) return;
    setSending(true);
    try {
      const socket = getSocket();
      socket.emit('chat:support-send', {
        toGymAdminId: selected.userId,
        gymId: selected.gymId,
        content: text.trim(),
      });
      setText('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      console.warn('Send failed', e?.message);
    } finally {
      setSending(false);
    }
  }

  function isOwn(msg: any) {
    return msg.senderId === user?.id || msg.sender?.id === user?.id;
  }

  // ── Conversation list view ──
  if (!selected) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Gym Admin Chats</Text>
            <Text style={styles.sub}>
              {conversations.length} gym{conversations.length !== 1 ? 's' : ''}
              {' '}· {socketReady ? 'Live' : 'Connecting…'}
            </Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: socketReady ? '#22C55E' : '#6B7280' }]} />
        </View>

        {loadingConvs ? (
          <ActivityIndicator color="#FF4D00" style={{ flex: 1 }} />
        ) : conversations.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>🏢</Text>
            <Text style={styles.emptyTitle}>No gym conversations</Text>
            <Text style={styles.emptySub}>Gym admins can message you from their support tab</Text>
          </View>
        ) : (
          <ScrollView>
            {conversations.map((conv) => (
              <TouchableOpacity
                key={conv.id}
                style={styles.convRow}
                onPress={() => setSelected(conv)}
                activeOpacity={0.7}
              >
                <GymInitials name={conv.gym?.name ?? 'Gym'} />
                <View style={styles.convInfo}>
                  <View style={styles.convTop}>
                    <Text style={styles.convName} numberOfLines={1}>{conv.gym?.name ?? 'Gym'}</Text>
                    {conv.lastMessageAt && (
                      <Text style={styles.convTime}>{timeAgo(conv.lastMessageAt)}</Text>
                    )}
                  </View>
                  <View style={styles.convBottom}>
                    <Text style={styles.convAdmin} numberOfLines={1}>
                      {conv.user.firstName} {conv.user.lastName}
                    </Text>
                    {conv.unreadAdmin > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{conv.unreadAdmin > 9 ? '9+' : conv.unreadAdmin}</Text>
                      </View>
                    )}
                  </View>
                  {conv.lastMessage && (
                    <Text style={styles.convPreview} numberOfLines={1}>{conv.lastMessage}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Chat view ──
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
          <GymInitials name={selected.gym?.name ?? 'Gym'} />
          <View>
            <Text style={styles.title}>{selected.gym?.name}</Text>
            <Text style={styles.sub}>{selected.user.firstName} {selected.user.lastName} · GYM ADMIN</Text>
          </View>
        </View>
        <View style={[styles.statusDot, { backgroundColor: socketReady ? '#22C55E' : '#6B7280' }]} />
      </View>

      {loadingMsgs ? (
        <ActivityIndicator color="#FF4D00" style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m, i) => m.id ?? String(i)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const own = isOwn(item);
            const ts = new Date(item.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit',
            });
            return (
              <View style={[styles.msgRow, own && styles.msgRowOwn]}>
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  {!own && (
                    <Text style={styles.senderName}>
                      {item.sender?.firstName ?? 'Gym Admin'}
                    </Text>
                  )}
                  <Text style={[styles.msgText, own && styles.msgTextOwn]}>
                    {item.content ?? item.message}
                  </Text>
                  <Text style={[styles.ts, own && styles.tsOwn]}>{ts}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Start the conversation</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={`Reply to ${selected.gym?.name}…`}
          placeholderTextColor="#4B5563"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
          activeOpacity={0.85}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const convStyles = StyleSheet.create({
  gymAvatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
  },
  gymAvatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
    gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back: { color: '#FF4D00', fontSize: 28, lineHeight: 30 },
  convHeaderInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  title: { color: '#F9FAFB', fontSize: 16, fontWeight: '700', flex: 1 },
  sub: { color: '#6B7280', fontSize: 11, marginTop: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  convRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#141414',
  },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convName: { color: '#F9FAFB', fontSize: 15, fontWeight: '700', flex: 1 },
  convTime: { color: '#4B5563', fontSize: 11 },
  convBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convAdmin: { color: '#9CA3AF', fontSize: 12, flex: 1 },
  unreadBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  convPreview: { color: '#4B5563', fontSize: 12 },

  msgRow: { flexDirection: 'row', marginBottom: 10 },
  msgRowOwn: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  bubbleOwn: { backgroundColor: '#FF4D00', borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: '#141414', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#1F1F1F',
  },
  senderName: { color: '#7C3AED', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  msgText: { color: '#E5E7EB', fontSize: 14, lineHeight: 20 },
  msgTextOwn: { color: '#fff' },
  ts: { color: '#6B7280', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  tsOwn: { color: 'rgba(255,255,255,0.6)' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: '#4B5563', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },

  inputBar: {
    flexDirection: 'row', gap: 10, padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
    backgroundColor: '#0A0A0A', alignItems: 'flex-end',
  },
  input: {
    flex: 1, backgroundColor: '#141414', borderRadius: 22, borderWidth: 1,
    borderColor: '#2A2A2A', color: '#F9FAFB', fontSize: 14,
    paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF4D00',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF4D00', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  sendBtnOff: { opacity: 0.35, shadowOpacity: 0 },
  sendIcon: { color: '#fff', fontSize: 18 },
});
