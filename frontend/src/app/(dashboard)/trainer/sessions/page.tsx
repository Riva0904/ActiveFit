'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Calendar, Clock, CheckCircle, XCircle, Plus, Dumbbell, Star,
  TrendingUp, Users, X, ArrowLeft, ChevronDown, AlertCircle,
  CalendarCheck, Timer, BarChart3, Zap, Trash2,
} from 'lucide-react';
import { ptSessionsApi } from '@/lib/api';
import api from '@/lib/api';
import { getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { StatsCard } from '@/components/shared/StatsCard';

// ─── Types ────────────────────────────────────────────────────────────────────
type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
type FilterTab = 'ALL' | SessionStatus;

interface Session {
  id: string;
  title?: string;
  scheduledAt: string;
  duration: number;
  status: SessionStatus;
  notes?: string;
  feedback?: string;
  rating?: number;
  completedAt?: string;
  member: { id: string; memberCode?: string; user: { firstName: string; lastName: string; avatar?: string } };
  trainer: { user: { firstName: string; lastName: string } };
}

interface Member {
  id: string;
  memberCode: string;
  user: { id: string; firstName: string; lastName: string; email: string; avatar?: string };
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  SCHEDULED: { label: 'Scheduled', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-500' },
  COMPLETED:  { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500' },
  CANCELLED:  { label: 'Cancelled', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', dot: 'bg-rose-400' },
  NO_SHOW:    { label: 'No Show', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-400' },
};

// ─── Complete Session Modal ────────────────────────────────────────────────────
function CompleteModal({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: (id: string, feedback: string, rating: number) => void }) {
  const [rating, setRating]   = useState(5);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await ptSessionsApi.complete(session.id, { feedback, rating });
      onDone(session.id, feedback, rating);
      toast.success('Session marked as completed!');
      onClose();
    } catch { toast.error('Failed to complete session'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md animate-pop">
        <div className="gradient-green p-6 rounded-t-3xl relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-xl text-white">Complete Session</h2>
              <p className="text-white/70 text-sm mt-0.5">{session.member.user.firstName} {session.member.user.lastName}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Member Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRating(s)}
                  className="transition-all duration-200 hover:scale-110">
                  <Star className={cn('w-8 h-8 transition-colors', s <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                </button>
              ))}
              <span className="ml-2 text-sm font-bold text-muted-foreground">{rating}/5</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Session Feedback</label>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={3}
              placeholder="How did the session go? Any notes for next time…"
              className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10 transition-all resize-none" />
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl gradient-green text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Session Modal ────────────────────────────────────────────────────
function ScheduleModal({ members, onClose, onSuccess }: { members: Member[]; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    memberId: '', title: '', scheduledAt: '', duration: '60', notes: '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.memberId) { toast.error('Select a member'); return; }
    if (!form.scheduledAt) { toast.error('Set a date & time'); return; }
    setSaving(true);
    try {
      await ptSessionsApi.create(form);
      toast.success('Session scheduled!');
      onSuccess();
      onClose();
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed to schedule'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg animate-pop overflow-hidden">
        <div className="gradient-purple p-6 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-xl text-white">Schedule Session</h2>
              <p className="text-white/70 text-sm mt-0.5">Book a PT session with a member</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Member select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Member *</label>
            {members.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No assigned members yet. Ask your admin to assign members to you.
              </div>
            ) : (
              <div className="relative">
                <select value={form.memberId} onChange={e => set('memberId', e.target.value)}
                  className="w-full h-10 pl-3 pr-8 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all appearance-none">
                  <option value="">Select member…</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.user.firstName} {m.user.lastName} ({m.memberCode})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Session Title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Strength Training, Cardio Blast…"
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
          </div>

          {/* Date + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Date & Time *</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Duration (min)</label>
              <div className="relative">
                <select value={form.duration} onChange={e => set('duration', e.target.value)}
                  className="w-full h-10 pl-3 pr-8 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all appearance-none">
                  {[30, 45, 60, 75, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="Session goals, equipment needed…"
              className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none" />
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || members.length === 0}
            className="flex-1 py-2.5 rounded-xl gradient-purple text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Calendar className="w-4 h-4" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ onClose, onConfirm, deleting }: { onClose: () => void; onConfirm: () => void; deleting: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm animate-pop">
        <div className="p-6">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center mb-4">
            <Trash2 className="w-6 h-6 text-rose-500" />
          </div>
          <h2 className="font-extrabold text-lg">Delete Session?</h2>
          <p className="text-sm text-muted-foreground mt-1">This action cannot be undone. The session record will be permanently removed.</p>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {deleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ session, onComplete, onCancel, onDelete }: {
  session: Session;
  onComplete: (s: Session) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const st = STATUS[session.status] ?? STATUS.SCHEDULED;
  const date = new Date(session.scheduledAt);
  const isToday = new Date().toDateString() === date.toDateString();
  const isPast = date < new Date() && session.status === 'SCHEDULED';
  const avatar = session.member.user.avatar;

  return (
    <div className={cn(
      'group bg-card border rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lifted hover:-translate-y-0.5',
      isPast ? 'border-amber-200 dark:border-amber-800/50' : 'border-border/60',
    )}>
      {/* Top accent */}
      <div className={cn('h-1', {
        'gradient-blue': session.status === 'SCHEDULED' && !isPast,
        'bg-amber-400': isPast,
        'gradient-green': session.status === 'COMPLETED',
        'bg-rose-400': session.status === 'CANCELLED',
        'bg-amber-400 opacity-50': session.status === 'NO_SHOW',
      })} />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-2xl shrink-0 shadow-sm overflow-hidden">
            {avatar ? (
              <img src={avatar} alt={`${session.member.user.firstName} ${session.member.user.lastName}`}
                className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full gradient-purple flex items-center justify-center text-white font-extrabold text-sm">
                {getInitials(session.member.user.firstName, session.member.user.lastName)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-base leading-tight">
                  {session.member.user.firstName} {session.member.user.lastName}
                </p>
                {session.title && (
                  <p className="text-sm text-primary font-semibold mt-0.5">{session.title}</p>
                )}
              </div>
              <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border shrink-0', st.bg, st.color, st.border)}>
                <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle', st.dot)} />
                {st.label}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={cn('flex items-center gap-1.5 text-xs font-medium', isToday ? 'text-primary font-bold' : 'text-muted-foreground')}>
                <Calendar className="w-3.5 h-3.5" />
                {isToday ? 'Today' : date.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Clock className="w-3.5 h-3.5" />
                {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                <Timer className="w-3.5 h-3.5" />
                {session.duration} min
              </span>
              {isPast && (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                  Overdue
                </span>
              )}
            </div>

            {session.notes && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-1 italic">"{session.notes}"</p>
            )}

            {session.status === 'COMPLETED' && (
              <div className="mt-3 flex items-center gap-2">
                {session.rating && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn('w-3.5 h-3.5', i < (session.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20')} />
                    ))}
                  </div>
                )}
                {session.feedback && (
                  <p className="text-xs text-muted-foreground italic truncate">"{session.feedback}"</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {session.status === 'SCHEDULED' ? (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border/40">
            <button onClick={() => onComplete(session)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl gradient-green text-white hover:opacity-90 transition-all shadow-sm">
              <CheckCircle className="w-3.5 h-3.5" /> Complete
            </button>
            <button onClick={() => onCancel(session.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={() => onDelete(session.id)}
              className="w-9 flex items-center justify-center py-2 rounded-xl border border-border text-muted-foreground hover:border-rose-300 hover:text-rose-500 dark:hover:border-rose-700 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex justify-end mt-4 pt-4 border-t border-border/40">
            <button onClick={() => onDelete(session.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-border text-muted-foreground hover:border-rose-300 hover:text-rose-500 dark:hover:border-rose-700 transition-all">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TrainerSessionsPage() {
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [members, setMembers]       = useState<Member[]>([]);
  const [stats, setStats]           = useState<any>(null);
  const [filter, setFilter]         = useState<FilterTab>('ALL');
  const [loading, setLoading]       = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Session | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sessRes, statsRes, membersRes] = await Promise.all([
        ptSessionsApi.getAll({ limit: 100 }) as any,
        api.get('/pt-sessions/stats') as any,
        api.get('/pt-sessions/assigned-members') as any,
      ]);
      setSessions(sessRes?.data ?? []);
      setStats(statsRes);
      setMembers(Array.isArray(membersRes) ? membersRes : []);
    } catch {
      toast.error('Failed to load sessions');
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = filter === 'ALL' ? sessions : sessions.filter(s => s.status === filter);

  const handleCancel = async (id: string) => {
    try {
      await ptSessionsApi.cancel(id);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'CANCELLED' as SessionStatus } : s));
      toast.success('Session cancelled');
    } catch { toast.error('Failed to cancel'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await ptSessionsApi.delete(deleteTarget);
      setSessions(prev => prev.filter(s => s.id !== deleteTarget));
      toast.success('Session deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to delete session';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
    setDeleting(false);
  };

  const handleCompleted = (id: string, feedback: string, rating: number) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'COMPLETED' as SessionStatus, feedback, rating, completedAt: new Date().toISOString() } : s));
    if (stats) setStats((prev: any) => ({ ...prev, completed: (prev.completed ?? 0) + 1, scheduled: Math.max(0, (prev.scheduled ?? 1) - 1) }));
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'SCHEDULED', label: 'Scheduled' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  const tabCount = (k: FilterTab) => k === 'ALL' ? sessions.length : sessions.filter(s => s.status === k).length;

  const upcomingToday = sessions.filter(s => {
    const d = new Date(s.scheduledAt);
    return s.status === 'SCHEDULED' && new Date().toDateString() === d.toDateString();
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {completeTarget && (
        <CompleteModal
          session={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onDone={handleCompleted}
        />
      )}
      {showSchedule && (
        <ScheduleModal
          members={members}
          onClose={() => setShowSchedule(false)}
          onSuccess={fetchAll}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" /> PT Sessions
          </h1>
          <p className="text-muted-foreground mt-0.5">Manage your personal training sessions</p>
        </div>
        <button onClick={() => setShowSchedule(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-purple text-white font-bold text-sm shadow-sm hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" /> Schedule Session
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard title="Total Sessions" value={stats.total ?? 0} icon={Dumbbell} gradient="orange" />
          <StatsCard title="Scheduled" value={stats.scheduled ?? 0} icon={CalendarCheck} gradient="blue" />
          <StatsCard title="Completed" value={stats.completed ?? 0} icon={CheckCircle} gradient="green" />
          <StatsCard title="Completion Rate" value={`${stats.completionRate ?? 0}%`} icon={TrendingUp} gradient="purple" />
        </div>
      )}

      {/* Today's sessions banner */}
      {upcomingToday.length > 0 && (
        <div className="gradient-brand rounded-2xl p-4 flex items-center gap-4 text-white shadow-brand">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-base">
              {upcomingToday.length} session{upcomingToday.length > 1 ? 's' : ''} today
            </p>
            <p className="text-white/80 text-sm">
              Next: {upcomingToday[0].member.user.firstName} {upcomingToday[0].member.user.lastName} at{' '}
              {new Date(upcomingToday[0].scheduledAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={() => setCompleteTarget(upcomingToday[0])}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-all shrink-0">
            <CheckCircle className="w-4 h-4" /> Mark Done
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap bg-muted/40 p-1 rounded-2xl w-fit">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-1.5',
              filter === key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}>
            {label}
            <span className={cn(
              'text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
              filter === key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
            )}>
              {tabCount(key)}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 shimmer-bg rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 gradient-purple rounded-3xl flex items-center justify-center mb-4 opacity-20">
            <Dumbbell className="w-10 h-10 text-white" />
          </div>
          <p className="font-extrabold text-lg text-foreground">
            {filter === 'ALL' ? 'No sessions yet' : `No ${filter.toLowerCase()} sessions`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === 'ALL' ? 'Schedule your first session to get started.' : `Sessions with status "${filter}" will appear here.`}
          </p>
          {filter === 'ALL' && (
            <button onClick={() => setShowSchedule(true)}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-purple text-white font-bold text-sm hover:opacity-90 transition-all">
              <Plus className="w-4 h-4" /> Schedule First Session
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              onComplete={setCompleteTarget}
              onCancel={handleCancel}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}
    </div>
  );
}
