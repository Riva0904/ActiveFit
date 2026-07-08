'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, Plus, Filter, Clock, Search, X,
  IndianRupee, CreditCard, Banknote, CheckCircle2,
  AlertCircle, BarChart3, Calendar, ChevronDown, ArrowUpRight,
  Wallet, Users, ReceiptText,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { paymentsApi, usersApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  COMPLETED: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50', icon: CheckCircle2 },
  PENDING:   { label: 'Pending',   color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',    icon: Clock },
  FAILED:    { label: 'Failed',    color: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50',              icon: AlertCircle },
  REFUNDED:  { label: 'Refunded',  color: 'text-slate-500',   bg: 'bg-slate-50 dark:bg-slate-900/20 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800/50',   icon: ArrowUpRight },
};

const METHOD_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CASH:          { label: 'Cash',          icon: Banknote,  color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
  UPI:           { label: 'UPI',           icon: Wallet,    color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
  BANK_TRANSFER: { label: 'Bank Transfer', icon: BarChart3, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  RAZORPAY:      { label: 'Razorpay',      icon: CreditCard, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' },
};

/* ─── Record Payment Modal ───────────────────────────────────────────────── */
function RecordPaymentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({ amount: '', type: 'MEMBERSHIP', method: 'CASH', description: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!memberSearch.trim()) { setMembers([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res: any = await usersApi.getAll({ search: memberSearch, role: 'MEMBER', limit: 5 });
        setMembers(res.data ?? []);
      } catch {}
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [memberSearch]);

  const handleSubmit = async () => {
    if (!selectedMember) { toast.error('Please select a member'); return; }
    if (!form.amount) { toast.error('Amount is required'); return; }
    setSaving(true);
    try {
      await paymentsApi.recordCash({
        userId: selectedMember.id,
        amount: parseFloat(form.amount),
        type: form.type,
        method: form.method,
        description: form.description || undefined,
      });
      toast.success('Payment recorded successfully!');
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to record payment');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-lifted w-full max-w-md max-h-[90vh] overflow-y-auto animate-zoom-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-6 rounded-t-3xl relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-extrabold text-lg text-white">Record Payment</h2>
                <p className="text-sm text-white/70">Log a cash or bank payment</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Member search */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Member *</label>
            {selectedMember ? (
              <div className="flex items-center justify-between p-3.5 bg-primary/5 border border-primary/20 rounded-xl animate-zoom-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center text-white font-bold text-xs">
                    {selectedMember.firstName?.[0]}{selectedMember.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selectedMember.firstName} {selectedMember.lastName}</p>
                    <p className="text-xs text-muted-foreground">{selectedMember.email}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedMember(null); setMemberSearch(''); }}
                  className="text-xs text-rose-500 font-bold hover:text-rose-600 transition-colors">Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search member by name or email…"
                  className="w-full h-10 pl-9 pr-4 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
                {members.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lifted z-10 overflow-hidden animate-slide-down">
                    {members.map((m: any) => (
                      <button key={m.id} onClick={() => { setSelectedMember(m); setMembers([]); setMemberSearch(''); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-muted transition-colors flex items-center gap-2.5">
                        <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {m.firstName?.[0]}{m.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{m.firstName} {m.lastName}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searching && <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1"><span className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" /> Searching…</p>}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Amount (₹) *</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="1500"
                className="w-full h-10 pl-9 pr-4 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all">
                {['MEMBERSHIP', 'PT_SESSION', 'SUPPLEMENT', 'OTHER'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Method</label>
              <select value={form.method} onChange={e => set('method', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all">
                {['CASH', 'UPI', 'BANK_TRANSFER', 'RAZORPAY'].map(m => (
                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Description / Notes</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Monthly membership fee…"
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
          </div>
        </div>

        <div className="flex items-center gap-3 p-6 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 transition-all">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [pendingUpi, setPendingUpi] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [p, s, pu]: any[] = await Promise.all([
        paymentsApi.getAll({ limit: 30 }),
        paymentsApi.getStats(),
        paymentsApi.getPendingManualUpi(),
      ]);
      setPayments(p.data ?? []);
      setStats(s);
      setPendingUpi(Array.isArray(pu) ? pu : pu.data ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const confirmUpi = async (id: string) => {
    setConfirmingId(id);
    try {
      await paymentsApi.confirmManualUpi(id);
      toast.success('Payment confirmed — plan activated');
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to confirm payment');
    }
    setConfirmingId(null);
  };

  const filtered = payments.filter(p => {
    const matchStatus = !filterStatus || p.status === filterStatus;
    const matchSearch = !search ||
      `${p.member?.user?.firstName} ${p.member?.user?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      p.type?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {showModal && <RecordPaymentModal onClose={() => setShowModal(false)} onSuccess={fetchData} />}

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Payments & Revenue</h1>
          </div>
          <p className="text-sm text-muted-foreground">Track all financial transactions</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* ─── Pending UPI Confirmations ─── */}
      {pendingUpi.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-sm">Pending UPI Confirmations ({pendingUpi.length})</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Members marked these as paid. Check your UPI/bank app, then confirm — confirming activates their plan instantly.</p>
          <div className="space-y-2">
            {pendingUpi.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 bg-card border border-border/60 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{p.member?.user?.firstName} {p.member?.user?.lastName} <span className="text-muted-foreground font-normal">· {p.type}</span></p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(p.amount)} · marked paid {formatDate(p.memberConfirmedAt)}</p>
                </div>
                <button
                  onClick={() => confirmUpi(p.id)}
                  disabled={confirmingId === p.id}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-brand text-white text-xs font-bold hover:opacity-90 disabled:opacity-60 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {confirmingId === p.id ? 'Confirming…' : 'Confirm Received'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Revenue Stats ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-fast">
        <div className="relative bg-card border border-border/60 rounded-2xl p-5 overflow-hidden stat-highlight animate-slide-up">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 opacity-10 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-sm mb-3">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <p className="text-3xl font-extrabold">{formatCurrency(stats?.monthlyRevenue ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Monthly Revenue</p>
          </div>
        </div>
        <div className="relative bg-card border border-border/60 rounded-2xl p-5 overflow-hidden stat-highlight animate-slide-up delay-60">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 opacity-10 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm mb-3">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <p className="text-3xl font-extrabold">{formatCurrency(stats?.yearlyRevenue ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Yearly Revenue</p>
          </div>
        </div>
        <div className="relative bg-card border border-border/60 rounded-2xl p-5 overflow-hidden stat-highlight animate-slide-up delay-120">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-500 to-red-600 opacity-10 rounded-full -translate-y-6 translate-x-6" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-sm mb-3">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <p className="text-3xl font-extrabold">{formatCurrency(stats?.pendingAmount ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Pending — <span className="font-semibold">{stats?.pendingCount ?? 0} transactions</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── Transactions Card ─── */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-card overflow-hidden">
        {/* Table Header */}
        <div className="p-5 border-b border-border/50 bg-muted/20 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-bold flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-muted-foreground" />
            Transactions
            {!loading && <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">{filtered.length}</span>}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-8 pl-8 pr-3 text-xs bg-muted/50 border border-border/60 rounded-lg outline-none input-glow"
              />
            </div>
            {/* Status filter */}
            <div className="flex gap-1">
              {['', 'COMPLETED', 'PENDING', 'FAILED'].map(s => (
                <button key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn('px-2.5 py-1 rounded-lg text-xs font-bold border transition-all',
                    filterStatus === s ? 'gradient-brand text-white border-transparent' : 'bg-card border-border/60 text-muted-foreground hover:bg-muted/50')}>
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                {['Member', 'Type', 'Method', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="stagger-delay" style={{ '--delay': `${i * 50}ms` } as React.CSSProperties}>
                    <td colSpan={6} className="py-3 px-4">
                      <div className="h-9 shimmer-card" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-7 h-7 text-muted-foreground/30" />
                    </div>
                    <p className="font-bold text-muted-foreground">No payments recorded yet</p>
                    <button onClick={() => setShowModal(true)}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white font-bold text-xs shadow-brand hover:opacity-90 transition-all">
                      <Plus className="w-3.5 h-3.5" /> Record First Payment
                    </button>
                  </td>
                </tr>
              ) : filtered.map((p: any, i) => {
                const sm = STATUS_META[p.status];
                const mm = METHOD_META[p.method];
                const StatusIcon = sm?.icon ?? CheckCircle2;
                const MethodIcon = mm?.icon ?? Banknote;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors animate-slide-up group stagger-delay"
                    style={{ '--delay': `${i * 30}ms` } as React.CSSProperties}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {p.member?.user?.firstName?.[0]}{p.member?.user?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{p.member?.user?.firstName} {p.member?.user?.lastName}</p>
                          {p.description && <p className="text-xs text-muted-foreground truncate max-w-[140px]">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-lg font-medium capitalize">
                        {p.type?.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 w-fit ${mm?.color ?? 'text-muted-foreground bg-muted'}`}>
                        <MethodIcon className="w-3 h-3" />
                        {mm?.label ?? p.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-extrabold text-base">{formatCurrency(p.amount)}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl border ${sm?.bg ?? 'bg-muted text-muted-foreground'}`}>
                        <StatusIcon className="w-3 h-3" />
                        {sm?.label ?? p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(p.createdAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
