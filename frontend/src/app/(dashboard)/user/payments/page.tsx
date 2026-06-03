'use client';

import { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, Clock, FileText, Download, TrendingUp, ArrowDownLeft } from 'lucide-react';
import { paymentsApi, invoicesApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatsCard } from '@/components/shared/StatsCard';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  COMPLETED: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle },
  PENDING:   { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  FAILED:    { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: Clock },
  REFUNDED:  { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: ArrowDownLeft },
};

const typeEmojis: Record<string, string> = {
  MEMBERSHIP: '💳', PT_SESSION: '🏋️', SUPPLEMENT: '🧪', OTHER: '📦',
};

export default function UserPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tab, setTab] = useState<'payments' | 'invoices'>('payments');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      paymentsApi.getMyPayments({ limit: 20 }),
      invoicesApi.getMyInvoices(),
    ]).then(([p, i]: any[]) => {
      setPayments(p.data ?? []);
      setInvoices(Array.isArray(i) ? i : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalPaid = payments.filter(p => p.status === 'COMPLETED').reduce((a, p) => a + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((a, p) => a + p.amount, 0);

  const stats = [
    { title: 'Total Paid', value: totalPaid, icon: CreditCard, gradient: 'green' as const, isCurrency: true },
    { title: 'Pending', value: totalPending, icon: Clock, gradient: 'orange' as const, isCurrency: true },
    { title: 'Transactions', value: payments.length, icon: TrendingUp, gradient: 'blue' as const },
    { title: 'Invoices', value: invoices.length, icon: FileText, gradient: 'purple' as const },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Payments & Invoices</h1>
        <p className="text-muted-foreground mt-0.5">Your complete financial history</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(s => <StatsCard key={s.title} {...s} />)}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl w-fit">
        {(['payments', 'invoices'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-2 rounded-lg text-sm font-bold capitalize transition-all', tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 shimmer-bg rounded-2xl" />)}
        </div>
      ) : tab === 'payments' ? (
        <div className="space-y-3">
          {payments.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground">
              <CreditCard className="w-14 h-14 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No payment history yet</p>
            </div>
          ) : payments.map((p: any) => {
            const { color, icon: Icon } = statusConfig[p.status] ?? statusConfig.PENDING;
            return (
              <div key={p.id} className="group bg-card border border-border/60 rounded-2xl p-5 hover:shadow-card transition-all flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 bg-muted">
                  {typeEmojis[p.type] ?? '💰'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold capitalize">{p.type?.toLowerCase().replace('_', ' ')} Payment</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>{formatDate(p.createdAt)}</span>
                    <span>·</span>
                    <span>{p.method}</span>
                    {p.razorpayPaymentId && <span>· #{p.razorpayPaymentId.slice(-8)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-xl">{formatCurrency(p.amount)}</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg mt-1 ${color}`}>
                    <Icon className="w-3 h-3" /> {p.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground">
              <FileText className="w-14 h-14 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No invoices yet</p>
            </div>
          ) : invoices.map((inv: any) => {
            const { color } = statusConfig[inv.status] ?? statusConfig.PENDING;
            return (
              <div key={inv.id} className="group bg-card border border-border/60 rounded-2xl p-5 hover:shadow-card transition-all flex items-center gap-4">
                <div className="w-12 h-12 gradient-blue rounded-2xl flex items-center justify-center text-white shrink-0 shadow-blue">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(inv.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-xl">{formatCurrency(inv.totalAmount)}</p>
                  <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-lg mt-1 ${color}`}>{inv.status}</span>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-all shrink-0">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
