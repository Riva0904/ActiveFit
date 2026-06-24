'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Calendar, Plus, CheckCircle, XCircle, Clock, User,
  Search, Star, Trash2, ChevronLeft, ChevronRight,
  Dumbbell, AlertCircle, TrendingUp, BarChart3, CalendarCheck, Zap,
  Activity, Users, Timer, Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ptSessionsApi, trainersApi, usersApi } from '@/lib/api';
import { formatDateTime, getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; textColor: string; bg: string; border: string; grad: string; icon: React.ElementType }> = {
  SCHEDULED: { label: 'Scheduled', textColor: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/15',   border: 'border-amber-200 dark:border-amber-800/50', grad: 'from-amber-500 to-orange-500', icon: Clock },
  COMPLETED: { label: 'Completed', textColor: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/15', border: 'border-emerald-200 dark:border-emerald-800/50', grad: 'from-emerald-500 to-green-600', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', textColor: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/15',    border: 'border-red-200 dark:border-red-800/50', grad: 'from-red-500 to-rose-600', icon: XCircle },
  NO_SHOW:   { label: 'No Show',   textColor: 'text-slate-500',   bg: 'bg-slate-50 dark:bg-slate-900/15',   border: 'border-slate-200 dark:border-slate-800/50', grad: 'from-slate-500 to-slate-600', icon: AlertCircle },
};

const DURATIONS = [30, 45, 60, 75, 90, 120];
const FOCUS_SUGGESTIONS = ['Strength Training', 'Cardio', 'Flexibility', 'HIIT', 'Yoga', 'Rehab', 'Boxing', 'CrossFit'];

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function Avatar({ firstName = '', lastName = '', avatar = '', size = 10 }: { firstName?: string; lastName?: string; avatar?: string; size?: number }) {
  return (
    <div className={`w-${size} h-${size} rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0 gradient-brand`}>
      {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : getInitials(firstName, lastName)}
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-125 active:scale-95">
          <Star className={`w-7 h-7 transition-colors ${n <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25'}`} />
        </button>
      ))}
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────────────── */
function SessionStatCard({ label, value, icon: Icon, grad, delay = 0 }: {
  label: string; value: number; icon: React.ElementType; grad: string; delay?: number;
}) {
  return (
    <div
      className="relative bg-card border border-border/60 rounded-2xl p-5 overflow-hidden hover:shadow-card transition-all animate-slide-up stat-highlight stagger-delay"
      style={{ '--delay': `${delay}ms` } as React.CSSProperties}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${grad} opacity-10 rounded-full -translate-y-6 translate-x-6`} />
      <div className="relative">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm mb-3`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-3xl font-extrabold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
      </div>
    </div>
  );
}

/* ─── Session Row ────────────────────────────────────────────────────────── */
function SessionRow({ s, index, onComplete, onCancel, onDelete }: {
  s: any;
  index: number;
  onComplete: (s: any) => void;
  onCancel: (id: string) => void;
  onDelete: (s: any) => void;
}) {
  const meta = STATUS_META[s.status] ?? STATUS_META.SCHEDULED;
  const StatusIcon = meta.icon;
  const overdue = s.status === 'SCHEDULED' && new Date(s.scheduledAt) < new Date();
  const isToday = (() => {
    const d = new Date(s.scheduledAt), now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  })();
  const memberName = `${s.member?.user?.firstName ?? ''} ${s.member?.user?.lastName ?? ''}`.trim() || 'Unknown Member';
  const trainerName = `${s.trainer?.user?.firstName ?? ''} ${s.trainer?.user?.lastName ?? ''}`.trim() || 'Unknown Trainer';

  return (
    <div
      className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-card animate-slide-up cursor-default stagger-delay
        ${overdue ? 'border-red-200 dark:border-red-900/50 bg-red-500/5 hover:bg-red-500/8' :
          isToday && s.status === 'SCHEDULED' ? 'border-primary/30 bg-primary/5 hover:bg-primary/8' :
          'border-border/60 bg-card hover:bg-muted/20'}`}
      style={{ '--delay': `${index * 50}ms` } as React.CSSProperties}
    >
      {/* Member avatar */}
      <Avatar firstName={s.member?.user?.firstName} lastName={s.member?.user?.lastName} avatar={s.member?.user?.avatar} size={11} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-bold text-sm">{memberName}</p>
          <span className="text-muted-foreground text-xs">with</span>
          <div className="flex items-center gap-1.5">
            <Avatar firstName={s.trainer?.user?.firstName} lastName={s.trainer?.user?.lastName} avatar={s.trainer?.user?.avatar} size={5} />
            <p className="text-sm font-semibold text-primary">{trainerName}</p>
          </div>
          {isToday && s.status === 'SCHEDULED' && (
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 animate-pulse-glow-brand">Today</span>
          )}
          {overdue && (
            <span className="text-[11px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/50 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Overdue
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {formatDateTime(s.scheduledAt)}
          </span>
          <span className="text-muted-foreground/30 text-xs">·</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Timer className="w-3 h-3" /> {s.duration} min
          </span>
          {s.title && (
            <>
              <span className="text-muted-foreground/30 text-xs">·</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{s.title}</span>
            </>
          )}
          {s.status === 'COMPLETED' && s.rating && (
            <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400" /> {s.rating}/5
            </span>
          )}
        </div>
      </div>

      {/* Status + Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border ${meta.bg} ${meta.border} ${meta.textColor}`}>
          <StatusIcon className="w-3 h-3" />
          {meta.label}
        </span>
        {s.status === 'SCHEDULED' && (
          <>
            <button
              className="h-8 px-3 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/15 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/25 transition-all flex items-center gap-1"
              onClick={() => onComplete(s)}
            >
              <CheckCircle className="w-3 h-3" /> Complete
            </button>
            <button
              className="h-8 px-3 text-xs font-bold rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/15 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/25 transition-all flex items-center gap-1"
              onClick={() => onCancel(s.id)}
            >
              <XCircle className="w-3 h-3" /> Cancel
            </button>
          </>
        )}
        <button
          className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
          onClick={() => onDelete(s)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function PtSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, scheduled: 0, completed: 0, cancelled: 0, today: 0, thisWeek: 0, completionRate: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const LIMIT = 10;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: LIMIT, page };
      if (filter) params.status = filter;
      const res: any = await ptSessionsApi.getAll(params);
      setSessions(res.data ?? []);
      setTotalPages(res.totalPages ?? 1);
    } catch {}
    setLoading(false);
  }, [filter, page]);

  const fetchStats = useCallback(async () => {
    try {
      const s: any = await ptSessionsApi.getAdminStats();
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleFilter = (f: string) => { setFilter(f); setPage(1); };

  const handleCancel = async (id: string) => {
    try {
      await ptSessionsApi.cancel(id);
      toast.success('Session cancelled');
      fetchSessions(); fetchStats();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await ptSessionsApi.delete(id);
      toast.success('Session deleted');
      setDeleteTarget(null);
      fetchSessions(); fetchStats();
    } catch {}
  };

  const visibleSessions = search
    ? sessions.filter(s => {
        const memberName = `${s.member?.user?.firstName ?? ''} ${s.member?.user?.lastName ?? ''}`.toLowerCase();
        const trainerName = `${s.trainer?.user?.firstName ?? ''} ${s.trainer?.user?.lastName ?? ''}`.toLowerCase();
        return memberName.includes(search.toLowerCase()) || trainerName.includes(search.toLowerCase());
      })
    : sessions;

  const statusTabs = [
    { key: '', label: 'All', count: stats.total },
    { key: 'SCHEDULED', label: 'Scheduled', count: stats.scheduled, dot: 'bg-amber-400' },
    { key: 'COMPLETED', label: 'Completed', count: stats.completed, dot: 'bg-emerald-400' },
    { key: 'CANCELLED', label: 'Cancelled', count: stats.cancelled, dot: 'bg-red-400' },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">PT Sessions</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {stats.total} total · <span className="font-semibold text-emerald-600">{stats.completionRate}%</span> completion rate
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> Schedule Session
        </button>
      </div>

      {/* ─── Stats Grid ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SessionStatCard label="Total Sessions" value={stats.total}     icon={BarChart3}    grad="from-blue-500 to-blue-700"      delay={0} />
        <SessionStatCard label="Scheduled"      value={stats.scheduled} icon={Clock}        grad="from-amber-500 to-orange-500"   delay={60} />
        <SessionStatCard label="Completed"      value={stats.completed} icon={CheckCircle}  grad="from-emerald-500 to-green-600"  delay={120} />
        <SessionStatCard label="Cancelled"      value={stats.cancelled} icon={XCircle}      grad="from-red-500 to-rose-600"       delay={180} />
      </div>

      {/* ─── Today/This week callout ─── */}
      {(stats.today > 0 || stats.thisWeek > 0) && (
        <div className="flex gap-3 flex-wrap animate-slide-in-right">
          {stats.today > 0 && (
            <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <CalendarCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                <span className="text-primary font-bold">{stats.today}</span> session{stats.today > 1 ? 's' : ''} today
              </span>
            </div>
          )}
          {stats.thisWeek > 0 && (
            <div className="flex items-center gap-2.5 bg-muted border border-border rounded-xl px-4 py-2.5">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{stats.thisWeek}</span> this week
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── Filters + Search ─── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search member or trainer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusTabs.map(({ key, label, count, dot }) => (
            <button
              key={key}
              onClick={() => handleFilter(key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all border
                ${filter === key
                  ? 'gradient-brand text-white border-transparent shadow-brand'
                  : 'bg-card text-muted-foreground border-border/60 hover:bg-muted/50'}`}
            >
              {dot && <span className={`w-2 h-2 rounded-full ${dot} ${filter === key ? 'bg-white' : ''}`} />}
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${filter === key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}`}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Sessions List ─── */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-card">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4" />
            Sessions
            {!loading && <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold">{visibleSessions.length}</span>}
          </h2>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 shimmer-card stagger-delay" style={{ '--delay': `${i * 80}ms` } as React.CSSProperties} />
              ))}
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <p className="font-bold text-muted-foreground">No sessions found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Try a different filter or schedule a new session</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all">
                <Plus className="w-3.5 h-3.5" /> Schedule Session
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleSessions.map((s: any, i) => (
                <SessionRow
                  key={s.id}
                  s={s}
                  index={i}
                  onComplete={setCompleteTarget}
                  onCancel={handleCancel}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateSessionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchSessions(); fetchStats(); }}
        />
      )}
      {completeTarget && (
        <CompleteModal
          session={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onDone={() => { setCompleteTarget(null); fetchSessions(); fetchStats(); }}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          session={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}
    </div>
  );
}

/* ─── Complete Modal ──────────────────────────────────────────────────────── */
function CompleteModal({ session, onClose, onDone }: { session: any; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const memberName = `${session.member?.user?.firstName ?? ''} ${session.member?.user?.lastName ?? ''}`.trim();

  const save = async () => {
    setSaving(true);
    try {
      await ptSessionsApi.complete(session.id, { feedback: feedback || undefined, rating: rating || undefined });
      toast.success('Session marked as completed!');
      onDone();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card rounded-3xl border border-border p-6 w-full max-w-md shadow-lifted animate-zoom-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-green">
            <Award className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Complete Session</h3>
            <p className="text-xs text-muted-foreground">{memberName} · {session.duration} min · {session.title}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold">Rating <span className="text-muted-foreground font-normal">(optional)</span></label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Feedback <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="How did the session go? Any notes for the member..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted/50 text-sm resize-none input-glow outline-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Modal ────────────────────────────────────────────────────────── */
function DeleteModal({ session, onClose, onConfirm }: { session: any; onClose: () => void; onConfirm: () => void }) {
  const memberName = `${session.member?.user?.firstName ?? ''} ${session.member?.user?.lastName ?? ''}`.trim() || 'this session';
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card rounded-3xl border border-border p-6 w-full max-w-sm shadow-lifted animate-zoom-in" onClick={e => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-7 h-7 text-white" />
        </div>
        <h3 className="font-extrabold text-center text-lg mb-1">Delete Session?</h3>
        <p className="text-sm text-muted-foreground text-center mb-6">
          This will permanently delete the session for <span className="font-semibold text-foreground">{memberName}</span>.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Cancel</button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-bold hover:opacity-90 transition-all">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Create Session Modal ────────────────────────────────────────────────── */
function CreateSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ trainerId: '', memberId: '', scheduledAt: '', duration: 60, title: '', notes: '' });
  const [trainers, setTrainers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      trainersApi.getAll({ limit: 100 }),
      usersApi.getAll({ limit: 100, role: 'MEMBER' }),
    ]).then(([t, m]: any[]) => {
      setTrainers(t.data ?? []);
      setMembers(m.data ?? []);
    }).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.trainerId || !form.memberId || !form.scheduledAt) {
      toast.error('Trainer, member, and date/time are required');
      return;
    }
    setSaving(true);
    try {
      await ptSessionsApi.create({
        trainerId: form.trainerId,
        memberId: form.memberId,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        duration: form.duration,
        title: form.title || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Session scheduled!');
      onCreated();
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card rounded-3xl border border-border w-full max-w-lg shadow-lifted animate-zoom-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-orange-600 p-6 rounded-t-3xl relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-extrabold text-white">Schedule PT Session</h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Trainer <span className="text-destructive">*</span></label>
              <select value={form.trainerId} onChange={e => set('trainerId', e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border/60 bg-muted/50 text-sm input-glow outline-none">
                <option value="">Select trainer</option>
                {trainers.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.user?.firstName} {t.user?.lastName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Member <span className="text-destructive">*</span></label>
              <select value={form.memberId} onChange={e => set('memberId', e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-border/60 bg-muted/50 text-sm input-glow outline-none">
                <option value="">Select member</option>
                {members.map((m: any) => (
                  <option key={m.memberId ?? m.id} value={m.memberId ?? m.id}>
                    {m.firstName} {m.lastName}{m.memberCode ? ` (${m.memberCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Date & Time <span className="text-destructive">*</span></label>
            <Input type="datetime-local" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Duration</label>
            <div className="flex gap-2 flex-wrap">
              {DURATIONS.map(d => (
                <button key={d} type="button" onClick={() => set('duration', d)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all
                    ${form.duration === d ? 'gradient-brand text-white border-transparent shadow-brand' : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/50'}`}>
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Focus Area <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Strength Training" />
            <div className="flex gap-1.5 flex-wrap">
              {FOCUS_SUGGESTIONS.map(s => (
                <button key={s} type="button" onClick={() => set('title', s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all
                    ${form.title === s ? 'bg-primary/10 border-primary/40 text-primary font-bold' : 'border-border/60 text-muted-foreground hover:bg-muted/50'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Notes <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span></label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Any instructions or notes for this session..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-muted/50 text-sm resize-none input-glow outline-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl gradient-brand text-white text-sm font-bold flex items-center justify-center gap-2 shadow-brand hover:opacity-90 disabled:opacity-60 transition-all">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
              Schedule Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
