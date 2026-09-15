import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';
import { colors } from '../../theme';

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
    try {
      const socket = getSocket();
      socketRef.current = socket;

      socket.on('chat:message', (msg: any) => {
        if (!mounted) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id || (m._temp && m.content === msg.content))) return prev.map((m) => m._temp && m.content === msg.content ? msg : m);
          return [...prev, msg];
        });
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      });
      socket.on('connect', () => { if (mounted) setSocketReady(true); });
      socket.on('disconnect', () => { if (mounted) setSocketReady(false); });
      socket.on('connect_error', (e: any) => console.warn('Chat socket error', e?.message));

      if (!socket.connected) socket.connect();
      setSocketReady(socket.connected);
    } catch (e) {
      console.warn('Chat socket init error', e);
    }

    return () => {
      mounted = false;
      socketRef.current?.off('chat:message');
      socketRef.current?.off('connect');
      socketRef.current?.off('disconnect');
      socketRef.current?.off('connect_error');
    };
  }, []);

  function sendMessage() {
    const content = text.trim();
    if (!content || !socketReady) return;
    const optimistic = { _temp: true, content, createdAt: new Date().toISOString(), senderId: user?.id };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      socketRef.current?.emit('chat:send', { content });
    } catch (e: any) {
      console.warn('Send failed', e?.message);
      setMessages((prev) => prev.filter((m) => m !== optimistic));
    }
  }

  function isOwnMessage(msg: any) {
    return msg.senderId === user?.id || msg.sender?.id === user?.id;
  }


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
              <View style={[styles.dot, { backgroundColor: socketReady ? colors.success : colors.textMuted }]} />
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
            // WhatsApp-style: compact bubble, no per-message avatars, timestamp
            // sits inline at the bottom-right of the text.
            return (
              <View style={[styles.msgRow, own && styles.msgRowOwn]}>
                <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                  {!own && (
                    <Text style={styles.senderName}>
                      {item.sender?.firstName ?? 'Admin'} {item.sender?.lastName ?? ''}
                    </Text>
                  )}
                  <View style={styles.msgLine}>
                    <Text style={[styles.msgText, own && styles.msgTextOwn]}>
                      {item.content ?? item.message}
                    </Text>
                    <Text style={[styles.ts, own && styles.tsOwn]}>{ts}</Text>
                  </View>
                </View>
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
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.surface,
    backgroundColor: colors.bg,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  back: { color: colors.primary, fontSize: 28, lineHeight: 30 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  adminAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },

  msgRow: { flexDirection: 'row', marginBottom: 3 },
  msgRowOwn: { justifyContent: 'flex-end' },

  bubble: {
    maxWidth: '80%', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10,
  },
  bubbleOwn: {
    backgroundColor: colors.primary, borderTopRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: colors.surface, borderTopLeftRadius: 2,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  senderName: { color: colors.primary, fontSize: 12, fontWeight: '700', marginBottom: 1 },
  // Text and time flow on one line; when the text wraps, the time drops to the end of the last line.
  msgLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 8 },
  msgText: { color: colors.text, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  msgTextOwn: { color: '#fff' },
  ts: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginLeft: 'auto', paddingTop: 4 },
  tsOwn: { color: 'rgba(255,255,255,0.65)' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { color: colors.textFaint, fontSize: 13 },

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
