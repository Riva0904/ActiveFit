'use client';

import { useEffect, useRef, useState } from 'react';
import {
  UserCheck, Users, Clock, Search, Calendar, Timer, Smartphone,
  Hash, CheckCircle, LogOut, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/shared/StatsCard';
import { attendanceApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import QRCode from 'qrcode.react';

function formatDuration(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return '—';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function getDisplayName(r: any): string {
  return r.member?.user
    ? `${r.member.user.firstName ?? ''} ${r.member.user.lastName ?? ''}`.trim()
    : r.user
      ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim()
      : 'Unknown';
}

function getDisplayCode(r: any): string {
  return r.member?.memberCode ?? r.user?.role ?? '';
}

function getInitials(r: any): string {
  const name = getDisplayName(r);
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
}

const RESET_DELAY = 3500;

type ManualPhase = 'idle' | 'loading' | 'success' | 'error';

export default function AttendancePage() {
  const checkInUrl = typeof window !== 'undefined' ? `${window.location.origin}/check-in` : '/check-in';

  // Manual check-in state
  const [idInput, setIdInput]       = useState('');
  const [manualPhase, setManualPhase] = useState<ManualPhase>('idle');
  const [manualResult, setManualResult] = useState<{ name: string; action: 'CHECKIN' | 'CHECKOUT'; memberCode?: string } | null>(null);
  const [manualErr, setManualErr]   = useState('');
  const idRef = useRef<HTMLInputElement>(null);

  // Records state
  const [records, setRecords]       = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState<any>(null);
  const [search, setSearch]         = useState('');
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => { loadStats(); loadRecords(); }, []);
  useEffect(() => { loadRecords(); }, [date]);

  // Auto-reset manual card after success/error
  useEffect(() => {
    if (manualPhase === 'success' || manualPhase === 'error') {
      const t = setTimeout(() => {
        setManualPhase('idle');
        setIdInput('');
        setManualResult(null);
        setManualErr('');
        loadStats();
        loadRecords();
        setTimeout(() => idRef.current?.focus(), 100);
      }, RESET_DELAY);
      return () => clearTimeout(t);
    }
  }, [manualPhase]);

  const doManualCheckIn = async () => {
    if (!idInput.trim()) return;
    setManualPhase('loading');
    try {
      const res: any = await attendanceApi.adminManualCheckIn(idInput.trim());
      setManualResult({
        name:   res.userName ?? 'Unknown',
        action: res.action   ?? 'CHECKIN',
        memberCode: res.code,
      });
      setManualPhase('success');
    } catch (err: any) {
      setManualErr(err?.response?.data?.message ?? 'ID not found in this gym.');
      setManualPhase('error');
    }
  };

  const loadStats = async () => {
    const stats: any = await attendanceApi.getTodayStats().catch(() => null);
    setTodayStats(stats);
  };

  const loadRecords = async () => {
    setLoadingRecords(true);
    const res: any = await attendanceApi.getAll({ limit: 100, date }).catch(() => ({ data: [] }));
    setRecords(res.data ?? []);
    setLoadingRecords(false);
  };

  const filtered = records.filter((r: any) => {
    if (!search.trim()) return true;
    const name = getDisplayName(r).toLowerCase();
    const code = getDisplayCode(r).toLowerCase();
    return name.includes(search.toLowerCase()) || code.includes(search.toLowerCase());
  });

  const isToday = date === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-muted-foreground">Members, trainers, and staff scan the gym QR code to check in/out</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Today's Check-ins"  value={todayStats?.totalToday   ?? 0} icon={UserCheck} gradient="green"  />
        <StatsCard title="Currently In Gym"   value={todayStats?.currentlyIn  ?? 0} icon={Users}     gradient="blue"   />
        <StatsCard title="Total Members"      value={todayStats?.totalMembers ?? 0} icon={Clock}     gradient="orange" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Left column: QR Code + Manual Check-in stacked */}
        <div className="space-y-4">

        {/* Gym Reception QR Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="w-4 h-4 text-primary" />
              Gym Reception QR Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Print and place this QR code at the reception. Members, trainers, and staff scan it with their phone to check in/out automatically.
              </p>
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-border/40">
                <QRCode value={checkInUrl} size={180} level="H" includeMargin />
              </div>
              <p className="text-xs font-mono text-muted-foreground text-center break-all px-2">{checkInUrl}</p>
              <button
                onClick={() => window.open('/check-in', '_blank')}
                className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
              >
                Preview check-in page →
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Manual Check-in by Member ID */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="w-4 h-4 text-primary" />
              Manual Check-in / Out
            </CardTitle>
          </CardHeader>
          <CardContent>

            {/* idle / loading */}
            {(manualPhase === 'idle' || manualPhase === 'loading') && (
              <form onSubmit={e => { e.preventDefault(); doManualCheckIn(); }} className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter the member, trainer, or staff ID to check in or out manually.</p>
                <input
                  ref={idRef}
                  value={idInput}
                  onChange={e => setIdInput(e.target.value.toUpperCase())}
                  placeholder="e.g. FH001 / TRN001 / STF001"
                  className="w-full h-12 px-4 text-center text-xl font-extrabold font-mono bg-muted/50 border-2 border-border rounded-xl outline-none focus:border-primary/40 tracking-widest transition-all"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={manualPhase === 'loading' || !idInput.trim()}
                  className="w-full h-11 rounded-xl gradient-brand text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 shadow-brand text-sm"
                >
                  {manualPhase === 'loading'
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><CheckCircle className="w-4 h-4" /> Check In / Out</>}
                </button>
              </form>
            )}

            {/* success */}
            {manualPhase === 'success' && manualResult && (
              <div className={cn('rounded-2xl p-6 text-center text-white space-y-3', manualResult.action === 'CHECKIN' ? 'bg-emerald-500' : 'bg-blue-500')}>
                <div className="w-14 h-14 bg-white/20 rounded-full mx-auto flex items-center justify-center">
                  {manualResult.action === 'CHECKIN'
                    ? <CheckCircle className="w-7 h-7 text-white" />
                    : <LogOut className="w-7 h-7 text-white" />}
                </div>
                <div>
                  <p className="text-2xl font-extrabold">{manualResult.action === 'CHECKIN' ? 'Welcome!' : 'Goodbye!'}</p>
                  <p className="font-bold mt-1 opacity-90">{manualResult.name}</p>
                  {manualResult.memberCode && <p className="text-xs font-mono opacity-60 mt-0.5">#{manualResult.memberCode}</p>}
                </div>
                <p className="text-xs opacity-50">Resetting in {RESET_DELAY / 1000}s…</p>
              </div>
            )}

            {/* error */}
            {manualPhase === 'error' && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 p-5 text-center space-y-2">
                  <p className="text-rose-600 font-extrabold text-lg">Not Found</p>
                  <p className="text-sm text-rose-500">{manualErr}</p>
                </div>
                <button
                  onClick={() => { setManualPhase('idle'); setManualErr(''); setIdInput(''); }}
                  className="w-full h-10 rounded-xl border-2 border-border bg-card hover:bg-muted text-sm font-bold transition-all flex items-center justify-center gap-2 text-muted-foreground"
                >
                  <RotateCcw className="w-4 h-4" /> Try Again
                </button>
                <p className="text-center text-xs text-muted-foreground">Auto-reset in {RESET_DELAY / 1000}s</p>
              </div>
            )}

          </CardContent>
        </Card>

        </div>{/* end left column */}

        {/* Right: Attendance Log */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <CardTitle className="text-base">
                {isToday ? "Today's Log" : `Log — ${new Date(date + 'T00:00:00').toLocaleDateString('en', { dateStyle: 'long' })}`}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex items-center">
                  <Calendar className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setDate(e.target.value)}
                    className="pl-8 pr-2 h-8 text-xs bg-background border border-border/60 rounded-lg outline-none focus:border-primary/40 transition-all"
                  />
                </div>
                <div className="relative flex items-center flex-1 min-w-[120px]">
                  <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search member…"
                    className="pl-8 pr-2 h-8 w-full text-xs bg-background border border-border/60 rounded-lg outline-none focus:border-primary/40 transition-all"
                  />
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">{filtered.length} entries</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/40 mb-1">
              <span>Person</span>
              <span className="w-24 text-center">Check-in / out</span>
              <span className="w-14 text-center">Duration</span>
            </div>

            <div className="space-y-0.5 max-h-[480px] overflow-y-auto scrollbar-hide">
              {loadingRecords ? (
                <div className="text-center py-10 text-muted-foreground text-sm animate-pulse">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{search ? 'No matching records' : 'No check-ins for this date'}</p>
                </div>
              ) : filtered.map((r: any) => {
                const name     = getDisplayName(r);
                const code     = getDisplayCode(r);
                const initials = getInitials(r);
                const isActive = !r.checkOutTime;
                const duration = formatDuration(r.checkInTime, r.checkOutTime);
                return (
                  <div key={r.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 gradient-brand rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{name}</p>
                        {code && <p className="text-[10px] font-mono text-primary font-bold">{r.member?.memberCode ? `#${code}` : code}</p>}
                      </div>
                    </div>
                    <div className="w-24 text-center">
                      <p className="text-[10px] text-muted-foreground leading-tight">{formatDateTime(r.checkInTime)}</p>
                      {r.checkOutTime
                        ? <p className="text-[10px] text-muted-foreground leading-tight">{formatDateTime(r.checkOutTime)}</p>
                        : <span className="text-[10px] text-emerald-500 font-semibold">Still in</span>}
                    </div>
                    <div className="w-14 text-center">
                      {isActive ? (
                        <Badge variant="success" className="text-[10px] px-1.5">Active</Badge>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground font-medium flex items-center justify-center gap-0.5">
                          <Timer className="w-2.5 h-2.5" />{duration}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
