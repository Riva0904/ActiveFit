'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, LogOut, Zap, QrCode, Loader2, AlertCircle, RotateCcw, Dumbbell } from 'lucide-react';
import { attendanceApi, authApi } from '@/lib/api';
import { useAuthStore, useAuthHydrated } from '@/store/authStore';
import { cn } from '@/lib/utils';

type Phase = 'loading' | 'ready' | 'processing' | 'success' | 'error' | 'unauthenticated';

const ROLE_LABEL: Record<string, string> = {
  MEMBER:  'Member',
  TRAINER: 'Trainer',
  STAFF:   'Staff',
};

const ROLE_COLOR: Record<string, string> = {
  MEMBER:  'bg-blue-100 text-blue-700',
  TRAINER: 'bg-purple-100 text-purple-700',
  STAFF:   'bg-teal-100 text-teal-700',
};

const RESET_DELAY = 4000;

export default function CheckInPage() {
  const { user, setAuth } = useAuthStore();
  const hydrated = useAuthHydrated();
  const router = useRouter();
  const isMember = user?.role === 'MEMBER';

  const [phase, setPhase]             = useState<Phase>('loading');
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [membershipActive, setMembershipActive] = useState(true);
  const [result, setResult]           = useState<{ action: 'CHECKIN' | 'CHECKOUT'; userName: string; userRole: string } | null>(null);
  const [errMsg, setErrMsg]           = useState('');

  // Redirect to login if not authenticated — wait for Zustand to finish hydrating from
  // localStorage first, otherwise a logged-in user reads as null on the first render and
  // gets bounced through /login before the persisted session is restored. Even after
  // hydration, a hard navigation straight to this page (e.g. opening a QR code in a fresh
  // tab) can still race ahead of the persisted store — the httpOnly cookie is independently
  // valid, so fall back to an API profile check before giving up on the session.
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      authApi.profile()
        .then((profile: any) => setAuth(profile))
        .catch(() => router.replace('/login?redirect=/check-in'));
      return;
    }
    const allowed = ['MEMBER', 'TRAINER', 'STAFF'];
    if (!allowed.includes(user.role)) {
      // Admin/super-admin should use the admin dashboard
      router.replace('/admin/attendance');
      return;
    }
    fetchStatus();
  }, [hydrated, user]);

  // Auto-reset after success/error
  useEffect(() => {
    if (phase === 'success' || phase === 'error') {
      const t = setTimeout(() => {
        setPhase('ready');
        setResult(null);
        setErrMsg('');
        fetchStatus();
      }, RESET_DELAY);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const fetchStatus = async () => {
    try {
      if (isMember) {
        const status: any = await attendanceApi.getStatus();
        setIsCheckedIn(status.checkedIn ?? false);
        setCheckInTime(status.checkInTime ?? null);
        setMembershipActive(status.membershipActive ?? false);
      } else {
        const status: any = await attendanceApi.getMyStatus();
        setIsCheckedIn(status.isCheckedIn ?? false);
        setCheckInTime(status.checkInTime ?? null);
      }
      setPhase('ready');
    } catch {
      setPhase('ready');
    }
  };

  const handleCheckIn = async () => {
    setPhase('processing');
    try {
      if (isMember) {
        if (isCheckedIn) {
          const res: any = await attendanceApi.smartCheckOut();
          setResult({ action: 'CHECKOUT', userName: `${user!.firstName} ${user!.lastName}`, userRole: user!.role });
          setIsCheckedIn(false);
        } else {
          const res: any = await attendanceApi.smartCheckIn();
          setResult({ action: 'CHECKIN', userName: `${user!.firstName} ${user!.lastName}`, userRole: user!.role });
          setIsCheckedIn(true);
        }
        setPhase('success');
      } else {
        const res: any = await attendanceApi.selfCheckIn();
        setResult({ action: res.action, userName: res.userName, userRole: res.userRole });
        setIsCheckedIn(res.action === 'CHECKIN');
        setPhase('success');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Check-in failed. Please try again.';
      setErrMsg(Array.isArray(msg) ? msg[0] : msg);
      setPhase('error');
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  // ── Loading / redirect ────────────────────────────────────────────────────
  if (phase === 'loading' || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 select-none">

      {/* Brand header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-12 h-12 gradient-brand rounded-md flex items-center justify-center shadow-brand">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">ActiveBoost</h1>
        </div>
        <p className="text-muted-foreground font-bold uppercase tracking-wide text-xs">Gym Check-in / Check-out</p>
      </div>

      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">

        {/* ── Member: membership inactive gate ───────────────────────── */}
        {isMember && (phase === 'ready' || phase === 'processing') && !membershipActive && (
          <motion.div
            key="inactive-gate"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="bg-card border-2 border-amber-200 dark:border-amber-800/50 rounded-md shadow-2xl overflow-hidden"
          >
            <div className="bg-amber-500 p-8 text-center text-white space-y-3">
              <div className="w-20 h-20 bg-white/20 rounded-full mx-auto flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <p className="text-2xl font-black uppercase">Membership inactive.</p>
              <p className="text-sm opacity-90">Please renew your membership.</p>
            </div>
          </motion.div>
        )}

        {/* ── READY phase ─────────────────────────────────────────── */}
        {(phase === 'ready' || phase === 'processing') && (!isMember || membershipActive) && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-card border border-border/60 rounded-md shadow-2xl overflow-hidden"
          >

            {/* User identity bar */}
            <div className="gradient-brand p-6 text-center relative overflow-hidden">
              <div className="angular-accent absolute -top-8 -right-8 w-32 h-32 opacity-50" />
              <div className="relative">
                <div className="w-16 h-16 bg-white/20 rounded-full mx-auto flex items-center justify-center mb-3">
                  <span className="text-2xl font-black text-white">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </span>
                </div>
                <p className="text-white font-black text-xl uppercase tracking-tight">Welcome {user.firstName}</p>
                <span className={cn(
                  'inline-flex items-center text-xs font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-sm mt-1',
                  ROLE_COLOR[user.role] ?? 'bg-gray-100 text-gray-700',
                )}>
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5">

              {isMember && (
                <div className="flex items-center gap-3 p-3 rounded-md text-sm font-bold uppercase tracking-wide border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
                  Membership: Active
                </div>
              )}

              {/* Current status chip */}
              {isCheckedIn ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-md text-sm font-bold uppercase tracking-wide border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500 animate-pulse" />
                    Checked In At: {checkInTime ? formatTime(checkInTime) : '—'}
                  </div>
                  <div className="flex items-center gap-2 justify-center text-xs font-black uppercase tracking-wide text-primary">
                    <Dumbbell className="w-4 h-4" /> Workout Session Active
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-md text-sm font-bold uppercase tracking-wide border bg-muted/60 text-muted-foreground border-border/40">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
                  Not checked in today
                </div>
              )}

              {/* QR icon + instruction */}
              <div className="text-center">
                <div className="w-20 h-20 mx-auto border-4 border-primary/30 rounded-md flex items-center justify-center bg-primary/5 mb-3">
                  <QrCode className="w-10 h-10 text-primary/40" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isCheckedIn ? 'Tap below to check out' : 'Tap below to check in'}
                </p>
              </div>

              {/* Main action button */}
              <motion.button
                onClick={handleCheckIn}
                disabled={phase === 'processing'}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.12 }}
                className={cn(
                  'w-full h-14 rounded-md font-black uppercase tracking-wide text-white flex items-center justify-center gap-3 text-base transition-colors shadow-brand',
                  isCheckedIn ? 'bg-[#FF0033] hover:bg-[#e6002d]' : 'bg-emerald-500 hover:bg-emerald-600',
                  phase === 'processing' && 'opacity-60 cursor-not-allowed',
                )}
              >
                {phase === 'processing'
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
                  : isCheckedIn
                    ? <><LogOut className="w-5 h-5" /> Check Out</>
                    : <><CheckCircle className="w-5 h-5" /> Check In</>}
              </motion.button>

              {!isMember && (
                <p className="text-center text-xs text-muted-foreground">
                  First scan = Check-in · Second scan = Check-out
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── SUCCESS phase ────────────────────────────────────────── */}
        {phase === 'success' && result && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 340, damping: 22 }}
            className={cn(
              'rounded-md shadow-2xl overflow-hidden',
              result.action === 'CHECKIN' ? 'bg-emerald-500' : 'bg-[#FF0033]',
            )}
          >
            <div className="p-10 text-center text-white space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 16, delay: 0.1 }}
                className="w-24 h-24 bg-white/20 rounded-full mx-auto flex items-center justify-center"
              >
                {result.action === 'CHECKIN'
                  ? <CheckCircle className="w-12 h-12 text-white" />
                  : <LogOut className="w-12 h-12 text-white" />}
              </motion.div>
              <div>
                <p className="text-4xl font-black uppercase tracking-tighter">{result.action === 'CHECKIN' ? 'Welcome' : 'Goodbye'}</p>
                <p className="text-xl font-bold mt-2 opacity-90">{result.userName}</p>
                <span className="text-sm opacity-70 uppercase tracking-wide">{ROLE_LABEL[result.userRole] ?? result.userRole}</span>
              </div>
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-sm px-5 py-2 text-sm font-black uppercase tracking-wide">
                {result.action === 'CHECKIN' ? 'Checked In' : 'Checked Out'}
              </div>
              <p className="text-xs opacity-60">Resetting in {RESET_DELAY / 1000}s…</p>
            </div>
          </motion.div>
        )}

        {/* ── ERROR phase ──────────────────────────────────────────── */}
        {phase === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            className="bg-card border-2 border-rose-200 dark:border-rose-800/50 rounded-md shadow-2xl overflow-hidden"
          >
            <div className="bg-[#FF0033] p-8 text-center text-white space-y-3">
              <div className="w-20 h-20 bg-white/20 rounded-full mx-auto flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <p className="text-2xl font-black uppercase">Check-in Failed</p>
              <p className="text-sm opacity-90">{errMsg}</p>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => { setPhase('ready'); setErrMsg(''); }}
                className="w-full h-12 rounded-md gradient-brand text-white font-black uppercase tracking-wide flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              >
                <RotateCcw className="w-5 h-5" /> Try Again
              </button>
              <p className="text-center text-xs text-muted-foreground">Auto-reset in {RESET_DELAY / 1000}s</p>
            </div>
          </motion.div>
        )}

        </AnimatePresence>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        {user.firstName} {user.lastName} · {user.email}
      </p>
    </div>
  );
}
