'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Plus, Search, X } from 'lucide-react';
import { chatApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { ChatWindow, Message } from '@/components/chat/ChatWindow';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string | null;
  memberCode?: string | null;
}

interface Thread {
  id: string;
  peer: Person;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
}

const ROLE_LABEL: Record<string, string> = {
  GYM_ADMIN: 'Gym admin',
  TRAINER: 'Trainer',
  STAFF: 'Front desk',
  MEMBER: 'Member',
};

function PersonAvatar({ person, size = 40 }: { person: Person; size?: number }) {
  const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  if (person.avatar) {
    return <img src={person.avatar} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div
      className="rounded-full gradient-brand flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

/**
 * Private messages for everyone inside a gym.
 *
 * One page for all four gym roles: the server decides who each person may
 * message (a member reaches trainers, the front desk and the admin — never
 * another member) and returns only threads the caller is actually on. That is
 * the fix for the front desk being able to read the admin's conversations.
 */
export function DirectMessagesPage() {
  const { user } = useAuthStore();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [contacts, setContacts] = useState<Person[]>([]);
  const [active, setActive] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res: any = await chatApi.getThreads();
      setThreads(Array.isArray(res) ? res : res?.data ?? []);
    } catch {
      /* the list simply stays as it was */
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  useEffect(() => {
    if (!picking) return;
    chatApi.getContacts()
      .then((res: any) => setContacts(Array.isArray(res) ? res : res?.data ?? []))
      .catch(() => toast.error('Could not load your contacts'));
  }, [picking]);

  const openThread = useCallback(async (peer: Person) => {
    setActive(peer);
    setPicking(false);
    setLoadingMessages(true);
    try {
      const res: any = await chatApi.getThreadMessages(peer.id);
      setMessages(Array.isArray(res) ? res : res?.data ?? []);
      await chatApi.markThreadRead(peer.id).catch(() => {});
      setThreads((prev) => prev.map((t) => (t.peer?.id === peer.id ? { ...t, unread: 0 } : t)));
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not open this conversation');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();

    const onMessage = (msg: any) => {
      const from = msg.senderId ?? msg.sender?.id;
      const onActive = active && (from === active.id || msg.threadWith === active.id || msg.peerId === active.id);
      if (onActive) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (from === active!.id) chatApi.markThreadRead(active!.id).catch(() => {});
      }
      loadThreads();
    };
    const onTyping = ({ userId }: { userId: string }) => {
      if (active && userId === active.id) {
        setTypingUser(active.firstName);
        setTimeout(() => setTypingUser(null), 2000);
      }
    };
    const onError = ({ message }: { message: string }) => toast.error(message ?? 'Message not delivered');
    const onReaction = ({ messageId, reactions }: any) =>
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    const onDeleted = ({ messageId }: any) => setMessages((prev) => prev.filter((m) => m.id !== messageId));

    socket.on('chat:message', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:error', onError);
    socket.on('chat:reaction', onReaction);
    socket.on('chat:deleted', onDeleted);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:error', onError);
      socket.off('chat:reaction', onReaction);
      socket.off('chat:deleted', onDeleted);
    };
  }, [user?.id, active, loadThreads]);

  const send = (content: string, attachment?: { url: string; name: string; type: string }) => {
    if (!active) return;
    getSocket().emit('chat:send', {
      toUserId: active.id,
      content,
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.name,
      attachmentType: attachment?.type,
    });
  };

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => `${t.peer?.firstName} ${t.peer?.lastName}`.toLowerCase().includes(q));
  }, [threads, search]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Threads */}
      <aside className="w-80 shrink-0 flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Messages</h2>
            <p className="text-xs text-muted-foreground">Private, one to one</p>
          </div>
          <button
            onClick={() => setPicking((v) => !v)}
            className="p-2 rounded-lg bg-primary text-white hover:opacity-90"
            aria-label={picking ? 'Close contact picker' : 'New message'}
          >
            {picking ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {picking ? (
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nobody here you can message yet.</p>
            ) : (
              contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openThread(c)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 text-left"
                >
                  <PersonAvatar person={c} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[c.role] ?? c.role}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-background border border-border outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingThreads ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : filteredThreads.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No conversations yet.
                </div>
              ) : (
                filteredThreads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openThread(t.peer)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50',
                      active?.id === t.peer?.id && 'bg-accent',
                    )}
                  >
                    <PersonAvatar person={t.peer} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{t.peer?.firstName} {t.peer?.lastName}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(t.lastMessageAt), { addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground truncate">{t.lastMessage ?? ROLE_LABEL[t.peer?.role] ?? ''}</p>
                        {t.unread > 0 && (
                          <span className="text-[10px] font-bold text-white bg-primary rounded-full px-1.5 py-0.5">
                            {t.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </aside>

      {/* Thread */}
      <section className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
        {active ? (
          <>
            <header className="p-4 border-b border-border flex items-center gap-3">
              <PersonAvatar person={active} size={36} />
              <div>
                <p className="font-medium leading-tight">{active.firstName} {active.lastName}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABEL[active.role] ?? active.role}</p>
              </div>
            </header>
            <ChatWindow
              currentUserId={user?.id ?? ''}
              targetUserId={active.id}
              messages={messages}
              loading={loadingMessages}
              onSend={send}
              onReact={(messageId, emoji) => getSocket().emit('chat:react', { messageId, emoji })}
              onDelete={(messageId) => getSocket().emit('chat:delete', { messageId })}
              onTyping={() => getSocket().emit('chat:typing', { toUserId: active.id })}
              typingUser={typingUser}
              placeholder={`Message ${active.firstName}`}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
            <MessageSquare className="w-10 h-10 opacity-40" />
            <p className="text-sm">Pick a conversation, or start a new one.</p>
          </div>
        )}
      </section>
    </div>
  );
}
