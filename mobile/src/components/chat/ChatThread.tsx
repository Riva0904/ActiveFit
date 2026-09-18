import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking,
  Platform, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../Text';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';
import { Avatar, Icon } from '../index';
import { colors } from '../../theme';

export interface ChatAttachment {
  url: string;
  name: string;
  type: string;
}

export interface ChatMessage {
  id?: string;
  content: string;
  createdAt: string;
  senderId?: string;
  sender?: { id: string; firstName: string; lastName: string; role: string; avatar?: string | null };
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  reactions?: { emoji: string; userId: string; userName: string }[];
  _temp?: boolean;
}

/**
 * Everything that differs between a 1:1 thread and a group room. Keeping the
 * differences in one object means the message list, the composer, attachments,
 * typing, reactions and delete exist exactly once.
 */
export interface ChatThreadConfig {
  /** Stable react-query key for this thread's messages. */
  queryKey: readonly unknown[];
  fetchMessages: () => Promise<ChatMessage[]>;
  markRead: () => Promise<unknown>;
  /** Socket event carrying new messages, and a filter for "is it this thread?". */
  incomingEvent: string;
  belongsToThread: (msg: any) => boolean;
  /** Build the socket payload for a send. */
  sendEvent: string;
  sendPayload: (content: string, attachment?: ChatAttachment) => Record<string, unknown>;
  /** Typing: event name plus its payload, or null to disable. */
  typingEvent?: { name: string; payload: Record<string, unknown>; belongsToThread: (p: any) => boolean } | null;
  /** True when senders should be labelled — a group needs names, a 1:1 does not. */
  showSenderNames?: boolean;
  emptyTitle: string;
  emptySubtitle: string;
  placeholder: string;
}

const REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏'];
const isImage = (type?: string | null) => !!type && type.startsWith('image/');

/**
 * What the document picker will offer. Kept in step with the server's own
 * `fileFilter` (`chat.controller.ts`), which rejects anything else with a 400.
 */
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'video/mp4',
  'audio/mpeg',
];

/** One chip per distinct emoji, carrying how many people picked it. */
function tallyReactions(reactions: { emoji: string }[]): { emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  return [...counts].map(([emoji, count]) => ({ emoji, count }));
}

