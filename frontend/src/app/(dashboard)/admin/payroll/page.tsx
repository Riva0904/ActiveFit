'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Wallet, Search, CheckCircle2, Clock, Loader2, Plus, IndianRupee, Users, Filter,
} from 'lucide-react';
import { salaryPayoutsApi, usersApi } from '@/lib/api';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { PaySalaryModal } from '@/components/shared/PaySalaryModal';
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
  const [payTarget, setPayTarget] = useState<Person | null>(null);
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
          <Plus className="w-4 h-4" /> Pay salary
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

      {/* Who to pay */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col animate-pop">
            <div className="gradient-brand p-5">
              <h2 className="font-extrabold text-xl text-white">Who are you paying?</h2>
              <p className="text-sm text-white/70">Trainers and staff in your gym</p>
            </div>
            <div className="p-3 overflow-y-auto">
              {people.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No trainers or staff yet.</p>
              ) : people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => { setPayTarget(person); setShowPicker(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg gradient-brand text-white text-xs font-bold flex items-center justify-center">
                    {getInitials(person.firstName, person.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{person.firstName} {person.lastName}</p>
                    <p className="text-xs text-muted-foreground">{person.role === 'TRAINER' ? 'Trainer' : 'Staff'}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-border">
              <button onClick={() => setShowPicker(false)} className="w-full py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {payTarget && (
        <PaySalaryModal
          userId={payTarget.id}
          userName={`${payTarget.firstName} ${payTarget.lastName}`}
          payoutUpiVpa={payTarget.payoutUpiVpa}
          onClose={() => setPayTarget(null)}
          onSuccess={fetchPayouts}
        />
      )}
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
