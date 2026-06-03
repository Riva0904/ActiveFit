'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Send, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { leavesApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const LEAVE_TYPES = ['SICK', 'CASUAL', 'EMERGENCY', 'OTHER'] as const;

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:  { label: 'Pending',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: XCircle },
};

const leaveTypeLabel: Record<string, string> = {
  SICK: 'Sick Leave', CASUAL: 'Casual Leave', EMERGENCY: 'Emergency Leave', OTHER: 'Other',
};

export default function TrainerLeavePage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveType: 'CASUAL', startDate: '', endDate: '', reason: '' });

  const fetchLeaves = () =>
    leavesApi.getMyLeaves().then((res: any) => setLeaves(res?.data ?? [])).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => { fetchLeaves(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error('End date must be after start date');
      return;
    }
    setSubmitting(true);
    try {
      await leavesApi.apply(form);
      toast.success('Leave application submitted! Admin will be notified.');
      setForm({ leaveType: 'CASUAL', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to submit leave application');
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave Application</h1>
        <p className="text-muted-foreground">Apply for leave and track your requests</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: leaves.length,                                           color: 'text-foreground' },
          { label: 'Pending',  value: leaves.filter((l) => l.status === 'PENDING').length,    color: 'text-yellow-600' },
          { label: 'Approved', value: leaves.filter((l) => l.status === 'APPROVED').length,   color: 'text-green-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Apply for Leave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Leave Type</label>
                <select
                  value={form.leaveType}
                  onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-input bg-transparent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>{leaveTypeLabel[t]}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={form.startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={form.endDate}
                    min={form.startDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Briefly describe your reason for leave..."
                  className="w-full min-h-24 px-3 py-2 rounded-lg border border-input bg-transparent text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <Button type="submit" variant="brand" className="w-full gap-2" loading={submitting}>
                <Send className="w-4 h-4" /> Submit Application
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> My Leave History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
              ) : leaves.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">No leave applications yet</p>
                </div>
              ) : leaves.map((leave: any) => {
                const cfg = statusConfig[leave.status] ?? statusConfig.PENDING;
                const Icon = cfg.icon;
                return (
                  <div key={leave.id} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{leaveTypeLabel[leave.leaveType] ?? leave.leaveType}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(leave.startDate)} — {formatDate(leave.endDate)}
                    </p>
                    <p className="text-xs text-foreground/80 line-clamp-2">{leave.reason}</p>
                    {leave.adminNote && (
                      <p className="text-xs italic text-muted-foreground border-t border-border pt-2">
                        Admin note: {leave.adminNote}
                      </p>
                    )}
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
