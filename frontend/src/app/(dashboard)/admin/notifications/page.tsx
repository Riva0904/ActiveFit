'use client';

import { useEffect, useState } from 'react';
import { Bell, Send, CheckCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { notificationsApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadNotifications = () => {
    notificationsApi.getAll()
      .then((res: any) => setNotifications(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => {});
  };

  useEffect(() => { loadNotifications(); }, []);

  const broadcast = async () => {
    if (!title || !message) return;
    setSending(true);
    try {
      const res: any = await notificationsApi.broadcast({ title, message, type: 'GENERAL' });
      toast.success(`Notification sent to ${res?.count ?? 'all'} members`);
      setTitle(''); setMessage('');
      loadNotifications();
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Send messages and manage alerts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Broadcast to Members</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Your message to all members..."
                className="w-full min-h-24 px-3 py-2 rounded-lg border border-input bg-transparent text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button variant="brand" className="w-full gap-2" onClick={broadcast} loading={sending}>
              <Send className="w-4 h-4" /> Send to All Members
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Recent Notifications</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => notificationsApi.markAllAsRead()}>
              <CheckCheck className="w-3 h-3" /> Mark all read
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No notifications</p>
                </div>
              ) : notifications.map((n: any) => (
                <div key={n.id} className={`p-3 rounded-lg border ${n.isRead ? 'border-border bg-transparent' : 'border-primary/20 bg-primary/5'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
