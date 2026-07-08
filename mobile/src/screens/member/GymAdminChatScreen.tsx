import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';

type TabType = 'gym' | 'support';

interface Conversation {
  id: string;
  userId: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadAdmin: number;
  user: { id: string; firstName: string; lastName: string; role: string; avatar?: string };
}

function roleColor(role: string) {
  const map: Record<string, string> = {
    MEMBER: '#3B82F6', TRAINER: '#8B5CF6', STAFF: '#0D9488',
  };
  return map[role] ?? '#6B7280';
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

export default function GymAdminChatScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<TabType>('gym');

  // GYM tab
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // SUPPORT tab
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);

  const selectedConv = conversations.find((c) => c.userId === selectedUserId);

  // Load gym conversations
  const { isLoading: loadingConvs } = useQuery({
    queryKey: ['gym-conversations'],
    queryFn: async () => {
      const res: any = await api.get('/chat/conversations');
      const list: Conversation[] = Array.isArray(res) ? res : res?.data ?? [];
      setConversations(list);
      return list;
    },
  });

  // Load gym messages when user selected
  useEffect(() => {
    if (!selectedUserId || tab !== 'gym') return;
    setLoadingMsgs(true);
    setMessages([]);
    api.get(`/chat/conversations/${selectedUserId}/messages`)
      .then((res: any) => {
        const msgs: any[] = Array.isArray(res) ? res : res?.data ?? [];
        setMessages(msgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
    api.patch(`/chat/conversations/${selectedUserId}/read`).catch(() => {});
    setConversations((prev) => prev.map((c) => c.userId === selectedUserId ? { ...c, unreadAdmin: 0 } : c));
  }, [selectedUserId, tab]);

  // Load support messages when support tab opened
  useEffect(() => {
    if (tab !== 'support') return;
    setSupportLoading(true);
    api.get('/chat/support/messages')
      .then((res: any) => {
        const msgs: any[] = Array.isArray(res) ? res : res?.data ?? [];
        setSupportMessages(msgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      })
      .catch(() => {})
      .finally(() => setSupportLoading(false));
    api.patch('/chat/support/read').catch(() => {});
    setSupportUnread(0);
  }, [tab]);

  // Socket
  useEffect(() => {
    let mounted = true;
    (() => {
      try {
        const socket = getSocket();
        if (!mounted) return;
        socketRef.current = socket;

        socket.on('chat:message', (msg: any) => {
          const isFromAdmin = msg.sender?.role === 'GYM_ADMIN' || msg.sender?.role === 'STAFF';
          const convUserId = isFromAdmin ? selectedUserId : msg.senderId ?? msg.sender?.id;

          if (convUserId === selectedUserId && tab === 'gym') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
          }
          setConversations((prev) => {
            const updated = prev.map((c) => {
              const match = isFromAdmin ? c.userId === selectedUserId : c.userId === convUserId;
              if (!match) return c;
              const preview = msg.attachmentUrl ? `📎 File` : (msg.content ?? msg.message);
              const newUnread = (!isFromAdmin && c.userId !== selectedUserId) ? c.unreadAdmin + 1 : 0;
              return { ...c, lastMessage: preview, lastMessageAt: msg.createdAt, unreadAdmin: newUnread };
            });
            const exists = prev.some((c) => c.userId === msg.senderId);
            if (!exists && !isFromAdmin) {
              api.get('/chat/conversations').then((res: any) => {
                setConversations(Array.isArray(res) ? res : res?.data ?? []);
              }).catch(() => {});
              return prev;
            }
            return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
          });
        });

        socket.on('chat:support-message', (msg: any) => {
          setSupportMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
            return [...prev, msg];
          });
          if (tab !== 'support') setSupportUnread((n) => n + 1);
        });

        socket.on('connect', () => setSocketReady(true));
        socket.on('disconnect', () => setSocketReady(false));
        setSocketReady(socket.connected);
      } catch (e) {
        console.warn('GymAdmin chat socket error', e);
      }
    })();
    return () => {
      mounted = false;
      socketRef.current?.off('chat:message');
      socketRef.current?.off('chat:support-message');
    };
  }, [selectedUserId, tab]);

  function sendGymMessage() {
    if (!text.trim() || !selectedUserId) return;
    setSending(true);
    try {
      getSocket().emit('chat:send', { toUserId: selectedUserId, content: text.trim() });
      setText('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) { console.warn('Send error', e); }
    finally { setSending(false); }
  }

  function sendSupportMessage() {
    if (!text.trim()) return;
    setSending(true);
    try {
      getSocket().emit('chat:support-send', { content: text.trim() });
      setText('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) { console.warn('Send error', e); }
    finally { setSending(false); }
  }

  function isOwn(msg: any) {
    return msg.senderId === user?.id || msg.sender?.id === user?.id;
  }

  const totalGymUnread = conversations.reduce((s, c) => s + c.unreadAdmin, 0);

  // ── Conversation list (GYM tab, no user selected) ──
  if (tab === 'gym' && !selectedUserId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Messages</Text>
          <View style={[styles.statusDot, { backgroundColor: socketReady ? '#22C55E' : '#6B7280' }]} />
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'gym' && styles.tabBtnActive]}
            onPress={() => setTab('gym')}
          >
            <Text style={[styles.tabText, tab === 'gym' && styles.tabTextActive]}>
              Members {totalGymUnread > 0 && `(${totalGymUnread})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, (tab as TabType) === 'support' && styles.tabBtnActive]}
            onPress={() => setTab('support')}
          >
            <Text style={[styles.tabText, (tab as TabType) === 'support' && styles.tabTextActive]}>
              🛡️ Platform {supportUnread > 0 && `(${supportUnread})`}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingConvs ? (
          <ActivityIndicator color="#FF4D00" style={{ flex: 1 }} />
        ) : conversations.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>Members and trainers can message you from the app</Text>
          </View>
        ) : (
          <ScrollView>
            {conversations.map((conv) => (
              <TouchableOpacity
                key={conv.id}
                style={styles.convRow}
                onPress={() => setSelectedUserId(conv.userId)}
                activeOpacity={0.7}
              >
                <View style={[styles.convAvatar, { backgroundColor: roleColor(conv.user.role) + '25' }]}>
                  {conv.user.avatar ? (
                    <Image source={{ uri: conv.user.avatar }} style={styles.convAvatarImg} />
                  ) : (
                    <Text style={[styles.convAvatarText, { color: roleColor(conv.user.role) }]}>
                      {conv.user.firstName[0]}{conv.user.lastName[0]}
                    </Text>
                  )}
                </View>
                <View style={styles.convInfo}>
                  <View style={styles.convTop}>
                    <Text style={styles.convName}>{conv.user.firstName} {conv.user.lastName}</Text>
                    {conv.lastMessageAt && <Text style={styles.convTime}>{timeAgo(conv.lastMessageAt)}</Text>}
                  </View>
                  <View style={styles.convBottom}>
                    <View style={[styles.rolePill, { backgroundColor: roleColor(conv.user.role) + '20' }]}>
                      <Text style={[styles.rolePillText, { color: roleColor(conv.user.role) }]}>
                        {conv.user.role}
                      </Text>
                    </View>
                    {conv.unreadAdmin > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{conv.unreadAdmin > 9 ? '9+' : conv.unreadAdmin}</Text>
                      </View>
                    )}
                  </View>
                  {conv.lastMessage && <Text style={styles.convPreview} numberOfLines={1}>{conv.lastMessage}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Support tab list view ──
  if (tab === 'support' && !selectedUserId) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Platform Support</Text>
          <View style={[styles.statusDot, { backgroundColor: socketReady ? '#22C55E' : '#6B7280' }]} />
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('gym')}>
            <Text style={styles.tabText}>Members {totalGymUnread > 0 && `(${totalGymUnread})`}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, styles.tabBtnActive]}>
            <Text style={styles.tabTextActive}>🛡️ Platform</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.supportHeader}>
          <View style={styles.supportAvatar}>
            <Text style={{ fontSize: 20 }}>🛡️</Text>
          </View>
          <View>
            <Text style={styles.supportName}>ActiveBoost Platform</Text>
            <Text style={styles.supportSub}>Super Admin · Direct support line</Text>
          </View>
        </View>

        {supportLoading ? (
          <ActivityIndicator color="#FF4D00" style={{ flex: 1 }} />
        ) : (
          <FlatList
            ref={flatRef}
            data={supportMessages}
            keyExtractor={(m, i) => m.id ?? String(i)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 }}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const own = isOwn(item);
              const ts = new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              return (
                <View style={[styles.msgRow, own && styles.msgRowOwn]}>
                  <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                    {!own && <Text style={styles.senderName}>{item.sender?.firstName ?? 'Super Admin'}</Text>}
                    <Text style={[styles.msgText, own && styles.msgTextOwn]}>{item.content ?? item.message}</Text>
                    <Text style={[styles.ts, own && styles.tsOwn]}>{ts}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🛡️</Text>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySub}>Message ActiveBoost platform support</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message platform support…"
            placeholderTextColor="#4B5563"
            multiline maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]}
            onPress={sendSupportMessage}
            disabled={!text.trim() || sending}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>➤</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── GYM: individual conversation ──
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setSelectedUserId(null); setText(''); }} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.convAvatar, { backgroundColor: roleColor(selectedConv?.user.role ?? '') + '25', width: 36, height: 36, borderRadius: 10 }]}>
            <Text style={[styles.convAvatarText, { color: roleColor(selectedConv?.user.role ?? ''), fontSize: 13 }]}>
              {selectedConv?.user.firstName[0]}{selectedConv?.user.lastName[0]}
            </Text>
          </View>
          <View>
            <Text style={styles.title}>{selectedConv?.user.firstName} {selectedConv?.user.lastName}</Text>
            <Text style={styles.headerSub}>{selectedConv?.user.role}</Text>
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
            const ts = new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return (
              <View style={[styles.msgRow, own && styles.msgRowOwn]}>
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  {!own && <Text style={styles.senderName}>{item.sender?.firstName ?? 'User'}</Text>}
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
          placeholder={`Reply to ${selectedConv?.user.firstName}…`}
          placeholderTextColor="#4B5563"
          multiline maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnOff]}
          onPress={sendGymMessage}
          disabled={!text.trim() || sending}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A', gap: 10,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  back: { color: '#FF4D00', fontSize: 28, lineHeight: 30 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  title: { color: '#F9FAFB', fontSize: 17, fontWeight: '700', flex: 1 },
  headerSub: { color: '#6B7280', fontSize: 11 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  tabBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    gap: 8, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    borderRadius: 10, backgroundColor: '#141414',
  },
  tabBtnActive: { backgroundColor: '#FF4D00' },
  tabText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontSize: 13, fontWeight: '700' },

  supportHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  supportAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A1A2A', alignItems: 'center', justifyContent: 'center',
  },
  supportName: { color: '#F9FAFB', fontSize: 15, fontWeight: '700' },
  supportSub: { color: '#6B7280', fontSize: 12 },

  convRow: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#141414',
  },
  convAvatar: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  convAvatarImg: { width: 44, height: 44, borderRadius: 14 },
  convAvatarText: { fontSize: 15, fontWeight: '700' },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  convName: { color: '#F9FAFB', fontSize: 14, fontWeight: '700' },
  convTime: { color: '#4B5563', fontSize: 11 },
  convBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  rolePill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  rolePillText: { fontSize: 10, fontWeight: '700' },
  unreadBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FF4D00', alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  convPreview: { color: '#4B5563', fontSize: 12 },

  msgRow: { flexDirection: 'row', marginBottom: 10 },
  msgRowOwn: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', padding: 12, borderRadius: 18 },
  bubbleOwn: { backgroundColor: '#FF4D00', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#141414', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#1F1F1F' },
  senderName: { color: '#FF4D00', fontSize: 11, fontWeight: '700', marginBottom: 3 },
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
  },
  sendBtnOff: { opacity: 0.35 },
  sendIcon: { color: '#fff', fontSize: 18 },
});
