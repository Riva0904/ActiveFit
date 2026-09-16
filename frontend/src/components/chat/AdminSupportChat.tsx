'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { chatApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { ChatWindow, Message } from '@/components/chat/ChatWindow';
import toast from 'react-hot-toast';

/**
 * The gym admin's line to ActiveBoost support. Separate from gym messages: it
 * is the only thread that leaves the tenant.
 */
export function AdminSupportChat() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    chatApi.getSupportConversation().catch(() => {});
    chatApi.getSupportMessages()
      .then((res: any) => setMessages(Array.isArray(res) ? res : res?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    chatApi.markSupportRead().catch(() => {});
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onMessage = (msg: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      chatApi.markSupportRead().catch(() => {});
    };
    const onTyping = ({ role }: { role: string }) => {
      if (role === 'SUPER_ADMIN') {
        setTyping(true);
        setTimeout(() => setTyping(false), 2000);
      }
    };
    const onError = ({ message }: { message: string }) => toast.error(message ?? 'Message not delivered');

    socket.on('chat:support-message', onMessage);
    socket.on('chat:support-typing', onTyping);
    socket.on('chat:error', onError);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('chat:support-message', onMessage);
      socket.off('chat:support-typing', onTyping);
      socket.off('chat:error', onError);
    };
  }, []);

  const send = useCallback((content: string, attachment?: { url: string; name: string; type: string }) => {
    getSocket().emit('chat:support-send', {
      content,
      ...(attachment && { attachmentUrl: attachment.url, attachmentName: attachment.name, attachmentType: attachment.type }),
    });
  }, []);

  return (
    <div className="h-[calc(100vh-8rem)] rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <header className="p-4 border-b border-border flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-medium leading-tight">ActiveBoost support</p>
          <p className="text-xs text-muted-foreground">Billing, plans and anything platform-side</p>
        </div>
      </header>
      <ChatWindow
        currentUserId={user?.id ?? ''}
        messages={messages}
        loading={loading}
        onSend={send}
        onTyping={() => getSocket().emit('chat:support-typing', {})}
        typingUser={typing ? 'Support' : null}
        placeholder="Message ActiveBoost support"
      />
    </div>
  );
}
