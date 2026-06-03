'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Search, MoreHorizontal, X } from 'lucide-react';
import { chatApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { ChatWindow, Message } from '@/components/chat/ChatWindow';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export function MyChatPage() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    chatApi.getMyConversation().catch(() => {});
    chatApi.getMyMessages()
      .then((res: any) => setMessages(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
    chatApi.markMyRead().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();

    const handleMessage = (msg: Message) => {
      const isFromMe = msg.senderId === user.id || msg.sender?.id === user.id;
      const isFromAdmin = msg.sender?.role === 'GYM_ADMIN';
      if (!isFromMe && !isFromAdmin) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleTyping = ({ role }: { userId: string; role: string }) => {
      if (role === 'GYM_ADMIN') {
        setTypingUser('Admin');
        setTimeout(() => setTypingUser(null), 2000);
      }
    };

    const handleError = ({ message }: { message: string }) => {
      toast.error(message ?? 'Failed to send message');
    };

    const handleReaction = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
    };

    const handleDeleted = ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    // On reconnect, re-fetch so any deletions missed while offline are applied
    const handleReconnect = () => {
      chatApi.getMyMessages()
        .then((res: any) => setMessages(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
        .catch(() => {});
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:error', handleError);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:deleted', handleDeleted);
    socket.io.on('reconnect', handleReconnect);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:error', handleError);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:deleted', handleDeleted);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [user?.id]);

  const handleSend = useCallback((content: string, attachment?: { url: string; name: string; type: string }) => {
    const socket = getSocket();
    socket.emit('chat:send', {
      content,
      ...attachment && { attachmentUrl: attachment.url, attachmentName: attachment.name, attachmentType: attachment.type },
    });
    if (content.trim()) socket.emit('chat:typing', {});
  }, []);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    getSocket().emit('chat:react', { messageId, emoji });
    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m;
      const reactions = [...(m.reactions || [])];
      const existingIdx = reactions.findIndex((r) => r.userId === user?.id && r.emoji === emoji);
      if (existingIdx >= 0) reactions.splice(existingIdx, 1);
      else reactions.push({ emoji, userId: user?.id || '', userName: `${user?.firstName} ${user?.lastName}` });
      return { ...m, reactions };
    }));
  }, [user]);

  const handleDelete = useCallback((messageId: string) => {
    getSocket().emit('chat:delete', { messageId });
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const toggleSearch = () => {
    setShowSearch((v) => {
      if (v) setSearchQuery('');
      return !v;
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height)-2rem)] rounded-2xl border border-border/60 overflow-hidden bg-card shadow-sm">

      {/* Header */}
      <div className="border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3 px-5 py-3 bg-card">
          {/* Avatar with online dot */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-none">Gym Admin</p>
          </div>

          {/* Action icons */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              title="Search in conversation"
              onClick={toggleSearch}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                showSearch
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="More options"
              onClick={() => toast('More options coming soon', { icon: '⚙️' })}
              className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Inline search bar */}
        {showSearch && (
          <div className="px-5 py-2 bg-muted/30 flex items-center gap-2 border-t border-border/40">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && toggleSearch()}
              placeholder="Search messages…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={toggleSearch}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <ChatWindow
        currentUserId={user?.id ?? ''}
        messages={messages}
        loading={loading}
        onSend={handleSend}
        onReact={handleReact}
        onDelete={handleDelete}
        typingUser={typingUser}
        placeholder="Type a message…"
        filterQuery={searchQuery || undefined}
      />
    </div>
  );
}
