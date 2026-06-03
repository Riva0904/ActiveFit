'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Clock, CheckCircle2, XCircle, User, Filter } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { leavesApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:  { label: 'Pending',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: XCircle },
};

const leaveTypeLabel: Record<string, string> = {
  SICK: 'Sick', CASUAL: 'Casual', EMERGENCY: 'Emergency', OTHER: 'Other',
};

const roleColor: Record<string, string> = {
  STAFF:   'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  TRAINER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

export default function AdminLeavesPage() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [noteModal, setNoteModal] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [adminNote, setAdminNote] = useState('');

  const fetchLeaves = (status = statusFilter) =>
    leavesApi.getAll(status ? { status } : {})
      .then((res: any) => setLeaves(res?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { fetchLeaves(); }, [statusFilter]);

  const openModal = (id: string, action: 'approve' | 'reject') => {
    setAdminNote('');
    setNoteModal({ id, action });
  };

  const confirmAction = async () => {
    if (!noteModal) return;
    setActioningId(noteModal.id);
    try {
      if (noteModal.action === 'approve') {
        await leavesApi.approve(noteModal.id, adminNote || undefined);
        toast.success('Leave approved — applicant notified');
      } else {
        await leavesApi.reject(noteModal.id, adminNote || undefined);
        toast.success('Leave rejected — applicant notified');
      }
      setNoteModal(null);
      fetchLeaves();
    } catch { }
    setActioningId(null);
  };

  const pending  = leaves.filter((l) => l.status === 'PENDING').length;
  const approved = leaves.filter((l) => l.status === 'APPROVED').length;
  const rejected = leaves.filter((l) => l.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave Requests</h1>
        <p className="text-muted-foreground">Review and action staff &amp; trainer leave applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending',  value: pending,  color: 'text-yellow-600' },
          { label: 'Approved', value: approved, color: 'text-green-600' },
          { label: 'Rejected', value: rejected, color: 'text-red-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-5 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" /> All Leave Requests
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2 rounded-lg border border-input bg-transparent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No leave requests found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaves.map((leave: any) => {
                const cfg = statusConfig[leave.status] ?? statusConfig.PENDING;
                const StatusIcon = cfg.icon;
                const user = leave.user;
                const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
                return (
                  <div key={leave.id} className="p-4 rounded-xl border border-border bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {user?.avatar ? (
                          <img src={user.avatar} alt={initials} className="w-full h-full object-cover rounded-xl" />
                        ) : initials}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm">{user?.firstName} {user?.lastName}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleColor[user?.role] ?? ''}`}>
                            {user?.role}
                          </span>
                          <span className="text-xs text-muted-foreground">{user?.email}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">{leaveTypeLabel[leave.leaveType] ?? leave.leaveType} Leave</span>
                          <span>{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</span>
                        </div>

                        <p className="text-sm text-foreground/80">{leave.reason}</p>

                        {leave.adminNote && (
                          <p className="text-xs italic text-muted-foreground">Admin note: {leave.adminNote}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>

                        {leave.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/30"
                              onClick={() => openModal(leave.id, 'approve')}
                              disabled={actioningId === leave.id}
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={() => openModal(leave.id, 'reject')}
                              disabled={actioningId === leave.id}
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action confirmation modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">
              {noteModal.action === 'approve' ? '✅ Approve Leave' : '❌ Reject Leave'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {noteModal.action === 'approve'
                ? 'The applicant will be notified that their leave is approved.'
                : 'The applicant will be notified that their leave is rejected.'}
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Admin Note (optional)</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add a note for the applicant..."
                className="w-full min-h-20 px-3 py-2 rounded-lg border border-input bg-transparent text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setNoteModal(null)}>
                Cancel
              </Button>
              <Button
                variant={noteModal.action === 'approve' ? 'brand' : 'destructive'}
                className="flex-1"
                onClick={confirmAction}
                loading={actioningId !== null}
              >
                {noteModal.action === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
