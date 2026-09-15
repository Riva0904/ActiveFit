'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Search, Check, Loader2, UserPlus, Trash2 } from 'lucide-react';
import { usersApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Assignment {
  id: string;
  member?: { id: string; memberCode?: string; user?: { firstName: string; lastName: string } };
}

interface Props {
  planName: string;
  /** Assign the given member ids to the plan. */
  onAssign: (memberIds: string[]) => Promise<any>;
  /** Current assignments, so the sheet can show and remove them. */
  loadAssignments: () => Promise<any>;
  onUnassign: (assignmentId: string) => Promise<any>;
  onClose: () => void;
}

/** Shared by the diet and workout builders — pick members, assign, unassign. */
export function AssignMembersModal({ planName, onAssign, loadAssignments, onUnassign, onClose }: Props) {
  const [members, setMembers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    Promise.all([usersApi.getAll({ role: 'MEMBER', limit: 200 }), loadAssignments()])
      .then(([u, a]: any[]) => {
        setMembers(u?.data ?? []);
        setAssignments(a ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const assignedMemberIds = useMemo(
    () => new Set(assignments.map((a) => a.member?.id).filter(Boolean) as string[]),
    [assignments],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (!m.memberId) return false; // needs a member profile to be assignable
      if (!q) return true;
      return `${m.firstName} ${m.lastName} ${m.memberCode ?? ''}`.toLowerCase().includes(q);
    });
  }, [members, search]);

  const toggle = (memberId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  };

  const assign = async () => {
    if (selected.size === 0) { toast.error('Pick at least one member'); return; }
    setSaving(true);
    try {
      const res: any = await onAssign([...selected]);
      toast.success(`Assigned to ${res?.assigned ?? selected.size} member${(res?.assigned ?? 1) === 1 ? '' : 's'}`);
      setSelected(new Set());
      refresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not assign');
    }
    setSaving(false);
  };

  const unassign = async (assignmentId: string) => {
    setRemoving(assignmentId);
    try {
      await onUnassign(assignmentId);
      toast.success('Removed');
      refresh();
    } catch {
      toast.error('Could not remove');
    }
    setRemoving(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-pop">
        <div className="gradient-brand p-5 relative overflow-hidden shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="font-extrabold text-xl text-white truncate">Assign members</h2>
              <p className="text-sm text-white/70 truncate">{planName}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-border/60 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className="w-full h-10 pl-9 pr-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="shimmer-row h-12 rounded-xl" />)}</div>
          ) : (
            <>
              {assignments.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-2 mb-1.5">
                    Currently on this plan ({assignments.length})
                  </p>
                  {assignments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                        {getInitials(a.member?.user?.firstName ?? '?', a.member?.user?.lastName ?? '')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {a.member?.user?.firstName} {a.member?.user?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{a.member?.memberCode}</p>
                      </div>
                      <button
                        onClick={() => unassign(a.id)}
                        disabled={removing === a.id}
                        className="w-8 h-8 rounded-lg border border-border/60 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        title="Remove from plan"
                      >
                        {removing === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-2 mb-1.5">Add members</p>
              {filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No members found.</p>
              ) : filtered.map((m) => {
                const already = assignedMemberIds.has(m.memberId);
                const picked = selected.has(m.memberId);
                return (
                  <button
                    key={m.id}
                    onClick={() => !already && toggle(m.memberId)}
                    disabled={already}
                    className={cn(
                      'w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors',
                      already ? 'opacity-40 cursor-not-allowed' : picked ? 'bg-primary/10' : 'hover:bg-muted',
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                      picked ? 'bg-primary border-primary' : 'border-border',
                    )}>
                      {(picked || already) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="w-8 h-8 rounded-lg gradient-brand text-white text-xs font-bold flex items-center justify-center">
                      {getInitials(m.firstName, m.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{m.firstName} {m.lastName}</p>
                      <p className="text-xs text-muted-foreground">{m.memberCode ?? m.email}</p>
                    </div>
                    {already && <span className="text-xs text-emerald-600 font-bold shrink-0">On plan</span>}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-border shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Done</button>
          <button
            onClick={assign}
            disabled={saving || selected.size === 0}
            className="flex-[2] py-2.5 rounded-xl gradient-brand text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Assign {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AssignMembersModal;
