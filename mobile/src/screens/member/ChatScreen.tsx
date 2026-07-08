import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';

export default function ChatScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);

  const { isLoading } = useQuery({
    queryKey: ['chat-history'],
    queryFn: async () => {
      const res: any = await api.get('/chat/my-messages');
      const msgs: any[] = Array.isArray(res) ? res : res?.data ?? res?.messages ?? [];
      setMessages(msgs.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      return msgs;
    },
  });

  useEffect(() => {
    let mounted = true;
    (() => {
      try {
        const socket = getSocket();
        if (!mounted) return;
        socketRef.current = socket;
        socket.on('chat:message', (msg: any) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
        });
        socket.on('connect', () => setSocketReady(true));
        socket.on('disconnect', () => setSocketReady(false));
        setSocketReady(socket.connected);
      } catch (e) {
        console.warn('Chat socket error', e);
      }
    })();
    return () => {
      mounted = false;
      socketRef.current?.off('chat:message');
    };
  }, []);

  function sendMessage() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const socket = getSocket();
      socket.emit('chat:send', { content: text.trim() });
      setText('');
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      console.warn('Send failed', e?.message);
    } finally {
      setSending(false);
    }
  }

  function isOwnMessage(msg: any) {
    return msg.senderId === user?.id || msg.sender?.id === user?.id;
  }

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.adminAvatar}>
            <Text style={{ fontSize: 16 }}>🛡️</Text>
          </View>
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Support Chat</Text>
              <View style={[styles.dot, { backgroundColor: socketReady ? '#22C55E' : '#6B7280' }]} />
            </View>
            <Text style={styles.sub}>{socketReady ? 'Connected' : 'Reconnecting…'}</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m, i) => m.id ?? String(i)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const own = isOwnMessage(item);
            const ts = new Date(item.createdAt).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit',
            });
            const senderInit = own
              ? initials
              : `${item.sender?.firstName?.[0] ?? 'A'}${item.sender?.lastName?.[0] ?? ''}`.toUpperCase();

            return (
              <View style={[styles.msgRow, own && styles.msgRowOwn]}>
                {!own && (
                  <View style={styles.msgAvatar}>
                    {item.sender?.avatar ? (
                      <Image source={{ uri: item.sender.avatar }} style={styles.msgAvatarImg} />
                    ) : (
                      <View style={styles.msgAvatarPlaceholder}>
                        <Text style={styles.msgAvatarText}>{senderInit}</Text>
                      </View>
                    )}
                  </View>
                )}
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  {!own && (
                    <Text style={styles.senderName}>
                      {item.sender?.firstName ?? 'Admin'} {item.sender?.lastName ?? ''}
                    </Text>
                  )}
                  <Text style={[styles.msgText, own && styles.msgTextOwn]}>
                    {item.content ?? item.message}
                  </Text>
                  <Text style={[styles.ts, own && styles.tsOwn]}>{ts}</Text>
                </View>
                {own && (
                  <View style={styles.msgAvatar}>
                    {user?.avatar ? (
                      <Image source={{ uri: user.avatar }} style={styles.msgAvatarImg} />
                    ) : (
                      <View style={[styles.msgAvatarPlaceholder, { backgroundColor: '#FF4D00' }]}>
                        <Text style={styles.msgAvatarText}>{initials}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Say hi to your gym's admin team</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
    backgroundColor: '#0A0A0A',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  back: { color: '#FF4D00', fontSize: 28, lineHeight: 30 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  adminAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sub: { color: '#6B7280', fontSize: 12, marginTop: 1 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  msgRowOwn: { justifyContent: 'flex-end' },
  msgAvatar: { width: 28 },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarPlaceholder: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center',
  },
  msgAvatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  bubble: {
    maxWidth: '72%', padding: 12, borderRadius: 18,
  },
  bubbleOwn: {
    backgroundColor: '#FF4D00', borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#141414', borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#1F1F1F',
  },
  senderName: { color: '#FF4D00', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  msgText: { color: '#E5E7EB', fontSize: 14, lineHeight: 20 },
  msgTextOwn: { color: '#fff' },
  ts: { color: '#6B7280', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  tsOwn: { color: 'rgba(255,255,255,0.6)' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: '#4B5563', fontSize: 13 },

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
