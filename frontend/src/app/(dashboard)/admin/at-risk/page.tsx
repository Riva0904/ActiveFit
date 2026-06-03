'use client';

import { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { HeartHandshake, Send, Loader2, RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_OPTIONS = [14, 30, 60];

export default function AtRiskPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [sending, setSending] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data: any = await usersApi.getAtRisk({ days });
      setMembers(data ?? []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [days]);

  const sendWinback = async (memberId: string) => {
    setSending(memberId);
    try {
      await usersApi.sendWinback(memberId);
      toast.success('Win-back message sent!');
      setMembers(prev => prev.filter(m => m.memberId !== memberId));
    } catch { }
    finally { setSending(null); }
  };

  const sendAll = async () => {
    if (!confirm(`Send win-back message to all ${members.length} at-risk members?`)) return;
    setBulkSending(true);
    const results = await Promise.allSettled(members.map(m => usersApi.sendWinback(m.memberId)));
    const sent = results.filter(r => r.status === 'fulfilled').length;
    toast.success(`Win-back sent to ${sent}/${members.length} members`);
    setMembers([]);
    setBulkSending(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <HeartHandshake className="w-7 h-7 text-orange-500" />
            At-Risk Members
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Active members who have not checked in recently. Send them a win-back message.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 border border-border rounded-xl px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Inactive for:</span>
          {DAY_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'px-4 py-1.5 rounded-xl text-sm font-medium transition-all',
                days === d ? 'bg-brand text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {d}+ days
            </button>
          ))}
        </div>
        {members.length > 0 && (
          <button
            onClick={sendAll}
            disabled={bulkSending}
            className="ml-auto flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {bulkSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Message All ({members.length})
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <HeartHandshake className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-60" />
          <p className="font-bold text-lg">All members are engaged!</p>
          <p className="text-sm text-muted-foreground mt-1">No members have been inactive for {days}+ days.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-3 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {members.length} member{members.length !== 1 ? 's' : ''} inactive for {days}+ days
          </div>
          <div className="divide-y divide-border">
            {members.map((m: any) => (
              <div key={m.memberId} className="flex items-center gap-4 px-6 py-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {m.firstName?.charAt(0) ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{m.firstName} {m.lastName}</p>
                  <p className="text-xs text-muted-foreground">{m.memberCode}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-orange-600 justify-end">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-sm font-bold">
                      {m.daysSinceLastVisit !== null ? `${m.daysSinceLastVisit}d ago` : 'Never'}
                    </span>
                  </div>
                  {m.membershipEndDate && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Expires {new Date(m.membershipEndDate).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => sendWinback(m.memberId)}
                  disabled={sending === m.memberId}
                  className="flex items-center gap-1.5 text-xs font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-2 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {sending === m.memberId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Win-back
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
