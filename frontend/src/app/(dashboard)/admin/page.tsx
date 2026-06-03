'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Users, QrCode, TrendingUp, AlertTriangle, Activity,
  CheckCircle, Clock, BarChart3, ArrowRight,
  UserPlus, CreditCard, Dumbbell, Zap, Crown, Lock, Loader2,
  HeartHandshake, Send,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { attendanceApi, gymsApi, membershipsApi, paymentsApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { formatCurrency, daysUntil } from '@/lib/utils';
import Link from 'next/link';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-card border border-border rounded-xl px-4 py-2.5 shadow-lifted text-sm">
        <p className="text-muted-foreground mb-1">{label}</p>
        <p className="font-bold text-foreground">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const { info: subInfo } = useSubscription();
  const [gymStats, setGymStats]         = useState<any>(null);
  const [gymInfo, setGymInfo]           = useState<any>(null);
  const [weeklyData, setWeeklyData]     = useState<any[]>([]);
  const [expiringMembers, setExpiringMembers] = useState<any[]>([]);
  const [revenueStats, setRevenueStats] = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [upgradeOpen, setUpgradeOpen]   = useState(false);
  const [atRiskMembers, setAtRiskMembers] = useState<any[]>([]);
  const [winbackLoading, setWinbackLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.gymId) return;
    Promise.all([
      gymsApi.getStats(user.gymId),
      gymsApi.getOne(user.gymId),
      attendanceApi.getWeeklyReport(),
      membershipsApi.getExpiring({ days: 7 }),
      paymentsApi.getStats(),
    ]).then(([gs, gi, w, e, r]: any[]) => {
      setGymStats(gs);
      setGymInfo(gi);
      setWeeklyData((w ?? []).map((d: any) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
      })));
      setExpiringMembers(e?.slice(0, 5) ?? []);
      setRevenueStats(r);
    }).catch(() => {}).finally(() => setLoading(false));

    usersApi.getAtRisk({ days: 14 }).then((data: any) => {
      setAtRiskMembers((data ?? []).slice(0, 5));
    }).catch(() => {});
  }, [user?.gymId]);

  const sendWinback = async (memberId: string) => {
    setWinbackLoading(memberId);
    try {
      await usersApi.sendWinback(memberId);
      toast.success('Win-back message sent!');
      setAtRiskMembers(prev => prev.filter(m => m.memberId !== memberId));
    } catch { }
    finally { setWinbackLoading(null); }
  };

  // ── Subscription gate ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (gymInfo?.status === 'PENDING') {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-extrabold mb-3">Awaiting Approval</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Your gym <strong>{gymInfo?.name}</strong> registration is under review by our team.
            You'll get full access once approved and subscribed to a plan.
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-5 text-sm text-amber-700 dark:text-amber-400 text-left space-y-2">
            <p className="font-bold mb-2">What happens next?</p>
            <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>Super admin reviews your application</span></div>
            <div className="flex items-start gap-2"><Crown className="w-4 h-4 mt-0.5 shrink-0" /><span>Choose a subscription plan to unlock all features</span></div>
            <div className="flex items-start gap-2"><Zap className="w-4 h-4 mt-0.5 shrink-0" /><span>Full dashboard access activated immediately</span></div>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { title: 'Total Members', value: gymStats?.totalMembers ?? '—', subtitle: `${gymStats?.activeMembers ?? 0} active memberships`, icon: Users, gradient: 'blue', trend: { value: 8 } },
    { title: "Today's Attendance", value: gymStats?.todayAttendance ?? '—', subtitle: 'Check-ins today', icon: QrCode, gradient: 'green', trend: { value: 12 } },
    { title: 'Monthly Revenue', value: gymStats?.monthlyRevenue ?? 0, isCurrency: true, subtitle: 'This month', icon: TrendingUp, gradient: 'orange', trend: { value: 15 } },
    { title: 'Pending Payments', value: gymStats?.pendingPayments ?? '—', subtitle: 'Require attention', icon: AlertTriangle, gradient: 'rose', trend: { value: -3 } },
  ];

  const maxAttendance = Math.max(...weeklyData.map(d => d.count), 1);

  const isFreePlan = gymInfo?.saasPlan === 'STARTER';
  const memberCount   = subInfo?.memberCount ?? gymStats?.totalMembers ?? 0;
  const trainerCount  = subInfo?.trainerCount ?? 0;
  const FREE_MEMBERS  = 50;
  const FREE_TRAINERS = 1;
  const memberPct     = Math.min(Math.round((memberCount / FREE_MEMBERS) * 100), 100);
  const trainerPct    = Math.min(Math.round((trainerCount / FREE_TRAINERS) * 100), 100);

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Subscription upgrade banner for free plan */}
      {isFreePlan && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-orange-50 dark:from-purple-950/20 dark:to-orange-950/20 border border-purple-200 dark:border-purple-800/40 rounded-2xl">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground">You're on the Free Plan</p>
              <p className="text-xs text-muted-foreground">Upgrade to Pro to unlock unlimited members, expense tracking, audit reports, and all premium features.</p>
            </div>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-orange-500 px-4 py-2 rounded-xl hover:opacity-90 transition-all shrink-0 shadow-sm">
              <Zap className="w-3.5 h-3.5" /> Upgrade Now
            </button>
          </div>

          {/* Usage limits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Members Used', current: memberCount, max: FREE_MEMBERS, pct: memberPct, icon: Users, color: memberPct >= 80 ? 'gradient-rose' : 'gradient-brand' },
              { label: 'Trainers Used', current: trainerCount, max: FREE_TRAINERS, pct: trainerPct, icon: Dumbbell, color: trainerPct >= 100 ? 'gradient-rose' : 'gradient-purple' },
            ].map(({ label, current, max, pct, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border/60 rounded-xl p-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                    <span className="text-xs font-bold">{current} / {max}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`progress-fill ${color}`} style={{ '--progress-width': `${pct}%` } as React.CSSProperties} />
                  </div>
                  {pct >= 100 && (
                    <p className="text-[10px] text-rose-500 font-bold mt-1">Limit reached — upgrade to add more</p>
                  )}
                  {pct >= 80 && pct < 100 && (
                    <p className="text-[10px] text-amber-500 font-bold mt-1">Approaching limit</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-7 shadow-brand hero-shimmer">
        {/* Layered depth overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-transparent to-orange-900/20" />
        {/* Floating orbs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/3 animate-float-subtle" />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-amber-300/10 blur-2xl translate-y-1/2 animate-float-subtle" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-white/5 blur-xl animate-rotate-slow" />
        {/* Decorative grid */}
        <div className="absolute inset-0 auth-hero-grid" />

        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 live-dot" />
              <span className="text-white/75 text-sm font-medium tracking-wide">Live Dashboard</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
              Good morning, {user?.firstName}! 👋
            </h1>
            <p className="text-white/65 mt-1.5 text-sm">Here's what's happening at your gym today</p>
          </div>
          <div className="flex gap-2.5">
            <Link href="/admin/attendance"
              className="flex items-center gap-2 bg-white text-orange-600 font-bold px-5 py-2.5 rounded-xl hover:bg-orange-50 hover:scale-[1.03] active:scale-[0.97] transition-all text-sm shadow-lg">
              <QrCode className="w-4 h-4" /> Scan QR
            </Link>
            <Link href="/admin/members"
              className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white font-bold px-5 py-2.5 rounded-xl hover:bg-white/30 hover:scale-[1.03] active:scale-[0.97] transition-all text-sm border border-white/30">
              <UserPlus className="w-4 h-4" /> Add Member
            </Link>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger-children">
        {stats.map((s) => (
          <StatsCard key={s.title} {...s} className="animate-slide-up" />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Attendance chart */}
        <div className="xl:col-span-2 bg-card rounded-2xl border border-border/60 shadow-card p-6 hover:shadow-lifted transition-shadow duration-300">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-lg">Weekly Attendance</h3>
              <p className="text-sm text-muted-foreground">Last 7 days check-in trend</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg">
              <Activity className="w-3.5 h-3.5" />
              Real-time
            </div>
          </div>

          <div className="h-[220px]">
            {loading ? (
              <div className="h-full shimmer-bg rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2.5} fill="url(#attendGrad)" dot={{ fill: '#f97316', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#ea580c' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Day indicators */}
          {!loading && weeklyData.length > 0 && (
            <div className="flex gap-1.5 mt-4">
              {weeklyData.map((d: any) => {
                const pct = Math.round((d.count / maxAttendance) * 100);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-muted rounded-full overflow-hidden h-1">
                      <div className="progress-fill gradient-brand" style={{ '--progress-width': `${pct}%` } as React.CSSProperties} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{d.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revenue panel */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6 flex flex-col hover:shadow-lifted transition-shadow duration-300">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-lg">Revenue</h3>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="space-y-3 flex-1">
            {[
              { label: 'This Month', value: revenueStats?.monthlyRevenue ?? 0, color: 'gradient-brand', pct: 72 },
              { label: 'This Year', value: revenueStats?.yearlyRevenue ?? 0, color: 'gradient-purple', pct: 55 },
              { label: 'Pending', value: revenueStats?.pendingAmount ?? 0, color: 'gradient-rose', pct: 18 },
            ].map(({ label, value, color, pct }) => (
              <div key={label} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-bold">{formatCurrency(value)}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`progress-fill ${color}`} style={{ '--progress-width': `${pct}%` } as React.CSSProperties} />
                </div>
              </div>
            ))}
          </div>

          {revenueStats?.pendingCount > 0 && (
            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="text-xs text-rose-700 dark:text-rose-400">
                <strong>{revenueStats.pendingCount}</strong> payments need attention
              </p>
            </div>
          )}

          <Link href="/admin/payments"
            className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-all group">
            View all payments
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Expiring members */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold">Expiring Memberships</h3>
              <p className="text-xs text-muted-foreground">Members requiring renewal in 7 days</p>
            </div>
          </div>
          <Link href="/admin/members"
            className="text-sm text-primary font-semibold hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-border/40">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-xl shimmer-bg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 shimmer-bg rounded" />
                  <div className="h-3 w-24 shimmer-bg rounded" />
                </div>
                <div className="h-7 w-20 shimmer-bg rounded-lg" />
              </div>
            ))
          ) : expiringMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mb-3">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
              <p className="font-semibold">All memberships are active</p>
              <p className="text-sm mt-0.5">No expirations in the next 7 days</p>
            </div>
          ) : (
            expiringMembers.map((m: any) => {
              const days = daysUntil(m.endDate);
              const urgent = days <= 2;
              return (
                <div key={m.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="w-10 h-10 gradient-brand rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {m.user?.avatar
                      ? <img src={m.user.avatar} alt="avatar" className="w-full h-full object-cover" />
                      : <>{m.user?.firstName?.[0]}{m.user?.lastName?.[0]}</>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{m.user.firstName} {m.user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{m.user.phone} · {m.type}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${
                      urgent
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {days <= 0 ? 'Expired' : `${days}d left`}
                    </span>
                    <button className="text-xs font-bold text-primary hover:underline">Renew</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        {[
          { label: 'New Member',     icon: UserPlus,  href: '/admin/members',       gradient: 'gradient-brand',  glow: 'hover-glow-brand',  orb: 'rgba(249,115,22,.15)' },
          { label: 'Record Payment', icon: CreditCard,href: '/admin/payments',      gradient: 'gradient-purple', glow: 'hover-glow-purple', orb: 'rgba(139,92,246,.15)' },
          { label: 'Schedule PT',    icon: Dumbbell,  href: '/admin/pt-sessions',   gradient: 'gradient-blue',   glow: 'hover-glow-blue',   orb: 'rgba(59,130,246,.15)' },
          { label: 'Send Notice',    icon: Zap,       href: '/admin/notifications', gradient: 'gradient-green',  glow: 'hover-glow-green',  orb: 'rgba(16,185,129,.15)' },
        ].map(({ label, icon: Icon, href, gradient, glow, orb }) => (
          <Link key={label} href={href}
            className={`group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-5 hover:shadow-lifted hover:-translate-y-1.5 transition-all duration-300 animate-slide-up ${glow}`}>
            {/* decorative orb */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-400 blur-xl pointer-events-none"
              style={{ background: orb }} />
            <div className={`w-11 h-11 ${gradient} rounded-xl flex items-center justify-center text-white mb-4 shadow-sm group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold">{label}</p>
            <ArrowRight className="w-4 h-4 text-muted-foreground absolute bottom-5 right-5 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>

      {/* At-Risk Members Widget */}
      {atRiskMembers.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <HeartHandshake className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="font-bold text-sm">At-Risk Members</p>
                <p className="text-xs text-muted-foreground">Active members who haven't checked in for 14+ days</p>
              </div>
            </div>
            <Link href="/admin/at-risk" className="text-xs font-semibold text-brand hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {atRiskMembers.map((m: any) => (
              <div key={m.memberId} className="flex items-center gap-3 px-6 py-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {m.firstName?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.firstName} {m.lastName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.daysSinceLastVisit !== null ? `${m.daysSinceLastVisit} days since last visit` : 'Never checked in'}
                    {m.membershipEndDate && ` · Expires ${new Date(m.membershipEndDate).toLocaleDateString('en-IN')}`}
                  </p>
                </div>
                <button
                  onClick={() => sendWinback(m.memberId)}
                  disabled={winbackLoading === m.memberId}
                  className="flex items-center gap-1.5 text-xs font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {winbackLoading === m.memberId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Win-back
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
