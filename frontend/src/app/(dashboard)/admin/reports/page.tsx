'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Activity,
  ArrowUp, ArrowDown, Download, DollarSign, Loader2, RefreshCw,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { attendanceApi, expensesApi, paymentsApi, trainersApi, usersApi } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { FeatureGate } from '@/components/shared/FeatureGate';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  TRAINER_SALARY: 'Trainer Salary',
  CLEANER_SALARY: 'Cleaner Salary',
  ELECTRICITY: 'Electricity',
  WATER: 'Water',
  RENT: 'Rent',
  EQUIPMENT_MAINTENANCE: 'Equipment',
  INTERNET: 'Internet',
  MARKETING: 'Marketing',
  OTHER: 'Other',
};

const PIE_COLORS = ['#f97316','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#78716c'];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  blue:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  purple:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  rose:    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const now = new Date();

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-2.5 shadow-lifted text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-bold" style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

type Tab = 'analytics' | 'financial';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('analytics');

  // ── Analytics state ──────────────────────────────────────────────────────
  const [weeklyData, setWeeklyData]       = useState<any[]>([]);
  const [trainerPerf, setTrainerPerf]     = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [memberGrowth, setMemberGrowth]   = useState<any[]>([]);
  const [memberStats, setMemberStats]     = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [attendanceAnalytics, setAttendanceAnalytics] = useState<any>(null);

  // ── Financial state ───────────────────────────────────────────────────────
  const { info: subInfo, loading: subLoading } = useSubscription();
  const [report, setReport]         = useState<any>(null);
  const [finLoading, setFinLoading] = useState(true);
  const [month, setMonth]           = useState(now.getMonth() + 1);
  const [year, setYear]             = useState(now.getFullYear());
  const isFreePlan = subInfo?.isFreePlan ?? false;

  // ── Fetch analytics ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      attendanceApi.getWeeklyReport(),
      trainersApi.getPerformance(),
      paymentsApi.getMonthlyStats(),
      usersApi.getMemberGrowth(),
      usersApi.getStats(),
      paymentsApi.getStats(),
    ]).then(([w, t, monthly, growth, mStats]: any[]) => {
      setWeeklyData((w ?? []).map((d: any) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
      })));
      setTrainerPerf(t ?? []);
      setMonthlyRevenue(monthly ?? []);
      setMemberGrowth(growth ?? []);
      setMemberStats(mStats);
    }).catch(() => {}).finally(() => setAnalyticsLoading(false));

    attendanceApi.getAnalytics().then((a: any) => setAttendanceAnalytics(a)).catch(() => {});
  }, []);

  // ── Fetch financial ───────────────────────────────────────────────────────
  const loadFinancial = async () => {
    setFinLoading(true);
    try {
      const data: any = await expensesApi.getAuditReport(month, year);
      setReport(data);
    } catch { setReport(null); } finally { setFinLoading(false); }
  };

  useEffect(() => {
    if (!subLoading && !isFreePlan) loadFinancial();
  }, [month, year, subLoading]);

  // ── KPI computation ───────────────────────────────────────────────────────
  const kpis = (() => {
    const cur  = monthlyRevenue[monthlyRevenue.length - 1];
    const prev = monthlyRevenue[monthlyRevenue.length - 2];
    const curTotal  = cur  ? cur.membership + cur.supplements + cur.pt  : 0;
    const prevTotal = prev ? prev.membership + prev.supplements + prev.pt : 0;
    const growthPct = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : 0;
    const retention = memberStats?.total > 0
      ? ((memberStats.active / memberStats.total) * 100).toFixed(1) : '—';
    const churnMonth = memberGrowth[memberGrowth.length - 1];
    const churnRate  = memberStats?.total > 0 && churnMonth
      ? ((churnMonth.churned / memberStats.total) * 100).toFixed(1) : '—';

    return [
      { label: 'Revenue Growth',   value: prevTotal > 0 ? `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%` : '—', sub: 'vs last month',          up: growthPct >= 0, color: 'emerald' },
      { label: 'Member Retention', value: retention !== '—' ? `${retention}%` : '—',                                    sub: 'active / total members', up: true,           color: 'blue' },
      { label: 'New This Month',   value: memberStats ? String(memberStats.newThisMonth) : '—',                          sub: 'members joined',         up: true,           color: 'purple' },
      { label: 'Churn Rate',       value: churnRate !== '—' ? `${churnRate}%` : '—',                                     sub: 'this month',             up: false,          color: 'rose' },
    ];
  })();

  // ── Financial derivations ─────────────────────────────────────────────────
  const expensePieData = report?.expenses?.byCategory?.map((e: any, i: number) => ({
    name: CATEGORY_LABELS[e.category] ?? e.category,
    value: e._sum?.amount ?? 0,
    color: PIE_COLORS[i % PIE_COLORS.length],
  })) ?? [];

  const revPieData = report ? [
    { name: 'Memberships', value: report.revenue.membership,  color: '#f97316' },
    { name: 'PT Sessions', value: report.revenue.pt,          color: '#8b5cf6' },
    { name: 'Supplements', value: report.revenue.supplement,  color: '#10b981' },
  ].filter(d => d.value > 0) : [];

  const isProfit = (report?.profit ?? 0) >= 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-slide-up">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-0.5">Analytics & financial insights for your gym</p>
        </div>

        {tab === 'analytics' && (
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted font-bold text-sm transition-all">
            <Download className="w-4 h-4" /> Export Report
          </button>
        )}

        {tab === 'financial' && !isFreePlan && (
          <div className="flex items-center gap-3">
            <select
              value={month}
              onChange={e => setMonth(+e.target.value)}
              className="bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={year}
              onChange={e => setYear(+e.target.value)}
              className="w-24 bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={loadFinancial}
              className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center hover:bg-muted transition-all"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([['analytics', 'Analytics', BarChart3], ['financial', 'Financial', PieIcon]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === id
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Analytics Tab ── */}
      {tab === 'analytics' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map(({ label, value, sub, up, color }) => (
              <div key={label} className="bg-card border border-border/60 rounded-2xl p-5 hover:shadow-card transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                  <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${colorMap[color]}`}>
                    {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />} {up ? 'Up' : 'Down'}
                  </span>
                </div>
                <p className="stat-number text-3xl text-foreground">{analyticsLoading ? '…' : value}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Revenue & Attendance */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-lg">Revenue Breakdown</h3>
                  <p className="text-sm text-muted-foreground">By category — last 6 months</p>
                </div>
                <div className="flex gap-3 text-xs">
                  {[{ label: 'Membership', color: '#f97316' }, { label: 'Supplements', color: '#8b5cf6' }, { label: 'PT', color: '#3b82f6' }].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full chart-dot" style={{ '--dot-color': color } as React.CSSProperties} />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {monthlyRevenue.length === 0 && !analyticsLoading ? (
                <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">No revenue data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyRevenue} barSize={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `₹${v / 1000}K`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Bar dataKey="membership" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="supplements" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pt" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-lg">7-Day Attendance</h3>
                  <p className="text-sm text-muted-foreground">Daily check-in volume</p>
                </div>
                <div className="flex items-center gap-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold px-3 py-1.5 rounded-lg">
                  <Activity className="w-3.5 h-3.5" /> Live
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="rptGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2.5} fill="url(#rptGrad)" dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Member growth & Trainer performance */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
              <h3 className="font-bold text-lg mb-1">Member Growth</h3>
              <p className="text-sm text-muted-foreground mb-5">New vs churned per month</p>
              {memberGrowth.length === 0 && !analyticsLoading ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No member data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={memberGrowth} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Bar dataKey="new" fill="#3b82f6" radius={[4, 4, 0, 0]} name="New" />
                    <Bar dataKey="churned" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Churned" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
              <h3 className="font-bold text-lg mb-5">Trainer Performance</h3>
              {trainerPerf.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                  <Users className="w-12 h-12 opacity-20 mb-3" />
                  <p>No trainer data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trainerPerf.slice(0, 5).map((t: any, i: number) => {
                    const maxSessions = Math.max(...trainerPerf.map(x => x.totalSessions), 1);
                    const pct = Math.round((t.totalSessions / maxSessions) * 100);
                    const grads = ['gradient-brand', 'gradient-blue', 'gradient-purple', 'gradient-green', 'gradient-teal'];
                    return (
                      <div key={t.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 ${grads[i % grads.length]} rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                          {t.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-semibold truncate">{t.name}</span>
                            <span className="font-bold text-muted-foreground ml-2">{t.totalSessions}</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`progress-fill ${grads[i % grads.length]}`} style={{ '--progress-width': `${pct}%` } as React.CSSProperties} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Attendance analytics: avg duration, peak hours, most active members, monthly trend */}
          {attendanceAnalytics && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-lg">Peak Hours</h3>
                    <p className="text-sm text-muted-foreground">Busiest check-in hours, all time</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Avg Visit Duration</p>
                    <p className="text-lg font-extrabold">{attendanceAnalytics.avgVisitDuration} min</p>
                  </div>
                </div>
                {attendanceAnalytics.peakHours.length === 0 ? (
                  <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">No check-in data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={attendanceAnalytics.peakHours.map((p: any) => ({ ...p, label: `${p.hour}:00` }))} barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                      <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
                <h3 className="font-bold text-lg mb-5">Most Active Members</h3>
                {attendanceAnalytics.mostActiveMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
                    <Users className="w-10 h-10 opacity-20 mb-3" />
                    <p>No visits recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attendanceAnalytics.mostActiveMembers.map((m: any, i: number) => {
                      const maxVisits = Math.max(...attendanceAnalytics.mostActiveMembers.map((x: any) => x.visitCount), 1);
                      const pct = Math.round((m.visitCount / maxVisits) * 100);
                      const grads = ['gradient-brand', 'gradient-blue', 'gradient-purple', 'gradient-green', 'gradient-teal'];
                      return (
                        <div key={m.memberId} className="flex items-center gap-3">
                          <div className={`w-8 h-8 ${grads[i % grads.length]} rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                            {m.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-semibold truncate">{m.name}</span>
                              <span className="font-bold text-muted-foreground ml-2">{m.visitCount} visits</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`progress-fill ${grads[i % grads.length]}`} style={{ '--progress-width': `${pct}%` } as React.CSSProperties} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="xl:col-span-2 bg-card border border-border/60 rounded-2xl p-6 shadow-card">
                <h3 className="font-bold text-lg mb-1">Monthly Attendance Trend</h3>
                <p className="text-sm text-muted-foreground mb-5">Last 12 months</p>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={attendanceAnalytics.monthlyTrend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="monthlyTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#monthlyTrendGrad)" dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Financial Tab ── */}
      {tab === 'financial' && (
        <>
          {isFreePlan ? (
            <FeatureGate locked featureName="Financial Reports">{null}</FeatureGate>
          ) : finLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !report ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <BarChart3 className="w-14 h-14 mb-4 opacity-30" />
              <p className="font-semibold text-lg">No data available</p>
              <p className="text-sm mt-1">Add expenses and payments to see the financial report</p>
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: 'Total Revenue',    value: report.revenue.total,    icon: TrendingUp,   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', arrow: <ArrowUp className="w-3.5 h-3.5" /> },
                  { label: 'Total Expenses',   value: report.expenses.total,   icon: TrendingDown, color: 'text-rose-600 dark:text-rose-400',      bg: 'bg-rose-100 dark:bg-rose-900/30',      arrow: <ArrowDown className="w-3.5 h-3.5" /> },
                  { label: 'Net Profit / Loss', value: Math.abs(report.profit), icon: DollarSign,  color: isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400', bg: isProfit ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30', prefix: isProfit ? '+' : '-', arrow: isProfit ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" /> },
                  { label: 'Profit Margin',    value: null, display: `${Math.abs(report.profitMargin)}%`, icon: BarChart3, color: isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400', bg: isProfit ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30' },
                ].map(({ label, value, display, icon: Icon, color, bg, prefix, arrow }: any) => (
                  <div key={label} className="bg-card border border-border/60 rounded-2xl p-5 shadow-card">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
                        <Icon className={`w-4.5 h-4.5 ${color}`} />
                      </div>
                    </div>
                    <p className={`text-2xl font-extrabold ${color}`}>
                      {prefix}{display ?? formatCurrency(value)}
                    </p>
                    {arrow && (
                      <div className={`flex items-center gap-1 mt-1.5 text-xs ${color}`}>
                        {arrow}
                        <span>{MONTHS[month - 1]} {year}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 6-Month Trend */}
              {report.trend?.length > 0 && (
                <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
                  <h3 className="font-bold text-lg mb-5">6-Month Trend — Revenue vs Expenses vs Profit</h3>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.trend} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="revenue"  name="Revenue"  fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="profit"   name="Profit"   fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Pie charts */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
                  <h3 className="font-bold text-lg mb-4">Revenue Breakdown</h3>
                  {revPieData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">No revenue recorded this month</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={revPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                              {revPieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(v: any) => formatCurrency(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 mt-2">
                        {revPieData.map(d => (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full chart-dot" style={{ '--dot-color': d.color } as React.CSSProperties} />
                              <span className="text-muted-foreground">{d.name}</span>
                            </div>
                            <span className="font-bold">{formatCurrency(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
                  <h3 className="font-bold text-lg mb-4">Expense Breakdown</h3>
                  {expensePieData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <TrendingDown className="w-10 h-10 mb-3 opacity-30" />
                      <p className="text-sm">No expenses recorded this month</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={expensePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                              {expensePieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(v: any) => formatCurrency(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 mt-2">
                        {expensePieData.map((d: any) => (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full chart-dot" style={{ '--dot-color': d.color } as React.CSSProperties} />
                              <span className="text-muted-foreground">{d.name}</span>
                            </div>
                            <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Summary table */}
              <div className="bg-card border border-border/60 rounded-2xl shadow-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border/50">
                  <h3 className="font-bold">Financial Summary — {MONTHS[month - 1]} {year}</h3>
                </div>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between px-6 py-3.5">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Membership Revenue</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(report.revenue.membership)}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-3.5">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">PT Session Revenue</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(report.revenue.pt)}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-3.5">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Supplement Sales</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(report.revenue.supplement)}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4 bg-emerald-50 dark:bg-emerald-900/10">
                    <span className="text-sm font-extrabold">Total Revenue</span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{formatCurrency(report.revenue.total)}</span>
                  </div>
                  {expensePieData.map((d: any) => (
                    <div key={d.name} className="flex items-center justify-between px-6 py-3.5">
                      <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">{d.name}</span>
                      <span className="font-bold text-rose-700 dark:text-rose-400">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-6 py-4 bg-rose-50 dark:bg-rose-900/10">
                    <span className="text-sm font-extrabold">Total Expenses</span>
                    <span className="font-extrabold text-rose-700 dark:text-rose-400">{formatCurrency(report.expenses.total)}</span>
                  </div>
                  <div className={`flex items-center justify-between px-6 py-5 ${isProfit ? 'bg-emerald-50 dark:bg-emerald-900/15' : 'bg-rose-50 dark:bg-rose-900/15'}`}>
                    <span className="text-base font-extrabold">Net {isProfit ? 'Profit' : 'Loss'}</span>
                    <span className={`text-xl font-extrabold ${isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                      {isProfit ? '+' : '-'}{formatCurrency(Math.abs(report.profit))}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
