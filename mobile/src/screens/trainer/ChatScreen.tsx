import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';
import { colors } from '../../theme';

export default function TrainerChatScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);

  const { isLoading } = useQuery({
    queryKey: ['trainer-chat-history'],
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
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Admin Chat</Text>
          <View style={[styles.dot, { backgroundColor: socketReady ? colors.success : colors.textMuted }]} />
        </View>
        <Text style={styles.sub}>Chat with gym administration</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m, i) => m.id ?? String(i)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 }}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const own = isOwnMessage(item);
            const ts = new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return (
              <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                {!own && (
                  <Text style={styles.senderName}>
                    {item.sender?.firstName ?? item.senderName ?? 'Admin'}
                  </Text>
                )}
                <Text style={[styles.msgText, own && styles.msgTextOwn]}>{item.content ?? item.message}</Text>
                <Text style={[styles.ts, own && styles.tsOwn]}>{ts}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 48 }}>💬</Text>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySub}>Start a conversation with admin</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message admin…"
          placeholderTextColor="#4B5563"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.surface },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bubble: { maxWidth: '80%', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10, marginBottom: 3, borderWidth: 1, borderColor: colors.border },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderTopRightRadius: 4, borderColor: colors.primary },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderTopLeftRadius: 4 },
  senderName: { color: colors.primary, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  msgText: { color: colors.text, fontSize: 15, lineHeight: 20 },
  msgTextOwn: { color: '#fff' },
  ts: { color: colors.textMuted, fontSize: 10, marginTop: 2, alignSelf: 'flex-end' },
  tsOwn: { color: 'rgba(255,255,255,0.7)' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySub: { color: colors.textFaint, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  inputRow: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 18 },
});
