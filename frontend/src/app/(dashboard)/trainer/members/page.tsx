'use client';

import { useEffect, useState } from 'react';
import {
  Users, Search, Star, Dumbbell, Phone, Mail, Calendar,
  TrendingUp, Loader2, UserCheck,
} from 'lucide-react';
import { ptSessionsApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

const gradients = ['gradient-brand', 'gradient-blue', 'gradient-purple', 'gradient-green', 'gradient-teal', 'gradient-rose'];

export default function TrainerMembersPage() {
  const [clients, setClients]   = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(clients); return; }
    const q = search.toLowerCase();
    setFiltered(clients.filter((c: any) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.memberCode?.toLowerCase().includes(q),
    ));
  }, [search, clients]);

  const loadClients = async () => {
    try {
      const members: any = await ptSessionsApi.getAssignedMembers();
      const list = Array.isArray(members) ? members : (members?.data ?? []);
      // flatten nested user fields to root level
      const flat = list.map((m: any) => ({
        ...m,
        firstName: m.user?.firstName ?? m.firstName,
        lastName:  m.user?.lastName  ?? m.lastName,
        email:     m.user?.email     ?? m.email,
        phone:     m.user?.phone     ?? m.phone,
        avatar:    m.user?.avatar    ?? m.avatar,
      }));
      setClients(flat);
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Members</h1>
          <p className="text-muted-foreground">{clients.length} client{clients.length !== 1 ? 's' : ''} assigned to you</p>
        </div>
        <div className="flex items-center gap-3 bg-muted/60 border border-border/60 rounded-xl px-4 py-2.5 w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, ID…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Members grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-semibold text-lg">{search ? 'No members match your search' : 'No clients assigned yet'}</p>
          <p className="text-sm mt-1">
            {search ? 'Try a different search term' : 'Ask your admin to assign members to you'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client: any, i: number) => (
            <div
              key={client.id}
              className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden hover:shadow-lifted hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              onClick={() => setSelected(selected?.id === client.id ? null : client)}
            >
              {/* Card header */}
              <div className={`${gradients[i % gradients.length]} p-5 relative overflow-hidden`}>
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15" />
                <div className="relative z-10 flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl overflow-hidden flex items-center justify-center text-white font-extrabold text-lg border border-white/30">
                    {client.avatar
                      ? <img src={client.avatar} alt="avatar" className="w-full h-full object-cover" />
                      : <>{client.firstName?.[0]}{client.lastName?.[0]}</>}
                  </div>
                  <div>
                    <p className="font-bold text-white">{client.firstName} {client.lastName}</p>
                    {client.memberCode && (
                      <span className="text-xs text-white/80 font-mono font-bold">#{client.memberCode}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4 space-y-3">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                )}

                {/* Membership badge */}
                {client.memberships?.[0] && (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Expires {formatDate(client.memberships[0].endDate)}</span>
                    </div>
                    <Badge
                      variant={client.memberships[0].status === 'ACTIVE' ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {client.memberships[0].status}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Expanded details */}
              {selected?.id === client.id && (
                <div className="px-4 pb-4 pt-0 border-t border-border/40 space-y-3 mt-0">
                  <div className="grid grid-cols-2 gap-2 pt-3">
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold">{client.attendance?.length ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">Visits</p>
                    </div>
                    <div className="bg-muted/50 rounded-xl p-3 text-center">
                      <p className="text-lg font-extrabold">{client.ptSessions?.length ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">PT Sessions</p>
                    </div>
                  </div>
                  {client.memberships?.[0]?.type && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-semibold">{client.memberships[0].type}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Member since</span>
                    <span className="font-semibold">{formatDate(client.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats summary */}
      {clients.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-6">
          <h3 className="font-bold mb-4">Client Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Clients', value: clients.length, icon: Users },
              { label: 'Active Members', value: clients.filter((c: any) => c.memberships?.[0]?.status === 'ACTIVE').length, icon: UserCheck },
              { label: 'Expiring Soon', value: clients.filter((c: any) => {
                const m = c.memberships?.[0];
                if (!m?.endDate) return false;
                const days = Math.ceil((new Date(m.endDate).getTime() - Date.now()) / 86400000);
                return days >= 0 && days <= 7;
              }).length, icon: Calendar },
              { label: 'Avg Sessions', value: clients.length > 0
                ? Math.round(clients.reduce((acc: number, c: any) => acc + (c.ptSessions?.length ?? 0), 0) / clients.length)
                : 0, icon: Dumbbell },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 bg-muted/50 rounded-xl p-4">
                <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-extrabold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
