'use client';

import { useEffect, useState } from 'react';
import { Inbox, Check, X, Loader2, Clock, Building2, RefreshCw } from 'lucide-react';
import { adminGymSubscriptionsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface PendingPayment {
  id: string;
  amount: number;
  billingPeriod: string;
  referenceCode: string;
  upiReference?: string | null;
  submittedAt?: string;
  plan?: { name: string; plan: string };
  gym?: { id: string; name: string; email: string; phone: string; saasPlan: string };
}

/**
 * Super-admin queue of gyms that say they have paid by UPI. Confirming here is
 * what actually activates their plan, so it is the one manual step in the
 * subscribe flow.
 */
export function SubscriptionApprovals({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingPayment | null>(null);
  const [reason, setReason] = useState('');

  const load = () => {
    setLoading(true);
    adminGymSubscriptionsApi
      .pending()
      .then((res: any) => setRows(res ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const confirm = async (row: PendingPayment) => {
    setBusy(row.id);
    try {
      await adminGymSubscriptionsApi.confirm(row.id);
      toast.success(`${row.gym?.name ?? 'Gym'} is now on ${row.plan?.name ?? 'the plan'}`);
      load();
      onChange?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not confirm');
    }
    setBusy(null);
  };

  const reject = async () => {
    if (!rejecting || reason.trim().length < 3) { toast.error('Give a reason'); return; }
    setBusy(rejecting.id);
    try {
      await adminGymSubscriptionsApi.reject(rejecting.id, reason.trim());
      toast.success('Rejected — the gym has been notified');
      setRejecting(null);
      setReason('');
      load();
      onChange?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not reject');
    }
    setBusy(null);
  };

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
            <Inbox className="w-4 h-4 text-white" />
          </span>
          <div>
            <h2 className="font-extrabold">Payments awaiting confirmation</h2>
            <p className="text-xs text-muted-foreground">Confirming activates the gym's plan immediately</p>
          </div>
        </div>
        <button onClick={load} className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[0, 1].map((i) => <div key={i} className="shimmer-row h-16 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center">
          <Check className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
          <p className="font-bold text-sm">Nothing waiting</p>
          <p className="text-xs text-muted-foreground mt-1">Gyms that declare a UPI transfer show up here.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {rows.map((row) => (
            <div key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold truncate">{row.gym?.name ?? 'Unknown gym'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.plan?.name} · {row.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly'} ·{' '}
                    <span className="font-mono">{row.referenceCode}</span>
                    {row.upiReference ? <> · UTR <span className="font-mono">{row.upiReference}</span></> : null}
                  </p>
                  {row.submittedAt && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> declared {formatDate(row.submittedAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-extrabold tabular-nums mr-2">{formatCurrency(row.amount)}</span>
                <button
                  onClick={() => setRejecting(row)}
                  disabled={busy === row.id}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold hover:bg-muted inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <X className="w-3 h-3" /> Reject
                </button>
                <button
                  onClick={() => confirm(row)}
                  disabled={busy === row.id}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  {busy === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Confirm
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm animate-pop">
            <div className="p-5 border-b border-border">
              <h3 className="font-extrabold text-lg">Reject this payment?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {rejecting.gym?.name} · {formatCurrency(rejecting.amount)}
              </p>
            </div>
            <div className="p-5 space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. No transfer found for this reference"
                className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 resize-none"
              />
              <p className="text-xs text-muted-foreground">The gym admin sees this reason.</p>
            </div>
            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => { setRejecting(null); setReason(''); }} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">
                Cancel
              </button>
              <button onClick={reject} disabled={!!busy} className="flex-[2] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm disabled:opacity-60">
                Reject payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubscriptionApprovals;
