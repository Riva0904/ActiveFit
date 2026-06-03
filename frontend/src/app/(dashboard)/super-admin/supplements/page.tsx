'use client';

import { useEffect, useState } from 'react';
import { Package, Plus, Search, MoreVertical, AlertTriangle, Edit2, Eye, EyeOff, X } from 'lucide-react';
import { supplementsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const CATEGORIES = ['PROTEIN', 'CREATINE', 'VITAMINS', 'PRE_WORKOUT', 'BCAA', 'FAT_BURNER', 'MASS_GAINER', 'OTHER'];

// ─── Add/Edit Modal ────────────────────────────────────────────────────────────
function SupplementModal({ mode, initial, onClose, onSaved }: { mode: 'add' | 'edit'; initial?: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    category: initial?.category ?? 'PROTEIN',
    brand: initial?.brand ?? '',
    price: initial?.price ?? '',
    stock: initial?.stock ?? '',
    unit: initial?.unit ?? 'kg',
    isActive: initial?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.stock) {
      toast.error('Name, price and stock are required');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
      if (mode === 'add') {
        await supplementsApi.create(payload);
        toast.success('Supplement added!');
      } else {
        await supplementsApi.update(initial.id, payload);
        toast.success('Supplement updated!');
      }
      onSaved();
      onClose();
    } catch { } finally { setSaving(false); }
  };

  const inputCls = 'form-input';
  const labelCls = 'form-label';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl w-full max-w-[520px] shadow-lifted max-h-[90vh] overflow-hidden flex flex-col animate-pop">
        <div className="px-7 py-5 border-b border-border flex justify-between items-center shrink-0">
          <h2 className="font-extrabold text-xl">{mode === 'add' ? 'Add Supplement' : 'Edit Supplement'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 overflow-y-auto flex flex-col gap-3.5">
          <div>
            <label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Whey Protein Gold" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select className={cn(inputCls, 'cursor-pointer bg-card')} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Brand</label>
              <input className={inputCls} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. MuscleBlaze" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Price (₹) *</label>
              <input className={inputCls} type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="2499" />
            </div>
            <div>
              <label className={labelCls}>Stock *</label>
              <input className={inputCls} type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="50" />
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <select className={cn(inputCls, 'cursor-pointer bg-card')} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {['kg', 'g', 'lbs', 'capsules', 'tablets', 'ml', 'pieces'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea className="form-input h-20 py-2.5 resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Product description…" />
          </div>

          <div className="flex items-center gap-2.5">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 cursor-pointer accent-primary" />
            <label htmlFor="isActive" className="text-sm font-semibold cursor-pointer">Active (visible to members)</label>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-[2] h-11 rounded-xl gradient-brand shadow-brand text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? 'Saving…' : mode === 'add' ? 'Add Supplement' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SupplementsPage() {
  const [supplements, setSupplements] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; item?: any } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const limit = 10;

  const fetchSupplements = async () => {
    setLoading(true);
    try {
      const res: any = await supplementsApi.getAll({ page, limit, search: search || undefined, category: filterCat || undefined });
      setSupplements(res.data ?? res ?? []);
      setTotal(res.total ?? (res.data ?? res ?? []).length);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchSupplements(); }, [search, filterCat, page]);

  const toggleActive = async (item: any) => {
    try {
      await supplementsApi.update(item.id, { isActive: !item.isActive });
      toast.success(item.isActive ? 'Hidden from members' : 'Now visible to members');
      fetchSupplements();
    } catch { }
    setOpenMenu(null);
  };

  const totalPages = Math.ceil(total / limit);
  const lowStock = supplements.filter(s => s.stock <= 10).length;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Supplements</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total} products
            {lowStock > 0 && <span className="text-destructive ml-2">· {lowStock} low stock</span>}
          </p>
        </div>
        <button onClick={() => setModal({ mode: 'add' })}
          className="flex items-center gap-2 gradient-brand shadow-brand text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" /> Add Supplement
        </button>
      </div>

      {lowStock > 0 && (
        <div className="flex items-center gap-2.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-xl px-4 py-3 text-orange-700 dark:text-orange-400 text-[13px] font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {lowStock} supplement(s) are running low on stock (≤10 units)
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="search-bar-wrap flex-1 min-w-[200px] max-w-[320px]">
          <Search className="search-icon" />
          <input className="search-bar" placeholder="Search supplements…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select
          className="h-[42px] rounded-xl border-[1.5px] border-border px-3.5 text-[13px] bg-card outline-none cursor-pointer focus:border-primary transition-colors"
          value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="auto-fill-240">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-border h-[180px] shimmer-bg" />
          ))}
        </div>
      ) : supplements.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border/60 p-16 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No supplements found</p>
        </div>
      ) : (
        <div className="auto-fill-240">
          {supplements.map((item: any) => (
            <div key={item.id}
              className={cn(
                'bg-card rounded-2xl border p-5 relative transition-shadow hover:shadow-card',
                item.isActive ? 'border-border/60' : 'border-border opacity-60',
              )}>
              {!item.isActive && (
                <div className="absolute top-3 left-3 text-[10px] font-bold bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">HIDDEN</div>
              )}
              <div className="absolute top-3 right-3">
                <button onClick={() => setOpenMenu(openMenu === item.id ? null : item.id)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <MoreVertical className="w-[15px] h-[15px]" />
                </button>
                {openMenu === item.id && (
                  <div className="absolute right-0 top-full bg-card rounded-xl border border-border shadow-lifted z-10 min-w-[140px] overflow-hidden animate-slide-down">
                    <button onClick={() => { setModal({ mode: 'edit', item }); setOpenMenu(null); }}
                      className="w-full px-3.5 py-2.5 text-left bg-transparent border-0 text-[13px] cursor-pointer flex items-center gap-2 hover:bg-muted transition-colors">
                      <Edit2 className="w-[13px] h-[13px]" /> Edit
                    </button>
                    <button onClick={() => toggleActive(item)}
                      className={cn(
                        'w-full px-3.5 py-2.5 text-left bg-transparent border-0 text-[13px] cursor-pointer flex items-center gap-2 hover:bg-muted transition-colors',
                        item.isActive ? 'text-destructive' : 'text-emerald-600',
                      )}>
                      {item.isActive ? <><EyeOff className="w-[13px] h-[13px]" /> Hide</> : <><Eye className="w-[13px] h-[13px]" /> Show</>}
                    </button>
                  </div>
                )}
              </div>

              <div className="w-11 h-11 rounded-xl gradient-brand flex items-center justify-center text-xl mb-3">💊</div>
              <p className="font-bold text-[15px] mb-0.5">{item.name}</p>
              {item.brand && <p className="text-xs text-muted-foreground mb-2.5">{item.brand}</p>}
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-base text-primary">₹{item.price?.toLocaleString('en-IN')}</span>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-lg',
                  item.stock <= 10 ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
                )}>
                  {item.stock} {item.unit ?? 'units'}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md inline-block">
                {item.category?.replace('_', ' ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
        </div>
      )}

      {modal && <SupplementModal mode={modal.mode} initial={modal.item} onClose={() => setModal(null)} onSaved={fetchSupplements} />}
      {openMenu && <div className="fixed inset-0 z-[9]" onClick={() => setOpenMenu(null)} />}
    </div>
  );
}
