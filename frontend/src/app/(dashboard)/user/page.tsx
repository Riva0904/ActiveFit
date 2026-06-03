'use client';

import { useEffect, useState } from 'react';
import { QrCode, Activity, Calendar, Star, CreditCard, TrendingUp, Dumbbell, Utensils, ShoppingBag, ArrowRight, CheckCircle, Flame } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { attendanceApi, membershipsApi } from '@/lib/api';
import { formatDate, daysUntil, getMembershipBadgeColor, formatDateTime } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function UserDashboard() {
  const { user } = useAuthStore();
  const [membership, setMembership] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      membershipsApi.getAll({ limit: 1 }),
      attendanceApi.getMyAttendance({ limit: 30 }),
    ]).then(([m, a]: any[]) => {
      setMembership(m.data?.[0] ?? null);
      const records = a.data ?? [];
      setAttendance(records);
      const today = new Date().toDateString();
      setCheckedInToday(records.some((r: any) => new Date(r.checkInTime).toDateString() === today));
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      const result: any = await attendanceApi.selfCheckIn();
      if (result?.action === 'CHECKOUT') {
        toast.success('Checked out! Great workout! 💪');
        setCheckedInToday(false);
      } else {
        toast.success('Checked in! Enjoy your workout! 💪');
        setCheckedInToday(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Check-in failed');
    }
    setCheckingIn(false);
  };

  const daysLeft = membership ? daysUntil(membership.endDate) : null;

  const streak = (() => {
    if (attendance.length === 0) return 0;
    const uniqueDays = [...new Set(
      attendance.map((r: any) => new Date(r.checkInTime).toDateString())
    )].map(d => new Date(d).getTime()).sort((a, b) => b - a);

    let count = 0;
    let expected = new Date();
    expected.setHours(0, 0, 0, 0);
    for (const dayMs of uniqueDays) {
      const diff = Math.round((expected.getTime() - dayMs) / 86400000);
      if (diff > 1) break;
      count++;
      expected = new Date(dayMs);
    }
    return count;
  })();

  const quickLinks = [
    { label: 'Workouts', icon: Dumbbell, href: '/user/workouts', gradient: 'gradient-brand', desc: 'AI plans' },
    { label: 'Diet Plans', icon: Utensils, href: '/user/diet', gradient: 'gradient-green', desc: 'Nutrition' },
    { label: 'Supplements', icon: ShoppingBag, href: '/user/supplements', gradient: 'gradient-purple', desc: 'Shop now' },
    { label: 'Progress', icon: TrendingUp, href: '/user/progress', gradient: 'gradient-blue', desc: 'Track body' },
    { label: 'Payments', icon: CreditCard, href: '/user/payments', gradient: 'gradient-rose', desc: 'History' },
    { label: 'My Trainer', icon: Star, href: '/user/trainer', gradient: 'gradient-teal', desc: 'Connect' },
  ];

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Greeting banner */}
      <div className="relative overflow-hidden rounded-2xl gradient-brand p-6 shadow-brand">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/20" />
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-yellow-300" />
              <span className="text-white/80 text-sm font-medium">{streak}-day streak</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white">Hey, {user?.firstName}! 💪</h1>
            <p className="text-white/70 text-sm mt-0.5">Ready to crush today's workout?</p>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className={cn(
              'flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-sm transition-all',
              checkedInToday
                ? 'bg-white/20 text-white border border-white/30 hover:bg-white/30 active:scale-95'
                : 'bg-white text-orange-600 hover:bg-orange-50 shadow-lg active:scale-95',
            )}
          >
            {checkingIn ? (
              <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            ) : checkedInToday ? (
              <><CheckCircle className="w-4 h-4 text-green-400" /> Check Out</>
            ) : (
              <><Activity className="w-4 h-4" /> Check In</>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* QR Card */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6 flex flex-col items-center gap-4">
          <div className="w-full flex items-center justify-between mb-1">
            <div>
              <h3 className="font-bold">Your QR Code</h3>
              <p className="text-xs text-muted-foreground">Scan at the gym entrance</p>
            </div>
            <QrCode className="w-4 h-4 text-muted-foreground" />
          </div>

          {user?.qrCode ? (
            <div className="p-4 bg-white rounded-2xl shadow-inner border border-border/30">
              <QRCodeSVG value={user.qrCode} size={148} level="M" />
            </div>
          ) : (
            <div className="w-44 h-44 bg-muted rounded-2xl flex items-center justify-center">
              <QrCode className="w-16 h-16 text-muted-foreground/30" />
            </div>
          )}
          {(user as any)?.memberCode && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-xl border border-primary/20">
              <span className="text-xs text-muted-foreground">Member ID:</span>
              <span className="text-sm font-extrabold font-mono text-primary">{(user as any).memberCode}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">Show to gym staff for quick check-in</p>
        </div>

        {/* Membership Card */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Membership</h3>
            <Star className="w-4 h-4 text-yellow-500" />
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-32 shimmer-bg rounded-xl" />
            </div>
          ) : membership ? (
            <>
              {/* Card visual */}
              <div className="relative overflow-hidden rounded-xl gradient-brand p-4 mb-4 aspect-[1.8/1]">
                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/15" />
                <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-black/15 blur-xl" />
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 text-xs font-medium uppercase tracking-widest">{membership.type}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getMembershipBadgeColor(membership.status)}`}>
                      {membership.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-extrabold text-lg leading-tight">{user?.firstName} {user?.lastName}</p>
                    <p className="text-white/70 text-xs mt-0.5">Expires {formatDate(membership.endDate)}</p>
                  </div>
                </div>
              </div>

              {daysLeft !== null && daysLeft <= 30 && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
                  daysLeft <= 7 ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                }`}>
                  <span className="text-base">{daysLeft <= 7 ? '⚠️' : '⏰'}</span>
                  {daysLeft <= 0 ? 'Membership expired' : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                  <Link href="/user/membership" className="ml-auto font-bold hover:underline">Renew →</Link>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <Star className="w-12 h-12 mx-auto mb-2 text-muted-foreground/30" />
              <p className="font-semibold text-muted-foreground">No active membership</p>
              <Link href="/user/membership"
                className="inline-block mt-3 text-sm font-bold text-primary hover:underline">
                Get a plan →
              </Link>
            </div>
          )}
        </div>

        {/* Recent attendance */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Recent Visits</h3>
            <Link href="/user/attendance" className="text-xs text-primary font-semibold hover:underline">View all</Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 shimmer-bg rounded-xl" />
              ))}
            </div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No visits recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendance.slice(0, 6).map((a: any, i: number) => {
                const today = new Date().toDateString() === new Date(a.checkInTime).toDateString();
                return (
                  <div key={a.id} className={cn(
                    'flex items-center gap-3 p-2.5 rounded-xl transition-colors',
                    today ? 'bg-primary/8 border border-primary/20' : 'hover:bg-muted/50',
                  )}>
                    <div className={cn('w-2 h-2 rounded-full shrink-0', today ? 'bg-primary live-dot' : 'bg-emerald-500')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{today ? 'Today' : formatDate(a.checkInTime)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(a.checkInTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                        {a.checkOutTime && ` → ${new Date(a.checkOutTime).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="font-bold text-lg mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
          {quickLinks.map(({ label, icon: Icon, href, gradient, desc }) => (
            <Link key={label} href={href}
              className="group relative bg-card border border-border/60 rounded-2xl p-4 flex flex-col items-center gap-2.5 text-center hover:shadow-lifted hover:-translate-y-1 transition-all duration-300 animate-slide-up">
              <div className={`w-12 h-12 ${gradient} rounded-2xl flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">{label}</p>
                <p className="text-[11px] text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
