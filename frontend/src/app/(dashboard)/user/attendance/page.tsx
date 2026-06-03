'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { attendanceApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

export default function UserAttendancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const thisWeekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  useEffect(() => {
    attendanceApi.getMyAttendance({ limit: 30 })
      .then((res: any) => setRecords(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getDuration = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return 'In progress';
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance History</h1>
        <p className="text-muted-foreground">{records.length} gym visits tracked</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 text-center"><p className="text-3xl font-bold">{records.length}</p><p className="text-sm text-muted-foreground">Total Visits</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><p className="text-3xl font-bold">{records.filter((r) => new Date(r.checkInTime).getMonth() === new Date().getMonth()).length}</p><p className="text-sm text-muted-foreground">This Month</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><p className="text-3xl font-bold">{records.filter((r) => new Date(r.checkInTime) >= thisWeekStart).length}</p><p className="text-sm text-muted-foreground">This Week</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Visit Log</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}</div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Activity className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No visits recorded yet</p></div>
          ) : (
            <div className="space-y-2">
              {records.map((r: any) => (
                <div key={r.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-colors">
                  <div className="w-9 h-9 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{formatDateTime(r.checkInTime)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{getDuration(r.checkInTime, r.checkOutTime)}</span>
                      <span className="text-xs text-muted-foreground">• {r.method}</span>
                    </div>
                  </div>
                  <Badge variant={r.checkOutTime ? 'secondary' : 'success'} className="text-xs">
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
