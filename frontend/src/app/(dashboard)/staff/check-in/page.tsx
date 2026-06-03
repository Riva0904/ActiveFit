'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, QrCode } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { attendanceApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';

function getDuration(checkIn: string, checkOut: string | null) {
  if (!checkOut) return 'In progress';
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const hours = Math.floor(diff / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export default function StaffAttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceApi.getMyAttendance({ limit: 30 })
      .then((res: any) => setRecords(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const thisMonth = records.filter(
    (r) => new Date(r.checkInTime).getMonth() === new Date().getMonth(),
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Attendance</h1>
        <p className="text-muted-foreground">Your personal check-in / check-out history</p>
      </div>

      {/* Quick check-in CTA */}
      <Link
        href="/check-in"
        className="flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors"
      >
        <div className="w-12 h-12 gradient-brand rounded-xl flex items-center justify-center shrink-0">
          <QrCode className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Check In / Out</p>
          <p className="text-xs text-muted-foreground">Tap to check yourself in or out of the gym</p>
        </div>
        <span className="text-primary font-bold text-sm shrink-0">Open →</span>
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 text-center">
          <p className="text-3xl font-bold">{records.length}</p>
          <p className="text-sm text-muted-foreground">Total Days</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 text-center">
          <p className="text-3xl font-bold">{thisMonth}</p>
          <p className="text-sm text-muted-foreground">This Month</p>
        </CardContent></Card>
        <Card className="hidden sm:block"><CardContent className="pt-5 text-center">
          <p className="text-3xl font-bold">{records.filter((r) => !r.checkOutTime).length}</p>
          <p className="text-sm text-muted-foreground">Incomplete</p>
        </CardContent></Card>
      </div>

      {/* Log */}
      <Card>
        <CardHeader><CardTitle>Attendance Log</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
            ))}</div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No attendance records yet.</p>
              <p className="text-sm mt-1">Scan the gym QR code to check in.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((r: any) => (
                <div key={r.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors">
                  <div className="w-9 h-9 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{formatDateTime(r.checkInTime)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{getDuration(r.checkInTime, r.checkOutTime)}
                      </span>
                      <span className="text-xs text-muted-foreground">· {r.method ?? 'QR_CODE'}</span>
                    </div>
                  </div>
                  <Badge variant={r.checkOutTime ? 'secondary' : 'success'} className="text-xs shrink-0">
                    {r.checkOutTime ? 'Completed' : 'Active'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
