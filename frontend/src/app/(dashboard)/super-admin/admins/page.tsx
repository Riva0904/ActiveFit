'use client';

import { useEffect, useState } from 'react';
import { UserCheck, Plus, Search, MoreVertical, Mail, Phone, Building2, Trash2, Eye, EyeOff, X } from 'lucide-react';
import { usersApi, gymsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const statusBadge: Record<string, string> = {
  true:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  false: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

// ─── Add Admin Modal ──────────────────────────────────────────────────────────
function AddAdminModal({ gyms, onClose, onSaved }: { gyms: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', gymId: '' });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    const e: any = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim()) e.email = 'Required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email';
    if (form.password.length < 8) e.password = 'Min 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await usersApi.create({ ...form, role: 'GYM_ADMIN' });
      toast.success('Admin account created! Credentials sent via email.');
      onSaved();
      onClose();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (field: string) => cn(
    'w-full h-[42px] rounded-[10px] px-3 border-[1.5px] text-sm outline-none bg-card text-foreground box-border transition-colors',
    'focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/60',
    errors[field] ? 'border-destructive' : 'border-border',
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl w-full max-w-[500px] shadow-lifted animate-pop">
        <div className="px-7 py-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-xl">Add Gym Admin</h2>
            <p className="text-muted-foreground text-[13px] mt-0.5">Account is active immediately — no email verification</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">First Name *</label>
              <input className={inputCls('firstName')} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="John" />
              {errors.firstName && <p className="text-destructive text-[11px] mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="form-label">Last Name *</label>
              <input className={inputCls('lastName')} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Doe" />
              {errors.lastName && <p className="text-destructive text-[11px] mt-1">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label className="form-label">Email *</label>
            <input className={inputCls('email')} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@gym.com" />
            {errors.email && <p className="text-destructive text-[11px] mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="form-label">Phone</label>
            <input className={inputCls('phone')} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 9876543210" />
          </div>

          <div>
            <label className="form-label">Password *</label>
            <div className="relative">
              <input className={cn(inputCls('password'), 'pr-10')} type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 8 characters" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-destructive text-[11px] mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="form-label">Assign to Gym (optional)</label>
            <select className={cn(inputCls('gymId'), 'cursor-pointer bg-card')} value={form.gymId} onChange={e => setForm(f => ({ ...f, gymId: e.target.value }))}>
              <option value="">— No gym assigned yet —</option>
              {gyms.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.city})</option>)}
            </select>
          </div>

          <div className="flex gap-2.5 mt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl border-[1.5px] border-border bg-card font-semibold text-sm hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-[2] h-11 rounded-xl gradient-brand shadow-brand text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? 'Creating…' : 'Create Admin Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [gyms, setGyms] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<any>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res: any = await usersApi.getAll({ role: 'GYM_ADMIN', search: search || undefined, page, limit });
      setAdmins(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => {
    gymsApi.getAll({ limit: 100 }).then((r: any) => setGyms(r.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => { fetchAdmins(); }, [search, page]);

  const handleRemove = async () => {
    if (!confirmRemove) return;
    try {
      await usersApi.remove(confirmRemove.id);
      toast.success(`${confirmRemove.firstName} removed`);
      fetchAdmins();
    } catch { }
    setConfirmRemove(null);
    setOpenMenu(null);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gym Admins</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} admin accounts across the platform</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 gradient-brand shadow-brand text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      {/* Search */}
      <div className="search-bar-wrap max-w-[360px]">
        <Search className="search-icon" />
        <input
          className="search-bar"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              {['Admin', 'Contact', 'Gym', 'Status', 'Joined', ''].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j}>
                    <div className={cn('h-3.5 bg-muted rounded-md shimmer-bg', j === 0 ? 'w-36' : 'w-20')} />
                  </td>
                ))}
              </tr>
            )) : admins.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No admins found</p>
                </td>
              </tr>
            ) : admins.map((admin: any) => (
              <tr key={admin.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-[38px] h-[38px] rounded-[10px] gradient-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {admin.firstName?.[0]}{admin.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{admin.firstName} {admin.lastName}</p>
                      <p className="text-xs text-muted-foreground">{admin.role}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-muted-foreground" />{admin.email}
                    </span>
                    {admin.phone && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />{admin.phone}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {admin.gymId ? (
                    <span className="text-[13px] flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      {gyms.find(g => g.id === admin.gymId)?.name ?? 'Assigned'}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">Not assigned</span>}
                </td>
                <td>
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', statusBadge[String(admin.isActive)])}>
                    {admin.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="text-[13px] text-muted-foreground">
                  {new Date(admin.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="relative">
                  <button onClick={() => setOpenMenu(openMenu === admin.id ? null : admin.id)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenu === admin.id && (
                    <div className="absolute right-4 top-full bg-card rounded-xl border border-border shadow-lifted z-10 min-w-[160px] overflow-hidden animate-slide-down">
                      <button onClick={() => { setConfirmRemove(admin); setOpenMenu(null); }}
                        className="w-full px-4 py-2.5 text-left bg-transparent border-0 text-[13px] cursor-pointer flex items-center gap-2 text-destructive hover:bg-destructive/5 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <span className="page-info">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
          </div>
        )}
      </div>

      {showAdd && <AddAdminModal gyms={gyms} onClose={() => setShowAdd(false)} onSaved={fetchAdmins} />}

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl w-full max-w-[400px] shadow-lifted p-8 animate-pop">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
              <Trash2 className="w-[22px] h-[22px] text-destructive" />
            </div>
            <h2 className="font-extrabold text-lg mb-2">Remove Admin</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Are you sure you want to permanently remove <strong>{confirmRemove.firstName} {confirmRemove.lastName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmRemove(null)}
                className="flex-1 h-11 rounded-xl border-[1.5px] border-border bg-card font-semibold text-sm hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleRemove}
                className="flex-1 h-11 rounded-xl bg-destructive text-white font-bold text-sm hover:opacity-90 transition-all">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {openMenu && <div className="fixed inset-0 z-[9]" onClick={() => setOpenMenu(null)} />}
    </div>
  );
}
