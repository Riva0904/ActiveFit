import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';

export default function TrainerChatScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Admin Chat</Text>
          <View style={[styles.dot, { backgroundColor: socketReady ? '#22C55E' : '#6B7280' }]} />
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
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#F9FAFB', fontSize: 20, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sub: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: '#FF4D00', borderTopRightRadius: 4, borderColor: '#FF4D00' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#1A1A1A', borderTopLeftRadius: 4 },
  senderName: { color: '#FF4D00', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  msgText: { color: '#F9FAFB', fontSize: 14, lineHeight: 20 },
  msgTextOwn: { color: '#fff' },
  ts: { color: '#6B7280', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  tsOwn: { color: 'rgba(255,255,255,0.7)' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60 },
  emptyText: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#4B5563', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  inputRow: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#2A2A2A', backgroundColor: '#141414', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A', color: '#F9FAFB', fontSize: 14, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF4D00', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { color: '#fff', fontSize: 18 },
});
