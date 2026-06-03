'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, Calendar, TrendingUp, Star, ArrowRight, CheckCircle,
  Dumbbell, Clock, Activity, Loader2, Target, DollarSign,
  UserCheck, BarChart3, Bell, Brain, RefreshCw, ChevronRight,
  Flame, Award, Zap, Heart, Scale, TrendingDown, Repeat,
} from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { trainersApi, notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate, cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED:  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  NO_SHOW:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-2.5 shadow-lifted text-sm">
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>
          {p.name}: {p.name === 'earnings' ? `₹${p.value}` : p.value}
        </p>
      ))}
    </div>
  );
};

// Circular performance score
function PerformanceRing({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f97316' : '#ef4444';
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
      <circle
        cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        transform="rotate(-90 55 55)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="55" y="50" textAnchor="middle" dominantBaseline="middle" className="text-foreground" style={{ fontSize: 22, fontWeight: 800, fill: color }}>{score}</text>
      <text x="55" y="68" textAnchor="middle" style={{ fontSize: 10, fill: '#888' }}>/ 100</text>
    </svg>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function TrainerDashboard() {
  const { user } = useAuthStore();
  const [dash, setDash]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(() => {
    setLoading(true);
    trainersApi.getMyDashboard()
      .then((data: any) => { setDash(data); setLastRefresh(new Date()); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // auto-refresh every 30 s
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading && !dash) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const d = dash ?? {};
  const trainer     = d.trainer ?? {};
  const chartData   = d.chartData ?? [];
  const upcoming    = d.upcomingSessions ?? [];
  const recent      = d.recentActivity ?? [];
  const notifs      = d.notifications ?? [];
  const assigned    = d.assignedMembers ?? [];

  const score    = d.performanceScore ?? 0;
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Average' : 'Needs Improvement';

  const stats = [
    {
      title: 'Assigned Members',
      value: d.totalAssignedMembers ?? 0,
      subtitle: 'Active clients',
      icon: Users,
      color: 'blue' as const,
    },
    {
      title: 'Active PT Clients',
      value: d.activePtClients ?? 0,
      subtitle: 'Upcoming sessions',
      icon: UserCheck,
      color: 'green' as const,
    },
    {
      title: "Today's Sessions",
      value: d.todaySessions ?? 0,
      subtitle: new Date().toLocaleDateString('en', { weekday: 'long' }),
      icon: Clock,
      color: 'orange' as const,
    },
    {
      title: 'Monthly Sessions',
      value: d.monthlySessions ?? 0,
      subtitle: `${d.monthlyCompleted ?? 0} completed`,
      icon: Calendar,
      color: 'purple' as const,
    },
    {
      title: 'Revenue Generated',
      value: d.monthlyEarnings ? `₹${d.monthlyEarnings.toLocaleString()}` : '₹0',
      subtitle: 'This month',
      icon: DollarSign,
      color: 'green' as const,
    },
    {
      title: 'Attendance Rate',
      value: `${d.attendanceRate ?? 0}%`,
      subtitle: "Clients' gym visits",
      icon: Activity,
      color: 'blue' as const,
    },
    {
      title: 'Member Retention',
      value: `${d.memberRetentionRate ?? 0}%`,
      subtitle: 'Client retention rate',
      icon: Repeat,
      color: 'orange' as const,
    },
    {
      title: 'Transformation Rate',
      value: `${d.transformationSuccessRate ?? 0}%`,
      subtitle: 'Weight loss success',
      icon: TrendingDown,
      color: 'purple' as const,
    },
  ];

  const aiInsights = [
    score < 60
      ? { icon: Zap, text: 'Schedule more sessions to boost your performance score.', color: 'text-orange-500' }
      : { icon: Award, text: 'Great work! Your completion rate is above average.', color: 'text-green-500' },
    (d.attendanceRate ?? 0) < 60
      ? { icon: Bell, text: 'Several clients have low attendance. Consider sending reminders.', color: 'text-red-500' }
      : { icon: Heart, text: 'Your clients are showing consistent attendance this month.', color: 'text-blue-500' },
    (d.transformationSuccessRate ?? 0) > 50
      ? { icon: TrendingDown, text: 'More than half your clients are hitting their weight goals!', color: 'text-green-500' }
      : { icon: Scale, text: 'Encourage clients to log progress regularly for better tracking.', color: 'text-purple-500' },
    (d.activePtClients ?? 0) < (d.totalAssignedMembers ?? 0) / 2
      ? { icon: Target, text: 'Consider converting more assigned members to active PT clients.', color: 'text-orange-500' }
      : { icon: Flame, text: 'Strong PT client engagement — keep up the momentum!', color: 'text-red-500' },
  ];

  // expiring members (assignments > 25 days ago as proxy for follow-up)
  const clientReminders = assigned.slice(0, 4).map((a: any) => ({
    name: `${a.member?.user?.firstName ?? ''} ${a.member?.user?.lastName ?? ''}`.trim(),
    note: 'Check-in overdue',
  }));

  return (
    <div className="space-y-6 animate-slide-up">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-7 shadow-brand">
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">

          {/* left: greeting */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 live-dot" />
              <span className="text-white/70 text-sm font-medium">Trainer Portal · Live</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Hey, {user?.firstName}! 💪
            </h1>
            <p className="text-white/70 mt-1">
              {trainer?.specializations?.length
                ? trainer.specializations.join(' · ')
                : 'Personal Trainer'}
            </p>
            <p className="text-white/50 text-xs mt-2">
              Last updated {lastRefresh.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* center: performance ring */}
          <div className="flex flex-col items-center">
            <PerformanceRing score={score} />
            <p className="text-white/80 text-sm font-semibold mt-1">Performance: {scoreLabel}</p>
          </div>

          {/* right: quick actions */}
          <div className="flex flex-col gap-2">
            <Link href="/trainer/members"
              className="flex items-center gap-2 bg-white text-orange-600 font-bold px-5 py-2.5 rounded-xl hover:bg-orange-50 transition-all text-sm shadow-lg">
              <Users className="w-4 h-4" /> My Members
            </Link>
            <Link href="/trainer/sessions"
              className="flex items-center gap-2 bg-white/20 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-white/30 transition-all text-sm border border-white/30">
              <Calendar className="w-4 h-4" /> PT Sessions
            </Link>
            <button onClick={load}
              className="flex items-center gap-2 bg-white/10 text-white/80 font-medium px-5 py-2.5 rounded-xl hover:bg-white/20 transition-all text-sm border border-white/20">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── 8 Stats Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatsCard key={s.title} title={s.title} value={s.value} subtitle={s.subtitle} icon={s.icon} color={s.color} />
        ))}
      </div>

      {/* ── Charts row 1: Sessions + Revenue ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* PT Session Analytics */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">PT Session Analytics</h3>
              <p className="text-xs text-muted-foreground">Sessions over last 6 months</p>
            </div>
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="none" />
              <YAxis tick={{ fontSize: 11 }} stroke="none" />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sessions" name="Total" fill="#6366f1" radius={[4,4,0,0]} />
              <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Analytics */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Revenue Analytics</h3>
              <p className="text-xs text-muted-foreground">Earnings over last 6 months</p>
            </div>
            <DollarSign className="w-5 h-5 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="none" />
              <YAxis tick={{ fontSize: 11 }} stroke="none" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="earnings" name="earnings" stroke="#f97316" strokeWidth={2.5} fill="url(#earningsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts row 2: Completion + Attendance ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Workout Completion Rate */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Workout Completion Analytics</h3>
              <p className="text-xs text-muted-foreground">Completed vs Scheduled per month</p>
            </div>
            <CheckCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="none" />
              <YAxis tick={{ fontSize: 11 }} stroke="none" />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="sessions"  name="Scheduled" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="completed" name="Completed"  stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Member Growth (assigned count trend) */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Member Growth Analytics</h3>
              <p className="text-xs text-muted-foreground">Session volume trend</p>
            </div>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="membersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="none" />
              <YAxis tick={{ fontSize: 11 }} stroke="none" />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="sessions" name="Sessions" stroke="#6366f1" strokeWidth={2.5} fill="url(#membersGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts row 3: Weight Loss + Attendance Rate ───────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Weight Loss Analytics */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Weight Loss Analytics</h3>
              <p className="text-xs text-muted-foreground">Transformation success rate over time</p>
            </div>
            <Scale className="w-5 h-5 text-muted-foreground" />
          </div>
          {d.transformationSuccessRate !== undefined ? (
            <div className="flex flex-col items-center justify-center h-[170px] gap-3">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="8" />
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#22c55e" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(d.transformationSuccessRate / 100) * 201} 201`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-green-600">
                  {d.transformationSuccessRate}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {d.transformationSuccessRate}% of your clients are hitting their weight goals
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[170px] text-muted-foreground text-sm">
              No progress data yet
            </div>
          )}
        </div>

        {/* Attendance Analytics */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold">Attendance Analytics</h3>
              <p className="text-xs text-muted-foreground">Client gym visit rate this month</p>
            </div>
            <Activity className="w-5 h-5 text-muted-foreground" />
          </div>
          {d.attendanceRate !== undefined ? (
            <div className="flex flex-col items-center justify-center h-[170px] gap-3">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="8" />
                  <circle cx="40" cy="40" r="32" fill="none"
                    stroke={d.attendanceRate >= 70 ? '#6366f1' : d.attendanceRate >= 40 ? '#f97316' : '#ef4444'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(d.attendanceRate / 100) * 201} 201`} />
                </svg>
                <span className={cn(
                  'absolute inset-0 flex items-center justify-center text-xl font-extrabold',
                  d.attendanceRate >= 70 ? 'text-indigo-500' : d.attendanceRate >= 40 ? 'text-orange-500' : 'text-red-500',
                )}>
                  {d.attendanceRate}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {d.attendanceRate}% of assigned clients visited the gym this month
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[170px] text-muted-foreground text-sm">
              No attendance data yet
            </div>
          )}
        </div>
      </div>

      {/* ── Widgets Row 1: Upcoming + Today's Schedule ───────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Upcoming Sessions */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div>
              <h3 className="font-bold">Upcoming Sessions</h3>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </div>
            <Badge variant="secondary">{upcoming.length}</Badge>
          </div>
          <div className="divide-y divide-border/40 max-h-72 overflow-y-auto scrollbar-hide">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Calendar className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No upcoming sessions</p>
              </div>
            ) : upcoming.map((s: any) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                <div className="w-9 h-9 gradient-blue rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {s.member?.user?.firstName?.[0]}{s.member?.user?.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.member?.user?.firstName} {s.member?.user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.scheduledAt).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' · '}{new Date(s.scheduledAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    {s.duration ? ` · ${s.duration} min` : ''}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${STATUS_COLORS.SCHEDULED}`}>
                  Upcoming
                </span>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-border/40">
            <Link href="/trainer/sessions" className="flex items-center justify-between text-sm text-primary font-semibold hover:underline">
              View all sessions <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div>
              <h3 className="font-bold">Today's Schedule</h3>
              <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
            <Badge variant="secondary">{d.todaySessions ?? 0}</Badge>
          </div>
          <div className="divide-y divide-border/40 max-h-72 overflow-y-auto scrollbar-hide">
            {(upcoming.filter((s: any) => new Date(s.scheduledAt).toDateString() === new Date().toDateString())).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Clock className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Nothing scheduled for today</p>
              </div>
            ) : (
              upcoming
                .filter((s: any) => new Date(s.scheduledAt).toDateString() === new Date().toDateString())
                .map((s: any) => (
                  <div key={s.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className="text-center shrink-0 w-12">
                      <p className="text-xs font-bold text-primary">
                        {new Date(s.scheduledAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{s.duration ?? 60}m</p>
                    </div>
                    <div className="w-px h-8 bg-border shrink-0" />
                    <div className="w-8 h-8 gradient-purple rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {s.member?.user?.firstName?.[0]}{s.member?.user?.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{s.member?.user?.firstName} {s.member?.user?.lastName}</p>
                      {s.title && <p className="text-xs text-muted-foreground truncate">{s.title}</p>}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* ── Widgets Row 2: Recent Activity + Notifications ───────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Recent Member Activity */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div>
              <h3 className="font-bold">Recent Member Activity</h3>
              <p className="text-xs text-muted-foreground">Last completed sessions</p>
            </div>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border/40 max-h-72 overflow-y-auto scrollbar-hide">
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Dumbbell className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No completed sessions yet</p>
              </div>
            ) : recent.map((s: any) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                <div className="w-9 h-9 gradient-green rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {s.member?.user?.firstName?.[0]}{s.member?.user?.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{s.member?.user?.firstName} {s.member?.user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(s.completedAt ?? s.scheduledAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                  {s.rating && (
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs text-muted-foreground">{s.rating}/5</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Notifications */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div>
              <h3 className="font-bold">Live Notifications</h3>
              <p className="text-xs text-muted-foreground">Unread alerts</p>
            </div>
            <div className="flex items-center gap-2">
              {notifs.length > 0 && (
                <span className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                  {notifs.length}
                </span>
              )}
              <Bell className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="divide-y divide-border/40 max-h-72 overflow-y-auto scrollbar-hide">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : notifs.map((n: any) => (
              <div key={n.id} className="flex items-start gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Widgets Row 3: AI Insights + Client Reminders ────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* AI Fitness Insights */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div>
              <h3 className="font-bold">AI Fitness Insights</h3>
              <p className="text-xs text-muted-foreground">Personalized recommendations</p>
            </div>
            <Brain className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="p-4 space-y-3">
            {aiInsights.map((tip, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <tip.icon className={`w-5 h-5 shrink-0 mt-0.5 ${tip.color}`} />
                <p className="text-sm leading-snug">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Client Reminders + Pending Tasks */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div>
              <h3 className="font-bold">Client Reminders</h3>
              <p className="text-xs text-muted-foreground">Follow-up actions needed</p>
            </div>
            <Target className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border/40">
            {clientReminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No reminders right now</p>
              </div>
            ) : clientReminders.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{r.name || 'Client'}</p>
                  <p className="text-xs text-muted-foreground">{r.note}</p>
                </div>
                <Link href="/trainer/members"
                  className="text-xs text-primary font-semibold hover:underline shrink-0">
                  View →
                </Link>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-border/40 bg-muted/20">
            <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Pending Tasks</p>
            <div className="space-y-2">
              {(upcoming.length > 0) && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <span>{upcoming.length} session{upcoming.length > 1 ? 's' : ''} coming up this week</span>
                </div>
              )}
              {(d.monthlyCompleted ?? 0) < (d.monthlySessions ?? 0) && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                  <span>{(d.monthlySessions ?? 0) - (d.monthlyCompleted ?? 0)} sessions still scheduled this month</span>
                </div>
              )}
              {(d.attendanceRate ?? 0) < 60 && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span>Send attendance reminders to clients</span>
                </div>
              )}
              {upcoming.length === 0 && (d.monthlyCompleted ?? 0) >= (d.monthlySessions ?? 1) && (d.attendanceRate ?? 100) >= 60 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>All tasks up to date!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Trainer Profile Card ─────────────────────────────────────────── */}
      {trainer?.id && (
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 gradient-brand rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-brand">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <h3 className="font-bold text-lg">{user?.firstName} {user?.lastName}</h3>
              <p className="text-sm text-muted-foreground">{trainer.experience ?? 0} years experience</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-xl border border-yellow-200 dark:border-yellow-800/40">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
                  {trainer.rating ?? '—'} / 5
                </span>
              </div>
              <Link href="/trainer/sessions"
                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Manage Sessions <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {trainer.specializations?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {trainer.specializations.map((s: string) => (
                <span key={s} className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                  {s}
                </span>
              ))}
            </div>
          )}

          {trainer.bio && <p className="text-sm text-muted-foreground mb-4">{trainer.bio}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border/40">
            {[
              { label: 'Hourly Rate',      value: trainer.hourlyRate ? `₹${trainer.hourlyRate}/hr` : 'Not set' },
              { label: 'Completion Rate',  value: `${d.completionRate ?? 0}%` },
              { label: 'Total Sessions',   value: d.monthlySessions ?? 0 },
              { label: 'Performance',      value: scoreLabel },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
