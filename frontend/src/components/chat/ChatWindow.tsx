'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Paperclip, X, FileText, Download, Smile, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { chatApi } from '@/lib/api';
import toast from 'react-hot-toast';

export interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; role: string; avatar?: string };
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  reactions?: Reaction[];
}

interface ChatWindowProps {
  currentUserId: string;
  targetUserId?: string;
  messages: Message[];
  loading: boolean;
  onSend: (content: string, attachment?: { url: string; name: string; type: string }) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  onTyping?: () => void;
  typingUser?: string | null;
  placeholder?: string;
  filterQuery?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';

const COMMON_EMOJIS = [
  '😊', '😂', '😍', '😘', '🥰', '😎', '🤔', '😅',
  '😢', '😤', '😁', '😆', '🙄', '😮', '😴', '😜',
  '🤣', '😩', '😱', '🥳', '😏', '🤗', '😇', '🥺',
  '👍', '👎', '👋', '🙏', '🤝', '👏', '💪', '🤙',
  '❤️', '🔥', '💯', '✅', '🎉', '⭐', '🚀', '🏆',
];

function msgTimeLabel(dateStr: string) {
  return format(new Date(dateStr), 'HH:mm');
}

function dateSeparatorLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

function Avatar({ name, avatar, size = 8 }: { name: string; avatar?: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  if (avatar) {
    return <img src={avatar} alt={name} className={`w-${size} h-${size} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

function isImageType(type?: string, name?: string) {
  if (type?.startsWith('image/')) return true;
  if (name && /\.(jpe?g|png|gif|webp)$/i.test(name)) return true;
  return false;
}

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-400/40 text-inherit rounded px-0.5">{part}</mark>
          : part,
      )}
    </>
  );
}

function AttachmentBubble({ url, name, type, isMine }: { url: string; name?: string; type?: string; isMine: boolean }) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  if (isImageType(type, name)) {
    return (
      <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={fullUrl} alt={name ?? 'image'} className="max-w-[260px] max-h-[200px] rounded-xl object-cover cursor-zoom-in" />
      </a>
    );
  }
  return (
    <a
      href={fullUrl}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2 mt-1 px-3 py-2 rounded-xl border text-sm transition-opacity hover:opacity-80',
        isMine ? 'bg-white/15 border-white/20 text-white' : 'bg-muted border-border text-foreground',
      )}
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[180px]">{name ?? 'Download file'}</span>
      <Download className="w-3.5 h-3.5 shrink-0 ml-auto" />
    </a>
  );
}

const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ChatWindow({
  currentUserId,
  messages,
  loading,
  onSend,
  onReact,
  onDelete,
  onTyping,
  typingUser,
  placeholder = 'Type a message',
  filterQuery,
}: ChatWindowProps) {
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [perMsgEmoji, setPerMsgEmoji] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Close toolbar emoji panel on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiPanelRef.current && !emojiPanelRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  // Close per-message emoji picker on outside click
  useEffect(() => {
    if (!perMsgEmoji) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-per-msg-emoji]')) {
        setPerMsgEmoji(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [perMsgEmoji]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`File too large. Maximum size is ${MAX_FILE_MB} MB (your file: ${formatFileSize(file.size)}).`);
      e.target.value = '';
      return;
    }
    setPendingFile(file);
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    e.target.value = '';
  };

  const clearFile = () => {
    setPendingFile(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
  };

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current;
    if (!ta) { setText((p) => p + emoji); return; }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    setShowEmoji(false);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  };

  const submit = async () => {
    if (!text.trim() && !pendingFile) return;

    if (pendingFile) {
      setUploading(true);
      try {
        const result = await chatApi.uploadFile(pendingFile) as { url: string; name: string; type: string };
        if (!result?.url) throw new Error('Upload failed');
        onSend(text.trim(), result);
        clearFile();
        setText('');
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? 'File upload failed';
        toast.error(Array.isArray(msg) ? msg[0] : msg);
      } finally {
        setUploading(false);
      }
    } else {
      onSend(text.trim());
      setText('');
    }
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  // Filter messages by search query
  const displayedMessages = filterQuery
    ? messages.filter((m) => m.content?.toLowerCase().includes(filterQuery.toLowerCase())
        || m.attachmentName?.toLowerCase().includes(filterQuery.toLowerCase()))
    : messages;

  const groupedMessages = displayedMessages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const d = format(new Date(msg.createdAt), 'yyyy-MM-dd');
    const last = acc[acc.length - 1];
    if (last?.date === d) last.msgs.push(msg);
    else acc.push({ date: d, msgs: [msg] });
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
        {filterQuery && displayedMessages.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 text-sm">
            No messages match &quot;{filterQuery}&quot;
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 text-sm">No messages yet. Say hi!</div>
        ) : null}

        {groupedMessages.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground font-medium px-2 shrink-0">
                {dateSeparatorLabel(date)}
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {msgs.map((msg, i) => {
              const senderId = msg.senderId || msg.sender?.id;
              const isMe = senderId === currentUserId;
              const prevSenderId = msgs[i - 1]?.senderId || msgs[i - 1]?.sender?.id;
              const prevSame = i > 0 && prevSenderId === senderId;
              const senderName = `${msg.sender.firstName} ${msg.sender.lastName}`;
              const hasContent = !!msg.content?.trim() && !msg.isDeleted;
              const hasAttachment = !!msg.attachmentUrl && !msg.isDeleted;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    'group flex items-start gap-2.5',
                    isMe ? 'flex-row-reverse' : 'flex-row',
                    prevSame ? 'mt-0.5' : 'mt-5',
                  )}
                >
                  {/* Avatar — only first in group */}
                  {!prevSame ? (
                    <div className="shrink-0 mt-0.5">
                      <Avatar name={senderName} avatar={msg.sender.avatar} size={8} />
                    </div>
                  ) : (
                    <div className="w-8 shrink-0" />
                  )}

                  <div className={cn('flex flex-col max-w-[65%]', isMe ? 'items-end' : 'items-start')}>
                    {/* Sender name + timestamp (first in group) */}
                    {!prevSame && (
                      <div className={cn('flex items-baseline gap-2 mb-1', isMe ? 'flex-row-reverse' : 'flex-row')}>
                        <span className="text-sm font-semibold text-foreground">
                          {isMe ? 'You' : senderName}
                        </span>
                        {msg.isEdited && (
                          <span className="text-xs text-muted-foreground italic">Edited</span>
                        )}
                        <span className="text-xs text-muted-foreground">{msgTimeLabel(msg.createdAt)}</span>
                      </div>
                    )}

                    {/* Bubble */}
                    {msg.isDeleted ? (
                      <div className="px-4 py-2.5 text-sm italic text-muted-foreground bg-muted/30 border border-dashed border-border/40 rounded-2xl flex items-center gap-1.5">
                        <Trash2 className="w-3 h-3 shrink-0 opacity-50" />
                        This message was deleted
                      </div>
                    ) : (hasContent || hasAttachment) && (
                      <div
                        className={cn(
                          'px-4 py-2.5 text-sm leading-relaxed break-words',
                          isMe
                            ? 'gradient-brand text-white rounded-2xl'
                            : cn(
                                'bg-muted/70 dark:bg-muted/50 text-foreground border border-border/30',
                                !prevSame ? 'rounded-2xl rounded-tl-none' : 'rounded-2xl',
                              ),
                        )}
                      >
                        {hasContent && (
                          <p className={cn(hasAttachment && 'mb-1')}>
                            <HighlightText text={msg.content} query={filterQuery} />
                          </p>
                        )}
                        {hasAttachment && (
                          <AttachmentBubble
                            url={msg.attachmentUrl!}
                            name={msg.attachmentName}
                            type={msg.attachmentType}
                            isMine={isMe}
                          />
                        )}
                      </div>
                    )}

                    {/* Hover timestamp for continuation messages */}
                    {prevSame && (
                      <span className="text-[10px] text-muted-foreground mt-0.5 hidden group-hover:inline-block">
                        {msgTimeLabel(msg.createdAt)}
                      </span>
                    )}

                    {/* Reaction bubbles — shown below bubble */}
                    {!msg.isDeleted && msg.reactions && msg.reactions.length > 0 && (
                      <div className={cn('flex flex-wrap gap-1 mt-0.5', isMe ? 'justify-end' : 'justify-start')}>
                        {Object.entries(
                          msg.reactions.reduce<Record<string, { count: number; hasMe: boolean }>>((acc, r) => {
                            if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasMe: false };
                            acc[r.emoji].count++;
                            if (r.userId === currentUserId) acc[r.emoji].hasMe = true;
                            return acc;
                          }, {})
                        ).map(([emoji, { count, hasMe }]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => onReact?.(msg.id, emoji)}
                            className={cn(
                              'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all hover:scale-105',
                              hasMe
                                ? 'bg-primary/15 border-primary/40 text-primary'
                                : 'bg-card border-border/60 text-foreground hover:bg-muted',
                            )}
                          >
                            <span className="text-sm leading-none">{emoji}</span>
                            {count > 1 && <span className="font-medium text-[11px] leading-none ml-0.5">{count}</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reaction bar — hover reveal (hidden for deleted messages) */}
                    {!msg.isDeleted && <div
                      className={cn(
                        'relative flex gap-1 items-center mt-0.5 transition-all overflow-hidden',
                        perMsgEmoji === msg.id ? 'h-5 opacity-100' : 'h-0 opacity-0 group-hover:h-5 group-hover:opacity-100',
                        isMe ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <div className="flex items-center gap-0.5 bg-card border border-border/60 rounded-full px-1.5 py-0.5 shadow-sm">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onReact?.(msg.id, '👍'); }}
                          className="text-[11px] leading-none hover:scale-110 transition-transform"
                          title="Like"
                        >
                          👍
                        </button>
                        <div className="w-px h-2.5 bg-border/60 mx-0.5" />
                        <button
                          data-per-msg-emoji
                          type="button"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPerMsgEmoji((prev) => prev === msg.id ? null : msg.id); }}
                          className="flex items-center justify-center hover:scale-110 transition-transform"
                          title="More reactions"
                        >
                          <Smile className="w-2.5 h-2.5 text-muted-foreground" />
                        </button>
                      </div>

                      {/* Delete button — only for own messages */}
                      {isMe && (
                        <div className="flex items-center bg-card border border-border/60 rounded-full px-1.5 py-0.5 shadow-sm">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete?.(msg.id); }}
                            className="flex items-center justify-center hover:text-destructive hover:scale-110 transition-all text-muted-foreground"
                            title="Delete message"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {perMsgEmoji === msg.id && (
                        <div
                          data-per-msg-emoji
                          className={cn(
                            'absolute bottom-full mb-1 p-2 bg-card border border-border/60 rounded-2xl shadow-xl grid grid-cols-8 gap-0.5 z-50 w-72',
                            isMe ? 'right-0' : 'left-0',
                          )}
                        >
                          {COMMON_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onReact?.(msg.id, emoji); setPerMsgEmoji(null); }}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-sm transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        {typingUser && (
          <div className="flex items-start gap-2.5 mt-5">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs text-muted-foreground font-bold">…</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground mb-1 block">{typingUser}</span>
              <div className="bg-muted/70 border border-border/30 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* File preview chip */}
      {pendingFile && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-1.5 text-sm max-w-xs">
            {previewUrl
              ? <img src={previewUrl} alt="preview" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              : <FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-medium">{pendingFile.name}</span>
              <span className="text-[10px] text-muted-foreground">{formatFileSize(pendingFile.size)}</span>
            </div>
            <button onClick={clearFile} className="ml-1 shrink-0 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">Click send ↗ to upload</span>
        </div>
      )}

      {/* Teams-style input card */}
      <div className="px-4 pb-4 pt-1 shrink-0">
        <div className="border border-border/60 rounded-xl bg-card shadow-sm">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              if (e.target.value) onTyping?.();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm outline-none placeholder:text-muted-foreground/50 leading-relaxed min-h-[44px] max-h-[120px] overflow-y-auto"
          />

          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-border/40">
            <div className="flex items-center gap-0.5">

              {/* Emoji button + panel */}
              <div ref={emojiPanelRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmoji((v) => !v)}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                    showEmoji
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                  title="Emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>

                {showEmoji && (
                  <div className="absolute bottom-full left-0 mb-2 p-2 bg-card border border-border/60 rounded-2xl shadow-xl grid grid-cols-8 gap-0.5 z-50 w-72">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-sm transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* File attachment — using <label> for guaranteed cross-browser file picker */}
              <label
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.mp4,.mp3"
                  onChange={handleFileChange}
                />
              </label>

              {/* Image attachment */}
              <label
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors cursor-pointer"
                title="Attach image"
              >
                <ImageIcon className="w-4 h-4" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>

              {/* Plus — more options */}
              <button
                type="button"
                onClick={() => toast('More attachment options coming soon', { icon: '📎' })}
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors"
                title="More options"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Send */}
            <button
              type="button"
              onClick={submit}
              disabled={(!text.trim() && !pendingFile) || uploading}
              className="w-8 h-8 rounded-lg gradient-brand text-white flex items-center justify-center disabled:opacity-30 transition-all hover:opacity-90"
              title="Send"
            >
              {uploading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
