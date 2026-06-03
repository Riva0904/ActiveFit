'use client';

import { useEffect, useState } from 'react';
import { enquiriesApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  Plus, Search, Phone, Mail, Calendar, ChevronDown,
  UserCheck, Loader2, Trash2, X, MessageSquare,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW:           { label: 'New',       color: 'bg-blue-100 text-blue-700' },
  CONTACTED:     { label: 'Contacted', color: 'bg-yellow-100 text-yellow-700' },
  INTERESTED:    { label: 'Interested',color: 'bg-purple-100 text-purple-700' },
  CONVERTED:     { label: 'Converted', color: 'bg-green-100 text-green-700' },
  NOT_INTERESTED:{ label: 'Lost',      color: 'bg-red-100 text-red-700' },
};

const SOURCE_LABELS: Record<string, string> = {
  WALK_IN:     'Walk-in',
  PHONE:       'Phone',
  WEBSITE:     'Website',
  REFERRAL:    'Referral',
  SOCIAL_MEDIA:'Social Media',
};

const SOURCES = Object.keys(SOURCE_LABELS);
const STATUSES = Object.keys(STATUS_CONFIG);

function AddEnquiryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', source: '', interest: '', notes: '', followUpDate: '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name || !form.phone) { toast.error('Name and phone are required'); return; }
    setSaving(true);
    try {
      await enquiriesApi.create({ ...form, source: form.source || undefined, followUpDate: form.followUpDate || undefined });
      toast.success('Enquiry added!');
      onSaved();
      onClose();
    } catch { }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl animate-zoom-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-bold text-lg">New Enquiry</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Full Name *', key: 'name', type: 'text' },
            { label: 'Phone *',     key: 'phone', type: 'tel' },
            { label: 'Email',       key: 'email', type: 'email' },
            { label: 'Interest',    key: 'interest', type: 'text' },
            { label: 'Follow-up Date', key: 'followUpDate', type: 'date' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          ))}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Source</label>
            <select
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Select source</option>
              {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
            />
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted/50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 text-sm gradient-brand text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Enquiry
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EnquiriesPage() {
  const { user } = useAuthStore();
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, kanban] = await Promise.all([
        enquiriesApi.getAll({ search: search || undefined, status: statusFilter || undefined, limit: 50 }),
        enquiriesApi.getKanbanStats(),
      ]);
      setEnquiries((data as any).data ?? []);
      setStats((kanban as any) ?? []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    try {
      await enquiriesApi.update(id, { status });
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
      toast.success(`Marked as ${STATUS_CONFIG[status]?.label}`);
    } catch { }
    finally { setActionLoading(null); }
  };

  const convertEnquiry = async (enquiry: any) => {
    setActionLoading(enquiry.id + 'convert');
    try {
      await enquiriesApi.convert(enquiry.id, {});
      setEnquiries(prev => prev.map(e => e.id === enquiry.id ? { ...e, status: 'CONVERTED' } : e));
      toast.success('Enquiry marked as converted! Create the member from Members page.');
    } catch { }
    finally { setActionLoading(null); }
  };

  const deleteEnquiry = async (id: string) => {
    if (!confirm('Delete this enquiry?')) return;
    try {
      await enquiriesApi.remove(id);
      setEnquiries(prev => prev.filter(e => e.id !== id));
      toast.success('Deleted');
    } catch { }
  };

  const totalStat = stats.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track walk-ins, calls, and online enquiries — convert them to members</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 gradient-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-brand">
          <Plus className="w-4 h-4" />
          New Enquiry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {stats.map((s: any) => (
          <button
            key={s.status}
            onClick={() => setStatusFilter(statusFilter === s.status ? '' : s.status)}
            className={cn(
              'bg-card border rounded-xl p-3 text-center transition-all hover:shadow-md',
              statusFilter === s.status ? 'border-brand ring-2 ring-brand/20' : 'border-border'
            )}
          >
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{STATUS_CONFIG[s.status]?.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, email..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="flex items-center gap-1.5 text-sm border border-border rounded-xl px-3 py-2 hover:bg-muted/50">
            <X className="w-3 h-3" /> Clear filter
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
      ) : enquiries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No enquiries yet</p>
          <p className="text-sm mt-1">Add your first lead using the button above</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {enquiries.map((enq: any) => (
            <div key={enq.id} className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-brand text-sm">{enq.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{enq.name}</p>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', STATUS_CONFIG[enq.status]?.color)}>
                      {STATUS_CONFIG[enq.status]?.label}
                    </span>
                    {enq.source && (
                      <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                        {SOURCE_LABELS[enq.source] ?? enq.source}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{enq.phone}</span>
                    {enq.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{enq.email}</span>}
                    {enq.followUpDate && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                        {new Date(enq.followUpDate).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                  {enq.interest && <p className="text-xs text-muted-foreground mt-1 italic">{enq.interest}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {enq.status !== 'CONVERTED' && enq.status !== 'NOT_INTERESTED' && (
                    <div className="relative group">
                      <button className="flex items-center gap-1 text-xs border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted/50 font-medium">
                        Action <ChevronDown className="w-3 h-3" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-10 min-w-[160px] hidden group-focus-within:block group-hover:block">
                        {enq.status === 'NEW' && (
                          <button
                            onClick={() => updateStatus(enq.id, 'CONTACTED')}
                            disabled={actionLoading === enq.id + 'CONTACTED'}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 rounded-t-xl"
                          >
                            Mark Contacted
                          </button>
                        )}
                        {enq.status === 'CONTACTED' && (
                          <button
                            onClick={() => updateStatus(enq.id, 'INTERESTED')}
                            disabled={actionLoading === enq.id + 'INTERESTED'}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 rounded-t-xl"
                          >
                            Mark Interested
                          </button>
                        )}
                        {(enq.status === 'INTERESTED' || enq.status === 'CONTACTED') && (
                          <button
                            onClick={() => convertEnquiry(enq)}
                            disabled={actionLoading === enq.id + 'convert'}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 text-green-700 font-medium"
                          >
                            <UserCheck className="w-4 h-4 inline mr-1.5" />
                            Convert to Member
                          </button>
                        )}
                        <button
                          onClick={() => updateStatus(enq.id, 'NOT_INTERESTED')}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 rounded-b-xl text-red-600"
                        >
                          Mark as Lost
                        </button>
                      </div>
                    </div>
                  )}
                  <button onClick={() => deleteEnquiry(enq.id)} className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddEnquiryModal onClose={() => setShowAdd(false)} onSaved={load} />}
    </div>
  );
}
