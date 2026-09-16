'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Wallet, Search, CheckCircle2, Clock, Loader2, Plus, IndianRupee, Users, Filter,
} from 'lucide-react';
import { salaryPayoutsApi, usersApi } from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Payout {
  id: string;
  amount: number;
  periodLabel: string;
  status: 'PENDING' | 'PAID';
  notes?: string;
  paidAt?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; role: string; payoutUpiVpa?: string | null };
}

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  payoutUpiVpa?: string | null;
}

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
];

export default function PayrollPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [marking, setMarking] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const fetchPayouts = () => {
    setLoading(true);
    salaryPayoutsApi
      .getAll({ limit: 100, ...(status ? { status } : {}) })
      .then((res: any) => setPayouts(res?.data ?? res ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchPayouts, [status]);

  useEffect(() => {
    // Trainers and staff are the only payable people.
    Promise.all([usersApi.getAll({ role: 'TRAINER', limit: 100 }), usersApi.getAll({ role: 'STAFF', limit: 100 })])
      .then(([t, s]: any[]) => setPeople([...(t?.data ?? []), ...(s?.data ?? [])]))
      .catch(() => {});
  }, []);

  const markPaid = async (id: string) => {
    setMarking(id);
    try {
      await salaryPayoutsApi.markPaid(id);
      toast.success('Marked as paid');
      fetchPayouts();
    } catch {
      toast.error('Could not mark as paid');
    }
    setMarking(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payouts;
    return payouts.filter((p) => {
      const name = `${p.user?.firstName ?? ''} ${p.user?.lastName ?? ''}`.toLowerCase();
      return name.includes(q) || p.periodLabel.toLowerCase().includes(q);
    });
  }, [payouts, search]);

  const totals = useMemo(() => {
    const pending = payouts.filter((p) => p.status === 'PENDING');
    const paid = payouts.filter((p) => p.status === 'PAID');
    const thisMonth = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, p) => s + p.amount, 0),
      paidAmount: paid.reduce((s, p) => s + p.amount, 0),
      monthAmount: payouts.filter((p) => p.periodLabel === thisMonth).reduce((s, p) => s + p.amount, 0),
    };
  }, [payouts]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl gradient-green flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </span>
            Payroll
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Record salaries for trainers and staff. You transfer the money yourself, this keeps the history.
          </p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="gradient-brand text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-brand self-start"
        >
          <Plus className="w-4 h-4" /> Pay salaries
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Pending payouts" value={String(totals.pendingCount)} icon={Clock} grad="from-amber-500 to-orange-600" />
        <StatTile label="Pending amount" value={formatCurrency(totals.pendingAmount)} icon={IndianRupee} grad="from-rose-500 to-red-600" />
        <StatTile label="Paid to date" value={formatCurrency(totals.paidAmount)} icon={CheckCircle2} grad="from-emerald-500 to-green-600" />
        <StatTile label="This month" value={formatCurrency(totals.monthAmount)} icon={Users} grad="from-blue-500 to-indigo-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or period…"
            className="w-full h-10 pl-9 pr-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={cn(
                'px-3 h-10 rounded-xl text-sm font-semibold border transition-all',
                status === s.value ? 'gradient-brand text-white border-transparent' : 'bg-muted/40 border-border/60 hover:bg-muted',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="shimmer-row h-12 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-bold">No payouts yet</p>
            <p className="text-sm text-muted-foreground mt-1">Record a salary payment to start building history.</p>
            <button onClick={() => setShowPicker(true)} className="mt-4 gradient-brand text-white font-bold text-sm px-4 py-2 rounded-xl">
              Pay salary
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left py-3 px-4 font-bold">Person</th>
                  <th className="text-left py-3 px-4 font-bold">Period</th>
                  <th className="text-right py-3 px-4 font-bold">Amount</th>
                  <th className="text-left py-3 px-4 font-bold">Status</th>
                  <th className="text-left py-3 px-4 font-bold">Recorded</th>
                  <th className="text-right py-3 px-4 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors stagger-delay" style={{ animationDelay: `${i * 25}ms` }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg gradient-brand text-white text-xs font-bold flex items-center justify-center">
                          {getInitials(p.user?.firstName ?? '?', p.user?.lastName ?? '')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{p.user?.firstName} {p.user?.lastName}</p>
                          <p className="text-xs text-muted-foreground">{p.user?.role === 'TRAINER' ? 'Trainer' : 'Staff'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">{p.periodLabel}</td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums">{formatCurrency(p.amount)}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg',
                        p.status === 'PAID'
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
                      )}>
                        {p.status === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {p.status === 'PAID' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(p.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      {p.status === 'PENDING' ? (
                        <button
                          onClick={() => markPaid(p.id)}
                          disabled={marking === p.id}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {marking === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Mark paid
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{p.paidAt ? formatDate(p.paidAt) : '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPicker && (
        <PayRunModal
          people={people}
          onClose={() => setShowPicker(false)}
          onSuccess={() => { setShowPicker(false); fetchPayouts(); }}
        />
      )}

    </div>
  );
}

/**
 * One payroll run. Everyone payable is listed with their own amount box, so a
 * month is entered once and submitted once — rather than repeating a
 * single-person form for each trainer and each staff member.
 */
function PayRunModal({
  people, onClose, onSuccess,
}: { people: Person[]; onClose: () => void; onSuccess: () => void }) {
  const [periodLabel, setPeriodLabel] = useState(() => new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
  const [notes, setNotes] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const items = Object.entries(amounts)
    .map(([userId, raw]) => ({ userId, amount: Number(raw) }))
    .filter((i) => i.amount > 0);
  const total = items.reduce((sum, i) => sum + i.amount, 0);

  const submit = async () => {
    if (!periodLabel.trim()) return toast.error('Name the pay period');
    if (items.length === 0) return toast.error('Enter an amount for at least one person');
    setSaving(true);
    try {
      const res: any = await salaryPayoutsApi.createBatch({ periodLabel: periodLabel.trim(), notes: notes.trim() || undefined, items });
      toast.success(`${res?.created ?? items.length} payouts recorded`);
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not create the run');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[86vh] overflow-hidden flex flex-col animate-pop">
        <div className="gradient-brand p-5">
          <h2 className="font-extrabold text-xl text-white">Pay salaries</h2>
          <p className="text-sm text-white/70">Set each amount, create the run in one go</p>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Pay period</span>
            <input
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="mt-1 w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40"
            />
          </label>

          {people.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No trainers or staff yet.</p>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/60">
              {people.map((person) => {
                const value = amounts[person.id] ?? '';
                return (
                  <div key={person.id} className="flex items-center gap-3 p-3">
                    <div className="w-9 h-9 rounded-lg gradient-brand text-white text-xs font-bold flex items-center justify-center">
                      {getInitials(person.firstName, person.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{person.firstName} {person.lastName}</p>
                      <p className="text-xs text-muted-foreground">{person.role === 'TRAINER' ? 'Trainer' : 'Staff'}</p>
                    </div>
                    <input
                      value={value}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [person.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                      placeholder="₹0"
                      inputMode="decimal"
                      className={cn(
                        'w-28 h-10 px-3 text-sm text-right bg-muted/50 border rounded-xl outline-none tabular-nums',
                        Number(value) > 0 ? 'border-primary/60' : 'border-border/60',
                      )}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Notes (applies to the whole run)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            This only records the payments. Transfer the money with your own UPI or bank app, then mark them paid.
          </p>
        </div>

        <div className="p-4 border-t border-border flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{items.length} selected</p>
            <p className="font-extrabold tabular-nums">{formatCurrency(total)}</p>
          </div>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || items.length === 0}
            className="gradient-brand text-white font-bold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50"
          >
            {saving ? 'Saving…' : items.length > 1 ? `Create ${items.length} payouts` : 'Create payout'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, grad }: { label: string; value: string; icon: any; grad: string }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4">
      <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2', grad)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