/** Message ids the user reacted to are keyed by id; a pending message has none yet. */
export function ChatThread({
  config,
  header,
  onThreadsChanged,
}: {
  config: ChatThreadConfig;
  header: React.ReactNode;
  /** Called when the inbox should refetch (new message, read receipt). */
  onThreadsChanged?: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [socketReady, setSocketReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const flatRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);
  const typingSentAt = useRef(0);
  const typingTimers = useRef<Record<string, any>>({});

  // The socket handlers must see the *current* config without re-subscribing on
  // every render — a stale closure here is what made the old support screen
  // deliver messages into the previously selected thread.
  const configRef = useRef(config);
  configRef.current = config;

  const scrollSoon = useCallback((animated = true) => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated }), 60);
  }, []);

  const { isLoading } = useQuery({
    queryKey: config.queryKey,
    queryFn: async () => {
      const msgs = await config.fetchMessages();
      setMessages([...msgs].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)));
      // Opening the thread is what clears its unread count.
      config.markRead().catch(() => {});
      onThreadsChanged?.();
      return msgs;
    },
  });

  useEffect(() => {
    let mounted = true;
    let socket: any;
    try {
      socket = getSocket();
      socketRef.current = socket;

      const onMessage = (msg: any) => {
        if (!mounted) return;
        if (!configRef.current.belongsToThread(msg)) {
          queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
          return;
        }
        setMessages((prev) => {
          if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
          // Drop the optimistic twin of the message that just came back.
          const withoutTemp = prev.filter((m) => !(m._temp && m.content === msg.content));
          return [...withoutTemp, msg];
        });
        const from = msg.senderId ?? msg.sender?.id;
        if (from !== user?.id) configRef.current.markRead().catch(() => {});
        scrollSoon();
      };

      const onDeleted = ({ messageId }: any) => {
        if (!mounted) return;
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      };

      const onReaction = ({ messageId, reactions }: any) => {
        if (!mounted) return;
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
      };

      const onTyping = (payload: any) => {
        if (!mounted) return;
        const typingCfg = configRef.current.typingEvent;
        if (!typingCfg || !typingCfg.belongsToThread(payload)) return;
        const name = payload.name ?? 'Someone';
        setTypingNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
        clearTimeout(typingTimers.current[name]);
        typingTimers.current[name] = setTimeout(() => {
          setTypingNames((prev) => prev.filter((n) => n !== name));
        }, 3500);
      };

      const onError = (e: any) => mounted && setError(e?.message ?? 'Message not delivered');
      const onConnect = () => mounted && setSocketReady(true);
      const onDisconnect = () => mounted && setSocketReady(false);

      socket.on(config.incomingEvent, onMessage);
      socket.on('chat:deleted', onDeleted);
      socket.on('chat:reaction', onReaction);
      socket.on('chat:error', onError);
      // Named handlers, not bare `socket.off('connect')` — that removed every
      // listener for those events across the whole app.
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      if (config.typingEvent) socket.on(config.typingEvent.name, onTyping);

      if (!socket.connected) socket.connect();
      setSocketReady(socket.connected);

      const typingEventName = config.typingEvent?.name;
      return () => {
        mounted = false;
        socket?.off(config.incomingEvent, onMessage);
        socket?.off('chat:deleted', onDeleted);
        socket?.off('chat:reaction', onReaction);
        socket?.off('chat:error', onError);
        socket?.off('connect', onConnect);
        socket?.off('disconnect', onDisconnect);
        if (typingEventName) socket?.off(typingEventName, onTyping);
        Object.values(typingTimers.current).forEach(clearTimeout);
        typingTimers.current = {};
      };
    } catch {
      return undefined;
    }
    // Re-subscribe only when the thread itself changes.
  }, [config.incomingEvent, config.typingEvent?.name, JSON.stringify(config.queryKey), queryClient, user?.id, scrollSoon]);

  const emit = useCallback((content: string, attachment?: ChatAttachment) => {
    const optimistic: ChatMessage = {
      _temp: true,
      content,
      createdAt: new Date().toISOString(),
      senderId: user?.id,
      sender: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role, avatar: user.avatar } as any : undefined,
      attachmentUrl: attachment?.url ?? null,
      attachmentName: attachment?.name ?? null,
      attachmentType: attachment?.type ?? null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setError(null);
    scrollSoon();
    try {
      socketRef.current?.emit(config.sendEvent, config.sendPayload(content, attachment));
      onThreadsChanged?.();
    } catch {
      setMessages((prev) => prev.filter((m) => m !== optimistic));
      setError('Could not send. Check your connection.');
    }
  }, [config, user, scrollSoon, onThreadsChanged]);

  function send() {
    const content = text.trim();
    if (!content) return;
    setText('');
    emit(content);
  }

  function onChangeText(next: string) {
    setText(next);
    const typingCfg = config.typingEvent;
    // Throttle: one "is typing" per 2 s, not one per keystroke.
    if (typingCfg && next && Date.now() - typingSentAt.current > 2000) {
      typingSentAt.current = Date.now();
      try { socketRef.current?.emit(typingCfg.name, typingCfg.payload); } catch { /* offline */ }
    }
  }

  /** Uploads one picked file and sends it as the message's attachment. */
  async function upload(file: { uri: string; name: string; type: string }) {
    setUploading(true);
    try {
      const formData = new FormData();
      // Content-Type is left to axios so it generates the multipart boundary.
      formData.append('file', file as any);
      const uploaded: any = await api.post('/chat/upload', formData);
      emit(text.trim(), { url: uploaded.url, name: uploaded.name, type: uploaded.type });
      setText('');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Try again');
    } finally {
      setUploading(false);
    }
  }

  async function attachPhoto(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', `Allow ${source === 'camera' ? 'camera' : 'photo'} access in Settings to continue.`);
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    await upload({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  }

  async function attachDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      // Mirrors the server's own fileFilter in chat.controller.ts — picking
      // something it would reject is a worse experience than not offering it.
      type: ALLOWED_DOCUMENT_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    await upload({
      uri: asset.uri,
      name: asset.name ?? `file-${Date.now()}`,
      type: asset.mimeType ?? 'application/octet-stream',
    });
  }

  function attach() {
    Alert.alert('Send an attachment', undefined, [
      { text: 'Photo', onPress: () => attachPhoto('library') },
      { text: 'Camera', onPress: () => attachPhoto('camera') },
      { text: 'File', onPress: attachDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function onLongPressMessage(msg: ChatMessage) {
    if (!msg.id) return; // still sending
    const own = (msg.senderId ?? msg.sender?.id) === user?.id;
    Alert.alert('Message', undefined, [
      ...REACTIONS.map((emoji) => ({
        text: emoji,
        onPress: () => socketRef.current?.emit('chat:react', { messageId: msg.id, emoji }),
      })),
      ...(own
        ? [{
            text: 'Delete',
            style: 'destructive' as const,
            onPress: () => socketRef.current?.emit('chat:delete', { messageId: msg.id }),
          }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  const typingLine = useMemo(() => {
    if (typingNames.length === 0) return null;
    if (typingNames.length === 1) return `${typingNames[0]} is typing…`;
    return `${typingNames.length} people are typing…`;
  }, [typingNames]);

  const mine = (msg: ChatMessage) => (msg.senderId ?? msg.sender?.id) === user?.id;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {header}
      {!socketReady ? <Text style={styles.reconnecting}>Reconnecting…</Text> : null}

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
              <Text style={styles.emptyTitle}>{config.emptyTitle}</Text>
              <Text style={styles.emptySub}>{config.emptySubtitle}</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const own = mine(item);
            const prev = messages[index - 1];
            const senderId = item.senderId ?? item.sender?.id;
            const showName =
              config.showSenderNames && !own && senderId !== (prev?.senderId ?? prev?.sender?.id);
            const ts = new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const reactions = item.reactions ?? [];

            return (
              <View style={[styles.msgRow, own && styles.msgRowOwn]}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onLongPress={() => onLongPressMessage(item)}
                  style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}
                >
                  {showName ? (
                    <Text style={styles.senderName}>
                      {item.sender?.firstName} {item.sender?.lastName}
                    </Text>
                  ) : null}

                  {item.attachmentUrl ? (
                    isImage(item.attachmentType) ? (
                      <TouchableOpacity onPress={() => Linking.openURL(item.attachmentUrl!).catch(() => {})}>
                        <Image source={{ uri: item.attachmentUrl }} style={styles.attachImage} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.fileRow}
                        onPress={() => Linking.openURL(item.attachmentUrl!).catch(() => {})}
                      >
                        <Icon name="paperclip" size={14} color={own ? colors.white : colors.primary} />
                        <Text style={[styles.fileName, own && styles.msgTextOwn]} numberOfLines={1}>
                          {item.attachmentName ?? 'Attachment'}
                        </Text>
                      </TouchableOpacity>
                    )
                  ) : null}

                  <View style={styles.msgLine}>
                    {item.content ? (
                      <Text style={[styles.msgText, own && styles.msgTextOwn]}>{item.content}</Text>
                    ) : null}
                    <Text style={[styles.ts, own && styles.tsOwn]}>{ts}</Text>
                  </View>

                  {reactions.length > 0 ? (
                    <View style={styles.reactionRow}>
                      {tallyReactions(reactions).map(({ emoji, count }) => (
                        <View key={emoji} style={styles.reactionChip}>
                          <Text style={styles.reactionText}>{emoji}{count > 1 ? ` ${count}` : ''}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {typingLine ? <Text style={styles.typing}>{typingLine}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn} onPress={attach} disabled={uploading} hitSlop={8}>
          {uploading
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Icon name="paperclip" size={19} color={colors.textMuted} />}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onChangeText}
          placeholder={config.placeholder}
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
  reconnecting: { color: colors.textMuted, fontSize: 11, textAlign: 'center', paddingVertical: 4 },

  listContent: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },
  msgRow: { flexDirection: 'row', marginBottom: 3 },
  msgRowOwn: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10 },
  bubbleOwn: { backgroundColor: colors.primary, borderTopRightRadius: 2 },
  bubbleOther: {
    backgroundColor: colors.surface, borderTopLeftRadius: 2,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  senderName: { color: colors.primary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  msgLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: 8 },
  msgText: { color: colors.text, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  msgTextOwn: { color: colors.white },
  ts: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginLeft: 'auto', paddingTop: 4 },
  tsOwn: { color: 'rgba(255,255,255,0.65)' },

  attachImage: { width: 200, height: 150, borderRadius: 8, marginBottom: 4 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  fileName: { color: colors.text, fontSize: 13, flexShrink: 1, textDecorationLine: 'underline' },

  reactionRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  reactionChip: {
    backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
    borderWidth: 1, borderColor: colors.border,
  },
  reactionText: { fontSize: 11, color: colors.text },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 6 },
  emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '600' },
  emptySub: { color: colors.textFaint, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  typing: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', paddingHorizontal: 16, paddingBottom: 4 },
  error: { color: colors.danger, fontSize: 12, textAlign: 'center', paddingBottom: 6 },
  inputBar: {
    flexDirection: 'row', gap: 8, padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1, borderTopColor: colors.surface, backgroundColor: colors.bg, alignItems: 'flex-end',
  },
  attachBtn: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
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

/** Shared chat header — avatar (or group glyph), title, subtitle, back. */
export function ChatHeader({
  title,
  subtitle,
  avatar,
  firstName,
  lastName,
  icon,
  onBack,
  onPressTitle,
  right,
}: {
  title: string;
  subtitle?: string;
  avatar?: string | null;
  firstName?: string;
  lastName?: string;
  icon?: 'account-group-outline';
  onBack: () => void;
  onPressTitle?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={headerStyles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={10} style={headerStyles.backBtn}>
        <Icon name="chevron-left" size={24} color={colors.primary} />
      </TouchableOpacity>
      {icon ? (
        <View style={headerStyles.groupIcon}>
          <Icon name="account-group-outline" size={20} color={colors.primary} />
        </View>
      ) : (
        <Avatar uri={avatar} firstName={firstName} lastName={lastName} size={38} />
      )}
      <TouchableOpacity style={headerStyles.headerText} onPress={onPressTitle} disabled={!onPressTitle} activeOpacity={0.7}>
        <Text style={headerStyles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={headerStyles.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </TouchableOpacity>
      {right}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.surface, backgroundColor: colors.bg,
  },
  backBtn: { width: 30, alignItems: 'center' },
  groupIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
});
