'use client';

import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Search, ShieldCheck, Building2, X } from 'lucide-react';
import { chatApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { ChatWindow, Message } from '@/components/chat/ChatWindow';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface SupportConv {
  id: string;
  gymId: string;
  userId: string;
  lastMessage?: string;
  lastMessageAt: string;
  unreadAdmin: number; // unread for super admin
  user: { id: string; firstName: string; lastName: string; role: string; avatar?: string };
  gym: { id: string; name: string; logo?: string };
}

function GymAvatar({ name, logo }: { name: string; logo?: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  if (logo) return <img src={logo} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />;
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
      {initials}
    </div>
  );
}

export default function SuperAdminChatPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<SupportConv[]>([]);
  const [selected, setSelected] = useState<SupportConv | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [typingUser, setTypingUser] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');

  // Load all gym admin support conversations
  useEffect(() => {
    chatApi.getAllSupportConversations()
      .then((res: any) => setConversations(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Load messages when a conversation is selected
  useEffect(() => {
    if (!selected) return;
    setLoadingMsgs(true);
    setShowMsgSearch(false);
    setMsgSearchQuery('');
    chatApi.getAdminSupportMessages(selected.userId, selected.gymId)
      .then((res: any) => setMessages(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoadingMsgs(false));
    chatApi.markAdminSupportRead(selected.userId, selected.gymId).catch(() => {});
    setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, unreadAdmin: 0 } : c));
  }, [selected?.id]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();

    const handleSupportMessage = (msg: Message) => {
      const isFromSuperAdmin = msg.sender.role === 'SUPER_ADMIN';
      // Find conversation for this message by sender/receiver
      const senderIsGymAdmin = msg.sender.role === 'GYM_ADMIN';

      if (selected && (msg.sender.id === selected.userId || (isFromSuperAdmin && selected))) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Auto-mark read when conversation is open
        if (!isFromSuperAdmin) {
          chatApi.markAdminSupportRead(selected.userId, selected.gymId).catch(() => {});
        }
      }

      setConversations((prev) => {
        const updated = prev.map((c) => {
          const isThisConv = senderIsGymAdmin
            ? c.userId === msg.sender.id
            : c.userId === selected?.userId;
          if (!isThisConv) return c;
          const preview = msg.attachmentUrl ? `📎 ${msg.attachmentName ?? 'File'}` : msg.content;
          const isOpen = selected?.userId === c.userId;
          const newUnread = (!isFromSuperAdmin && !isOpen) ? c.unreadAdmin + 1 : isOpen ? 0 : c.unreadAdmin;
          return { ...c, lastMessage: preview, lastMessageAt: msg.createdAt, unreadAdmin: newUnread };
        });

        // If new gym admin messaged and we don't have their conversation yet, refresh
        const gymAdminId = senderIsGymAdmin ? msg.sender.id : null;
        const exists = gymAdminId ? prev.some((c) => c.userId === gymAdminId) : true;
        if (!exists) {
          chatApi.getAllSupportConversations()
            .then((res: any) => setConversations(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
            .catch(() => {});
          return prev;
        }
        return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      });
    };

    const handleTyping = ({ role }: { role: string }) => {
      if (role === 'GYM_ADMIN') {
        setTypingUser(true);
        setTimeout(() => setTypingUser(false), 2000);
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

    const handleReconnect = () => {
      if (!selected) return;
      chatApi.getAdminSupportMessages(selected.userId, selected.gymId)
        .then((res: any) => setMessages(Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : []))
        .catch(() => {});
    };

    socket.on('chat:support-message', handleSupportMessage);
    socket.on('chat:support-typing', handleTyping);
    socket.on('chat:error', handleError);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:deleted', handleDeleted);
    socket.io.on('reconnect', handleReconnect);

    return () => {
      socket.off('chat:support-message', handleSupportMessage);
      socket.off('chat:support-typing', handleTyping);
      socket.off('chat:error', handleError);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:deleted', handleDeleted);
      socket.io.off('reconnect', handleReconnect);
    };
  }, [selected]);

  const handleSend = useCallback((content: string, attachment?: { url: string; name: string; type: string }) => {
    if (!selected || !user) return;
    const socket = getSocket();
    socket.emit('chat:support-send', {
      toGymAdminId: selected.userId,
      gymId: selected.gymId,
      content,
      ...attachment && { attachmentUrl: attachment.url, attachmentName: attachment.name, attachmentType: attachment.type },
    });
  }, [selected, user]);

  const handleTypingEmit = useCallback(() => {
    if (!selected) return;
    getSocket().emit('chat:support-typing', { toGymAdminId: selected.userId });
  }, [selected]);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    getSocket().emit('chat:react', { messageId, emoji });
    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m;
      const reactions = [...(m.reactions || [])];
      const idx = reactions.findIndex((r) => r.userId === user?.id && r.emoji === emoji);
      if (idx >= 0) reactions.splice(idx, 1);
      else reactions.push({ emoji, userId: user?.id || '', userName: `${user?.firstName} ${user?.lastName}` });
      return { ...m, reactions };
    }));
  }, [user]);

  const handleDelete = useCallback((messageId: string) => {
    getSocket().emit('chat:delete', { messageId });
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const toggleMsgSearch = () => {
    setShowMsgSearch((v) => {
      if (v) setMsgSearchQuery('');
      return !v;
    });
  };

  const filtered = conversations.filter((c) => {
    const gymName = c.gym?.name?.toLowerCase() ?? '';
    const adminName = `${c.user.firstName} ${c.user.lastName}`.toLowerCase();
    const q = convSearch.toLowerCase();
    return gymName.includes(q) || adminName.includes(q);
  });

  const totalUnread = conversations.reduce((s, c) => s + c.unreadAdmin, 0);

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-2rem)] rounded-2xl border border-border/60 overflow-hidden bg-card shadow-sm">

      {/* ── Left: Conversation list ───────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border/60">
        <div className="px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
              <h2 className="font-bold text-base">Support</h2>
              {totalUnread > 0 && (
                <span className="text-[10px] font-bold bg-purple-500 text-white px-1.5 py-0.5 rounded-full">{totalUnread}</span>
              )}
            </div>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              placeholder="Search gyms…"
              className="w-full h-9 pl-9 pr-3 text-sm bg-muted/60 border border-border/40 rounded-xl outline-none focus:border-purple-400/60 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No support requests yet</p>
            </div>
          ) : filtered.map((conv) => {
            const adminName = `${conv.user.firstName} ${conv.user.lastName}`;
            const isActive = conv.id === selected?.id;
            return (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-border/20',
                  isActive ? 'bg-purple-500/8 border-l-2 border-l-purple-500' : 'hover:bg-muted/50',
                )}
              >
                <GymAvatar name={conv.gym?.name ?? 'Gym'} logo={conv.gym?.logo} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-sm font-semibold truncate">{conv.gym?.name ?? 'Unknown Gym'}</span>
                    {conv.lastMessageAt && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-muted-foreground truncate">{adminName}</span>
                    {conv.unreadAdmin > 0 && (
                      <span className="text-[10px] font-bold bg-purple-500 text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        {conv.unreadAdmin > 9 ? '9+' : conv.unreadAdmin}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Chat area ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="border-b border-border/60 shrink-0">
              <div className="flex items-center gap-3 px-5 py-3 bg-card">
                <GymAvatar name={selected.gym?.name ?? 'Gym'} logo={selected.gym?.logo} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm leading-none">{selected.gym?.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium leading-none bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                      GYM ADMIN
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selected.user.firstName} {selected.user.lastName}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    title="Search in conversation"
                    onClick={toggleMsgSearch}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                      showMsgSearch ? 'text-purple-500 bg-purple-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                    )}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {showMsgSearch && (
                <div className="px-5 py-2 bg-muted/30 flex items-center gap-2 border-t border-border/40">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={msgSearchQuery}
                    onChange={(e) => setMsgSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && toggleMsgSearch()}
                    placeholder="Search messages…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                  {msgSearchQuery && (
                    <button onClick={() => setMsgSearchQuery('')} className="shrink-0 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={toggleMsgSearch} className="shrink-0 text-muted-foreground hover:text-foreground ml-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <ChatWindow
              currentUserId={user?.id ?? ''}
              messages={messages}
              loading={loadingMsgs}
              onSend={handleSend}
              onReact={handleReact}
              onDelete={handleDelete}
              onTyping={handleTypingEmit}
              typingUser={typingUser ? 'GYM_ADMIN' : null}
              placeholder={`Reply to ${selected.gym?.name}…`}
              filterQuery={msgSearchQuery || undefined}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-4 opacity-20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <p className="font-semibold">Select a gym conversation</p>
            <p className="text-sm mt-1">Gym admins can message you directly from their Support tab</p>
          </div>
        )}
      </div>
    </div>
  );
}
