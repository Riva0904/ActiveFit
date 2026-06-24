'use client';

import { useEffect, useState } from 'react';
import {
  Receipt, Plus, Search, Pencil, Trash2, X, Loader2,
  Zap, TrendingDown, Calendar,
  Banknote, Droplets, Building2, Wrench,
  Wifi, Megaphone, MoreHorizontal, Users, Brush,
} from 'lucide-react';
import { expensesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { FeatureGate } from '@/components/shared/FeatureGate';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { value: 'TRAINER_SALARY',       label: 'Trainer Salary',        icon: Users,        color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-800/50',    grad: 'from-blue-500 to-blue-700' },
  { value: 'CLEANER_SALARY',       label: 'Cleaner Salary',        icon: Brush,        color: 'text-teal-700 dark:text-teal-400',    bg: 'bg-teal-50 dark:bg-teal-900/20',    border: 'border-teal-200 dark:border-teal-800/50',    grad: 'from-teal-500 to-teal-700' },
  { value: 'ELECTRICITY',          label: 'Electricity Bill',      icon: Zap,          color: 'text-yellow-700 dark:text-yellow-400',bg: 'bg-yellow-50 dark:bg-yellow-900/20',border: 'border-yellow-200 dark:border-yellow-800/50', grad: 'from-yellow-400 to-amber-500' },
  { value: 'WATER',                label: 'Water Bill',            icon: Droplets,     color: 'text-cyan-700 dark:text-cyan-400',    bg: 'bg-cyan-50 dark:bg-cyan-900/20',    border: 'border-cyan-200 dark:border-cyan-800/50',    grad: 'from-cyan-500 to-sky-600' },
  { value: 'RENT',                 label: 'Rent',                  icon: Building2,    color: 'text-orange-700 dark:text-orange-400',bg: 'bg-orange-50 dark:bg-orange-900/20',border: 'border-orange-200 dark:border-orange-800/50', grad: 'from-orange-500 to-red-500' },
  { value: 'EQUIPMENT_MAINTENANCE',label: 'Equipment Maintenance', icon: Wrench,       color: 'text-purple-700 dark:text-purple-400',bg: 'bg-purple-50 dark:bg-purple-900/20',border: 'border-purple-200 dark:border-purple-800/50', grad: 'from-purple-500 to-violet-600' },
  { value: 'INTERNET',             label: 'Internet',              icon: Wifi,         color: 'text-indigo-700 dark:text-indigo-400',bg: 'bg-indigo-50 dark:bg-indigo-900/20',border: 'border-indigo-200 dark:border-indigo-800/50', grad: 'from-indigo-500 to-blue-600' },
  { value: 'MARKETING',            label: 'Marketing',             icon: Megaphone,    color: 'text-pink-700 dark:text-pink-400',    bg: 'bg-pink-50 dark:bg-pink-900/20',    border: 'border-pink-200 dark:border-pink-800/50',    grad: 'from-pink-500 to-rose-600' },
  { value: 'OTHER',                label: 'Other',                 icon: MoreHorizontal,color:'text-slate-700 dark:text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-900/20',  border: 'border-slate-200 dark:border-slate-800/50',  grad: 'from-slate-500 to-slate-600' },
];

const getCatMeta = (value: string) => CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
const now = new Date();

interface Expense {
  id: string; title: string; amount: number; category: string;
  description?: string; date: string; month: number; year: number;
}
interface FormState {
  title: string; amount: string; category: string; description: string; date: string;
}
const emptyForm: FormState = {
  title: '', amount: '', category: 'OTHER', description: '',
  date: new Date().toISOString().split('T')[0],
};

export default function ExpensesPage() {
  const { info: subInfo, loading: subLoading } = useSubscription();
  const [expenses, setExpenses]   = useState<Expense[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [month, setMonth]         = useState(now.getMonth() + 1);
  const [year, setYear]           = useState(now.getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Expense | null>(null);
  const [form, setForm]           = useState<FormState>(emptyForm);
  const [deleting, setDeleting]   = useState<string | null>(null);

  const isFreePlan = subInfo?.isFreePlan ?? false;

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await expensesApi.getAll({ month, year, category: catFilter || undefined });
      setExpenses(res.data ?? []);
    } catch { setExpenses([]); } finally { setLoading(false); }
  };

  useEffect(() => { if (!subLoading && !isFreePlan) load(); }, [month, year, catFilter, subLoading]);

  const filtered = expenses.filter(e =>
    !search || e.title.toLowerCase().includes(search.toLowerCase()) || (e.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalMonth = filtered.reduce((sum, e) => sum + e.amount, 0);
  const catTotals = CATEGORIES.map(cat => ({
    ...cat,
    total: filtered.filter(e => e.category === cat.value).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const topTotal = catTotals[0]?.total ?? 1;

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({ title: e.title, amount: String(e.amount), category: e.category, description: e.description ?? '', date: e.date.split('T')[0] });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.date) { toast.error('Fill in all required fields'); return; }
    setSaving(true);
    try {
      const payload = { title: form.title, amount: +form.amount, category: form.category, description: form.description || undefined, date: form.date };
      if (editing) {
        await expensesApi.update(editing.id, payload);
        toast.success('Expense updated');
      } else {
        await expensesApi.create(payload);
        toast.success('Expense added');
      }
      setShowModal(false);
      load();
    } catch { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try { await expensesApi.remove(id); toast.success('Expense deleted'); load(); }
    catch {} finally { setDeleting(null); }
  };

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  if (!subLoading && isFreePlan) {
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center shadow-brand">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">Expense Management</h1>
            <p className="text-sm text-muted-foreground">Track and manage gym expenses</p>
          </div>
        </div>
        <FeatureGate locked featureName="Expense Management">{null}</FeatureGate>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center shadow-brand">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Expense Management</h1>
            <p className="text-sm text-muted-foreground">Track salaries, bills, and all gym costs</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 gradient-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-brand"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* ─── Month/Year + Total ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-2 flex gap-3">
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="flex-1 bg-card border border-border/60 rounded-xl px-4 py-2.5 text-sm font-medium outline-none input-glow transition-all">
            {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="w-28 bg-card border border-border/60 rounded-xl px-4 py-2.5 text-sm font-medium outline-none input-glow transition-all">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Total card */}
        <div className="xl:col-span-2 relative bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-4 overflow-hidden stat-highlight animate-slide-up">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-rose-500 to-red-600 opacity-10 rounded-full -translate-y-4 translate-x-4" />
          <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground font-medium">Total Expenses — {months[month - 1]} {year}</p>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{formatCurrency(totalMonth)}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">{filtered.length} entries</p>
            <p className="text-xs font-bold text-rose-500 mt-0.5">
              {loading ? '…' : catTotals.length > 0 ? `${catTotals.length} categories` : 'No data'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Category Breakdown ─── */}
      {catTotals.length > 0 && (
        <div className="bg-card border border-border/60 rounded-2xl p-5 animate-slide-up">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {catTotals.map((cat, i) => {
              const CatIcon = cat.icon;
              const pct = Math.round((cat.total / totalMonth) * 100);
              return (
                <button
                  key={cat.value}
                  onClick={() => setCatFilter(catFilter === cat.value ? '' : cat.value)}
                  className={cn('w-full text-left transition-all rounded-xl p-3 border stagger-delay',
                    catFilter === cat.value ? `${cat.border} ${cat.bg}` : 'border-transparent hover:bg-muted/40')}
                  style={{ '--delay': `${i * 50}ms` } as React.CSSProperties}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cat.grad} flex items-center justify-center shrink-0`}>
                      <CatIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-bold ${cat.color}`}>{cat.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                          <span className="text-sm font-extrabold">{formatCurrency(cat.total)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${cat.grad} progress-fill`}
                          style={{ '--progress-width': `${(cat.total / topTotal) * 100}%` } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Search + Filter ─── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..."
            className="w-full pl-9 pr-4 py-2.5 bg-card border border-border/60 rounded-xl text-sm outline-none input-glow transition-all" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="bg-card border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none input-glow transition-all">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {catFilter && (
          <button onClick={() => setCatFilter('')}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-card text-xs font-bold text-muted-foreground hover:bg-muted transition-all">
            <X className="w-3.5 h-3.5" /> Clear Filter
          </button>
        )}
      </div>

      {/* ─── Table ─── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide">Date</th>
                <th className="text-right px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide">Amount</th>
                <th className="text-center px-4 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 w-40 shimmer-card" /></td>
                    <td className="px-4 py-4"><div className="h-6 w-28 shimmer-card rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-20 shimmer-card" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-16 shimmer-card ml-auto" /></td>
                    <td className="px-4 py-4"><div className="h-7 w-16 shimmer-card rounded-lg mx-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Receipt className="w-7 h-7 text-muted-foreground/30" />
                    </div>
                    <p className="font-bold text-muted-foreground">No expenses found</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">Add your first expense for {months[month - 1]} {year}</p>
                    <button onClick={openAdd}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-brand text-white font-bold text-xs shadow-brand hover:opacity-90 transition-all">
                      <Plus className="w-3.5 h-3.5" /> Add Expense
                    </button>
                  </td>
                </tr>
              ) : filtered.map((e, i) => {
                const cat = getCatMeta(e.category);
                const CatIcon = cat.icon;
                return (
                  <tr key={e.id}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors animate-slide-up group stagger-delay"
                    style={{ '--delay': `${i * 35}ms` } as React.CSSProperties}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cat.grad} flex items-center justify-center shrink-0`}>
                          <CatIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">{e.title}</p>
                          {e.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{e.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border ${cat.color} ${cat.bg} ${cat.border}`}>
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">{formatCurrency(e.amount)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(e)}
                          className="w-8 h-8 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          disabled={deleting === e.id}
                          className="w-8 h-8 rounded-lg bg-muted hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add/Edit Modal ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowModal(false)} />
          <div className="relative bg-card border border-border rounded-3xl shadow-lifted w-full max-w-md max-h-[90vh] overflow-y-auto animate-zoom-in">
            {/* Header */}
            {(() => {
              const catMeta = getCatMeta(form.category);
              const CatIconH = catMeta.icon;
              return (
                <div className={`bg-gradient-to-r ${catMeta.grad} p-6 rounded-t-3xl relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/10" />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <CatIconH className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold text-white">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
                        <p className="text-sm text-white/70">{catMeta.label}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowModal(false)} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Title <span className="text-rose-500">*</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. March electricity bill"
                  className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none input-glow transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Amount (₹) <span className="text-rose-500">*</span></label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0" min={0}
                    className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none input-glow transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Date <span className="text-rose-500">*</span></label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none input-glow transition-all" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none input-glow transition-all">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional notes..." rows={2}
                  className="w-full bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm outline-none input-glow transition-all resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl gradient-brand text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {editing ? 'Update' : 'Add Expense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
