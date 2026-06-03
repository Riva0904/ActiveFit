'use client';

import { useEffect, useState } from 'react';
import { QrCode, Users, UserCheck, Clock, ArrowRight, Activity, CheckCircle } from 'lucide-react';
import { StatsCard } from '@/components/shared/StatsCard';
import { attendanceApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function StaffDashboard() {
  const { user } = useAuthStore();
  const [todayStats, setTodayStats] = useState<any>(null);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      attendanceApi.getTodayStats().catch(() => null),
      attendanceApi.getAll({ limit: 10, date: new Date().toISOString().split('T')[0] }).catch(() => ({ data: [] })),
    ]).then(([stats, records]: any[]) => {
      setTodayStats(stats);
      setRecentRecords(records?.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const stats = [
    { title: "Today's Check-ins", value: todayStats?.totalToday ?? 0, icon: UserCheck, gradient: 'green' as const },
    { title: 'Currently In Gym',  value: todayStats?.currentlyIn ?? 0, icon: Users,     gradient: 'blue' as const },
    { title: 'Total Members',     value: todayStats?.totalMembers ?? 0, icon: Clock,    gradient: 'orange' as const },
  ];

  return (
    <div className="space-y-6 animate-slide-up">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-7 shadow-brand">
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 live-dot" />
              <span className="text-white/70 text-sm font-medium">Staff Dashboard</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome, {user?.firstName}!
            </h1>
            <p className="text-white/70 mt-1">Manage check-ins and assist members today</p>
          </div>
          <Link
            href="/staff/check-in"
            className="flex items-center gap-2 bg-white text-orange-600 font-bold px-5 py-2.5 rounded-xl hover:bg-orange-50 transition-all text-sm shadow-lg"
          >
            <QrCode className="w-4 h-4" /> Open Scanner
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        {stats.map((s) => (
          <StatsCard key={s.title} {...s} className="animate-slide-up" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quick actions */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <h3 className="font-bold text-lg mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'QR Check-In', icon: QrCode, href: '/staff/check-in', gradient: 'gradient-brand' },
              { label: 'View Attendance', icon: Activity, href: '/staff/check-in', gradient: 'gradient-green' },
            ].map(({ label, icon: Icon, href, gradient }) => (
              <Link key={label} href={href}
                className="group relative overflow-hidden rounded-2xl bg-card border border-border/60 p-5 hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
                <div className={`w-11 h-11 ${gradient} rounded-xl flex items-center justify-center text-white mb-4 shadow-sm group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold">{label}</p>
                <ArrowRight className="w-4 h-4 text-muted-foreground absolute bottom-5 right-5 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        {/* Today's recent log */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <div>
              <h3 className="font-bold">Today's Recent Check-ins</h3>
              <p className="text-xs text-muted-foreground">Last {recentRecords.length} entries</p>
            </div>
            <Badge variant="secondary">{recentRecords.length}</Badge>
          </div>

          <div className="divide-y divide-border/40 max-h-72 overflow-y-auto scrollbar-hide">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 rounded-xl shimmer-bg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 shimmer-bg rounded" />
                    <div className="h-3 w-20 shimmer-bg rounded" />
                  </div>
                </div>
              ))
            ) : recentRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <UserCheck className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">No check-ins today yet</p>
              </div>
            ) : (
              recentRecords.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {r.user?.firstName?.[0]}{r.user?.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{r.user?.firstName} {r.user?.lastName}</p>
                      {r.user?.memberCode && (
                        <span className="text-xs font-mono text-primary font-bold">#{r.user.memberCode}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateTime(r.checkInTime)}</p>
                  </div>
                  {r.checkOutTime ? (
                    <Badge variant="secondary" className="text-xs shrink-0">Out</Badge>
                  ) : (
                    <Badge variant="success" className="text-xs shrink-0">In gym</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Today summary card */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 gradient-green rounded-xl flex items-center justify-center text-white">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold">Today's Summary</h3>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Check-ins', value: todayStats?.totalToday ?? 0 },
            { label: 'Currently In Gym', value: todayStats?.currentlyIn ?? 0 },
            { label: 'Checked Out', value: (todayStats?.totalToday ?? 0) - (todayStats?.currentlyIn ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-muted/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">{loading ? '—' : value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
