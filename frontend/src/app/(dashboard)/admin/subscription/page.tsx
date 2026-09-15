'use client';

import { useEffect, useState } from 'react';
import {
  Crown, Check, Loader2, Copy, Clock, AlertTriangle, ShieldCheck, Users, Dumbbell, UserCog, Building2,
} from 'lucide-react';
import { gymSubscriptionsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxMembers: number;
  maxTrainers: number;
  maxStaff: number;
  maxBranches: number;
  features: string[];
}

interface Mine {
  plan: string;
  status: string;
  isActive: boolean;
  inGrace: boolean;
  expiresAt?: string;
  daysLeft?: number | null;
  billingPeriod?: string | null;
  limits: { maxMembers: number; maxTrainers: number; maxStaff: number; maxBranches: number };
  usage: { members: number; trainers: number; staff: number; branches: number };
  features: string[];
  pendingRequest?: any;
}

const TIER_STYLE: Record<string, { grad: string; ring: string }> = {
  STARTER: { grad: 'from-slate-500 to-slate-700', ring: 'border-border/60' },
  PROFESSIONAL: { grad: 'from-orange-500 to-red-500', ring: 'border-primary/50' },
  ENTERPRISE: { grad: 'from-purple-500 to-indigo-600', ring: 'border-purple-400/50' },
};

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [requesting, setRequesting] = useState<string | null>(null);
  const [payment, setPayment] = useState<any | null>(null);
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([gymSubscriptionsApi.plans(), gymSubscriptionsApi.me()])
      .then(([p, m]: any[]) => {
        setPlans(p ?? []);
        setMine(m ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const subscribe = async (plan: Plan) => {
    setRequesting(plan.id);
    try {
      const res: any = await gymSubscriptionsApi.request(plan.id, period);
      setPayment(res);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Could not start the subscription');
    }
    setRequesting(null);
  };

  const declarePaid = async () => {
    if (!payment?.requestId) return;
    setSubmitting(true);
    try {
      await gymSubscriptionsApi.markPaid(payment.requestId, { upiReference: utr.trim() || undefined });
      toast.success('Sent for confirmation. Your plan activates once we verify the transfer.');
      setPayment(null);
      setUtr('');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not submit');
    }
    setSubmitting(false);
  };

  const cancelPending = async (id: string) => {
    try {
      await gymSubscriptionsApi.cancelRequest(id);
      toast.success('Request cancelled');
      load();
    } catch {
      toast.error('Could not cancel');
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copied');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer-card h-32 rounded-2xl" />
        <div className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="shimmer-card h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const pending = mine?.pendingRequest;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </span>
          Subscription
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Choose a pack. Pay by UPI, and we activate it once the transfer is verified.</p>
      </div>

      {/* Current plan + usage */}
      {mine && (
        <div className={cn('bg-card border rounded-2xl p-5', mine.isActive ? 'border-border/60' : 'border-rose-400/60')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Current plan</p>
              <p className="text-2xl font-extrabold mt-0.5">{mine.plan}</p>
            </div>
            <div className="text-right">
              <span className={cn(
                'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg',
                mine.inGrace ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  : mine.isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400',
              )}>
                {mine.isActive ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {mine.inGrace ? 'In grace period' : mine.status}
              </span>
              {mine.expiresAt && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {mine.isActive ? 'Renews' : 'Expired'} {formatDate(mine.expiresAt)}
                  {typeof mine.daysLeft === 'number' && mine.daysLeft > 0 ? ` · ${mine.daysLeft} days left` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <Usage label="Members" used={mine.usage.members} max={mine.limits.maxMembers} icon={Users} />
            <Usage label="Trainers" used={mine.usage.trainers} max={mine.limits.maxTrainers} icon={Dumbbell} />
            <Usage label="Staff" used={mine.usage.staff} max={mine.limits.maxStaff} icon={UserCog} />
            <Usage label="Branches" used={mine.usage.branches} max={mine.limits.maxBranches} icon={Building2} />
          </div>
        </div>
      )}

      {/* Pending request */}
      {pending && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-amber-800 dark:text-amber-300">
                {pending.status === 'SUBMITTED' ? 'Waiting for confirmation' : 'Payment pending'}
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                {pending.plan?.name ?? pending.planId} · {formatCurrency(pending.amount)} · reference{' '}
                <span className="font-mono font-bold">{pending.referenceCode}</span>
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                {pending.status === 'SUBMITTED'
                  ? 'We are verifying your transfer. This usually takes a few hours.'
                  : 'Complete the UPI transfer, then tell us you have paid.'}
              </p>
              <button onClick={() => cancelPending(pending.id)} className="text-xs font-bold text-amber-800 dark:text-amber-300 underline mt-2">
                Cancel this request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing period toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-muted/50 rounded-xl p-1">
          {(['MONTHLY', 'YEARLY'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn('px-5 py-2 rounded-lg text-sm font-bold transition-all', period === p ? 'bg-card shadow-card' : 'text-muted-foreground')}
            >
              {p === 'MONTHLY' ? 'Monthly' : 'Yearly'}
              {p === 'YEARLY' && <span className="ml-1.5 text-[10px] text-emerald-600 font-extrabold">SAVE</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Packs */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = mine?.plan === plan.plan && mine?.isActive;
          const style = TIER_STYLE[plan.plan] ?? TIER_STYLE.STARTER;
          const price = period === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
          return (
            <div key={plan.id} className={cn('bg-card border-2 rounded-2xl overflow-hidden flex flex-col', isCurrent ? 'border-emerald-400/60' : style.ring)}>
              <div className={cn('p-5 bg-gradient-to-br text-white relative', style.grad)}>
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                <p className="font-extrabold text-lg relative">{plan.name}</p>
                <p className="text-3xl font-extrabold mt-2 relative tabular-nums">{formatCurrency(price)}</p>
                <p className="text-xs text-white/75 relative">per {period === 'YEARLY' ? 'year' : 'month'}</p>
              </div>

              <div className="p-5 space-y-2.5 flex-1">
                <Limit label="members" value={plan.maxMembers} />
                <Limit label="trainers" value={plan.maxTrainers} />
                <Limit label="staff accounts" value={plan.maxStaff} />
                <Limit label="branches" value={plan.maxBranches} />
                {(plan.features ?? []).map((f) => (
                  <div key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>

              <div className="p-5 pt-0">
                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold text-sm text-center">
                    Your current plan
                  </div>
                ) : (
                  <button
                    onClick={() => subscribe(plan)}
                    disabled={!!requesting || !!pending}
                    title={pending ? 'Finish or cancel your pending request first' : undefined}
                    className={cn('w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 bg-gradient-to-br disabled:opacity-50', style.grad)}
                  >
                    {requesting === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                    {mine && plan.plan === mine.plan ? 'Renew' : 'Subscribe'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* UPI payment sheet */}
      {payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-pop">
            <div className="gradient-purple p-5">
              <h2 className="font-extrabold text-xl text-white">Pay {formatCurrency(payment.amount)}</h2>
              <p className="text-sm text-white/75">{payment.planName} · {payment.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly'}</p>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Send the amount to this UPI ID from any payment app, then enter the reference below.
              </p>

              <Row label="UPI ID" value={payment.vpa} onCopy={() => copy(payment.vpa)} />
              <Row label="Payee" value={payment.payeeName} />
              <Row label="Reference (put in the note)" value={payment.referenceCode} mono onCopy={() => copy(payment.referenceCode)} />

              <a
                href={payment.upiIntentUrl}
                className="w-full py-2.5 rounded-xl gradient-brand text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                Open UPI app
              </a>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Transaction reference (UTR)</label>
                <input
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  placeholder="e.g. 412345678901"
                  className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40"
                />
                <p className="text-xs text-muted-foreground">Helps us match your transfer faster.</p>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-border">
              <button onClick={() => setPayment(null)} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">
                Later
              </button>
              <button
                onClick={declarePaid}
                disabled={submitting}
                className="flex-[2] py-2.5 rounded-xl gradient-brand text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                I have paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Usage({ label, used, max, icon: Icon }: { label: string; used: number; max: number; icon: any }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const tight = pct >= 85;
  return (
    <div className="bg-muted/30 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-extrabold tabular-nums">
        {used} <span className="text-sm font-medium text-muted-foreground">/ {max}</span>
      </p>
      <div className="h-1.5 bg-border/60 rounded-full mt-2 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', tight ? 'bg-rose-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
      <span>
        <span className="font-bold tabular-nums">{value.toLocaleString('en-IN')}</span>{' '}
        <span className="text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function Row({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('font-bold truncate', mono && 'font-mono')}>{value}</p>
      </div>
      {onCopy && (
        <button onClick={onCopy} className="w-8 h-8 rounded-lg bg-card border border-border/60 flex items-center justify-center shrink-0 hover:bg-muted">
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
