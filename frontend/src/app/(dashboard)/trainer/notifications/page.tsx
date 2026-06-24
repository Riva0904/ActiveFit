'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { notificationsApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function TrainerNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    notificationsApi.getAll()
      .then((res: any) => setNotifications(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await notificationsApi.markAllAsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success('All marked as read');
  };

  const markOne = async (id: string) => {
    await notificationsApi.markAsRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  };

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Messages and alerts from your gym</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            {unread > 0 ? `${unread} Unread` : 'All Notifications'}
          </CardTitle>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={markAll}>
              <CheckCheck className="w-3 h-3" /> Mark all read
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm mt-1">Announcements from your gym will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markOne(n.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    n.isRead
                      ? 'border-border bg-transparent'
                      : 'border-primary/30 bg-primary/5 hover:bg-primary/8'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{formatDateTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
