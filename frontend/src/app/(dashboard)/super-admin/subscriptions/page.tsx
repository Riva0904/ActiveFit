'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Search, Users, Pencil, X, Plus, Trash2, TrendingUp, DollarSign, BarChart2, Percent } from 'lucide-react';
import { gymsApi, saasPlansApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

const planBadge: Record<string, string> = {
  STARTER:      'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-400',
  PROFESSIONAL: 'bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/30 dark:text-orange-400',
  ENTERPRISE:   'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/30 dark:text-violet-400',
};

const planPriceColor: Record<string, string> = {
  STARTER: 'text-slate-500',
  PROFESSIONAL: 'text-primary',
  ENTERPRISE: 'text-violet-600',
};

const planIcon: Record<string, string> = {
  STARTER: '🥉',
  PROFESSIONAL: '🥈',
  ENTERPRISE: '🥇',
};

const planAccent: Record<string, string> = {
  STARTER:      'border-l-slate-400',
  PROFESSIONAL: 'border-l-orange-400',
  ENTERPRISE:   'border-l-violet-500',
};

type SaasPlan = {
  id: string;
  name: string;
  plan: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxMembers: number;
  maxTrainers: number;
  maxStaff: number;
  maxBranches: number;
  features: string[];
  razorpayPlanId?: string;
  isActive: boolean;
  commissionPct: number;
};

export default function SubscriptionsPage() {
  const [gyms, setGyms] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState<string | null>(null);
  const limit = 10;

  const [saasPlans, setSaasPlans] = useState<SaasPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
  const [editForm, setEditForm] = useState<Partial<SaasPlan>>({});
  const [featureInput, setFeatureInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [revenue, setRevenue] = useState<any>(null);

  const fetchGyms = async () => {
    setLoading(true);
    try {
      const res: any = await gymsApi.getAll({ page, limit, search: search || undefined });
      let data = res.data ?? [];
      if (filterPlan) data = data.filter((g: any) => g.subscriptionPlan === filterPlan);
      setGyms(data);
      setTotal(res.total ?? 0);
    } catch { } finally { setLoading(false); }
  };

  const fetchPlans = async () => {
    setPlansLoading(true);
    setPlansError(false);
    try {
      const data: any = await saasPlansApi.getAll();
      setSaasPlans(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setPlansError(true);
    } finally {
      setPlansLoading(false);
    }
  };

  const initPlans = async () => {
    setInitializing(true);
    try {
      const data: any = await saasPlansApi.init();
      setSaasPlans(Array.isArray(data) ? data : data.data ?? []);
      toast.success('Plans initialized successfully');
    } catch {
      toast.error('Failed to initialize plans');
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => { fetchGyms(); }, [search, filterPlan, page]);
  useEffect(() => { fetchPlans(); }, []);
  useEffect(() => { saasPlansApi.getRevenue().then((r: any) => setRevenue(r)).catch(() => {}); }, []);

  const changePlan = async (gymId: string, plan: string) => {
    setUpdating(gymId);
    try {
      await gymsApi.update(gymId, { saasPlan: plan });
      toast.success(`Plan updated to ${plan}`);
      fetchGyms();
    } catch { } finally { setUpdating(null); }
  };

  const openEdit = (plan: SaasPlan) => {
    setEditingPlan(plan);
    setEditForm({ ...plan });
    setFeatureInput('');
  };

  const closeEdit = () => {
    setEditingPlan(null);
    setEditForm({});
  };

  const addFeature = () => {
    const f = featureInput.trim();
    if (!f) return;
    setEditForm(prev => ({ ...prev, features: [...(prev.features ?? []), f] }));
    setFeatureInput('');
  };

  const removeFeature = (idx: number) => {
    setEditForm(prev => ({ ...prev, features: (prev.features ?? []).filter((_, i) => i !== idx) }));
  };

  const saveEdit = async () => {
    if (!editingPlan) return;
    setSaving(true);
    try {
      await saasPlansApi.update(editingPlan.id, {
        monthlyPrice: Number(editForm.monthlyPrice),
        yearlyPrice: Number(editForm.yearlyPrice),
        maxMembers: Number(editForm.maxMembers),
        maxTrainers: Number(editForm.maxTrainers),
        maxStaff: Number(editForm.maxStaff),
        maxBranches: Number(editForm.maxBranches),
        features: editForm.features ?? [],
        razorpayPlanId: editForm.razorpayPlanId || null,
        isActive: editForm.isActive,
        commissionPct: Number(editForm.commissionPct ?? 0),
      });
      toast.success('Plan updated successfully');
      closeEdit();
      fetchPlans();
    } catch { } finally { setSaving(false); }
  };

  const getPlan = (key: string) => saasPlans.find(p => p.plan === key);

  const stats = [
    { label: 'Starter gyms', key: 'STARTER' },
    { label: 'Professional gyms', key: 'PROFESSIONAL' },
    { label: 'Enterprise gyms', key: 'ENTERPRISE' },
  ];

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Subscriptions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage gym subscription plans across the platform</p>
      </div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, key }) => {
          const count = gyms.filter(g => g.subscriptionPlan === key).length;
          const p = getPlan(key);
          return (
            <div key={key} className="bg-card rounded-2xl border border-border/60 shadow-card p-5 flex items-center gap-4">
              <span className="text-[28px]">{planIcon[key]}</span>
              <div>
                <p className="text-2xl font-extrabold">{count}</p>
                <p className="text-sm text-muted-foreground font-medium">{label}</p>
                <p className={cn('text-xs font-semibold', planPriceColor[key])}>
                  {p ? `₹${p.monthlyPrice.toLocaleString()}/mo` : '—'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Platform Revenue */}
      {revenue && (
        <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
          <div className="px-6 py-5 border-b border-border/60 flex items-center gap-3">
            <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center"><DollarSign className="w-4 h-4 text-white"/></div>
            <div><h2 className="font-bold text-base">Platform Revenue</h2><p className="text-xs text-muted-foreground">Commission earned from gym transactions</p></div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'This Month', value: revenue.thisMonth, icon: TrendingUp, color: 'text-emerald-600' },
                { label: 'This Year', value: revenue.thisYear, icon: BarChart2, color: 'text-blue-600' },
                { label: 'All Time', value: revenue.allTime, icon: DollarSign, color: 'text-purple-600' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-muted/40 rounded-xl p-4 text-center">
                  <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`}/>
                  <p className={`text-xl font-extrabold ${color}`}>₹{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {revenue.tierBreakdown?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Tier</p>
                {revenue.tierBreakdown.map((t: any) => (
                  <div key={t.tier} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{planIcon[t.tier] ?? '🏢'}</span>
                      <div><p className="font-semibold text-sm">{t.name}</p><p className="text-xs text-muted-foreground">{t.gymCount} gym{t.gymCount !== 1 ? 's' : ''} · {t.commissionPct}% commission</p></div>
                    </div>
                    <p className="font-extrabold text-sm">₹{t.totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1 Plan Configuration Card */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Plan Configuration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Edit pricing, limits and features for each plan</p>
          </div>
        </div>

        {/* Loading skeleton */}
        {plansLoading && (
          <div className="divide-y divide-border/50">
            {PLANS.map(key => (
              <div key={key} className={cn('border-l-4 px-6 py-6 space-y-3', planAccent[key])}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted shimmer-bg" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded shimmer-bg" />
                    <div className="h-5 w-16 bg-muted rounded shimmer-bg" />
                  </div>
                  <div className="flex gap-2 ml-8">
                    {[72, 72, 72, 72].map((w, i) => <div key={i} className="h-14 rounded-xl bg-muted shimmer-bg" style={{ width: w }} />)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error / not initialized state */}
        {!plansLoading && (plansError || saasPlans.length === 0) && (
          <div className="px-6 py-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {plansError ? 'Could not load plans — make sure the backend is running.' : 'Plans have not been initialized yet.'}
            </p>
            <button
              onClick={plansError ? fetchPlans : initPlans}
              disabled={initializing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {initializing ? 'Initializing…' : plansError ? 'Retry' : 'Initialize Default Plans'}
            </button>
          </div>
        )}

        {/* Plan rows */}
        {!plansLoading && !plansError && saasPlans.length > 0 && (
          <div className="divide-y divide-border/50">
            {PLANS.map(key => {
              const p = getPlan(key);
              if (!p) return null;
              return (
                <div key={key} className={cn('border-l-4 px-6 py-6', planAccent[key])}>
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: identity + pricing */}
                    <div className="flex items-center gap-4 min-w-[190px]">
                      <span className="text-3xl">{planIcon[key]}</span>
                      <div>
                        <p className="font-extrabold text-base leading-tight">{p.name}</p>
                        <p className={cn('text-xl font-extrabold leading-tight mt-0.5', planPriceColor[key])}>
                          ₹{p.monthlyPrice.toLocaleString()}
                          <span className="text-xs font-medium text-muted-foreground ml-1">/mo</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">₹{p.yearlyPrice.toLocaleString()}/yr</p>
                      </div>
                    </div>

                    {/* Center: limit stat boxes */}
                    <div className="flex flex-wrap gap-2 flex-1">
                      {[
                        { label: 'Members', value: p.maxMembers },
                        { label: 'Trainers', value: p.maxTrainers },
                        { label: 'Staff', value: p.maxStaff },
                        { label: 'Branches', value: p.maxBranches },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-muted/60 rounded-xl px-4 py-2.5 text-center min-w-[72px]">
                          <p className="text-base font-extrabold leading-none">{value}</p>
                          <p className="text-[11px] text-muted-foreground mt-1 font-medium">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Right: status + edit */}
                    <div className="flex flex-col items-end gap-2.5 shrink-0">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border border-border bg-muted hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit Plan
                      </button>
                      <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',
                        p.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                      )}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {p.features.length > 0 && (
                        <span className="text-xs text-muted-foreground">{p.features.length} features</span>
                      )}
                    </div>
                  </div>

                  {/* Features pills */}
                  {p.features.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {p.features.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted/40 border border-border/50 rounded-full px-3 py-1">
                          <span className="text-emerald-500">✓</span> {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="search-bar-wrap flex-1 min-w-[200px] max-w-[340px]">
          <Search className="search-icon" />
          <input className="search-bar" placeholder="Search gyms…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setFilterPlan('')}
            className={cn('h-[42px] px-4 rounded-xl border-[1.5px] font-semibold text-[13px] cursor-pointer transition-colors',
              !filterPlan ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:bg-muted')}>
            All
          </button>
          {PLANS.map(p => (
            <button key={p} onClick={() => setFilterPlan(p === filterPlan ? '' : p)}
              className={cn('h-[42px] px-4 rounded-xl border-[1.5px] font-semibold text-[13px] cursor-pointer transition-colors',
                filterPlan === p ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:bg-muted')}>
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Gyms Table */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              {['Gym', 'Members', 'Current Plan', 'Status', 'Change Plan'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j}><div className={cn('h-3.5 bg-muted rounded-md shimmer-bg', j === 0 ? 'w-40' : 'w-20')} /></td>
                ))}
              </tr>
            )) : gyms.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>No gyms found</p>
                </td>
              </tr>
            ) : gyms.map((gym: any) => (
              <tr key={gym.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] gradient-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {gym.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{gym.name}</p>
                      <p className="text-xs text-muted-foreground">{gym.city}, {gym.state}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="text-[13px] flex items-center gap-1.5">
                    <Users className="w-[13px] h-[13px] text-muted-foreground" />
                    {gym._count?.members ?? 0} members
                  </span>
                </td>
                <td>
                  <span className={cn('text-xs font-bold px-3 py-1 rounded-full', planBadge[gym.subscriptionPlan] ?? planBadge.STARTER)}>
                    {gym.subscriptionPlan}
                  </span>
                </td>
                <td>
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full',
                    gym.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    gym.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400')}>
                    {gym.status}
                  </span>
                </td>
                <td>
                  <select
                    value={gym.subscriptionPlan}
                    disabled={updating === gym.id}
                    onChange={e => changePlan(gym.id, e.target.value)}
                    className="h-[34px] rounded-lg border-[1.5px] border-border px-2.5 text-[13px] bg-card outline-none cursor-pointer focus:border-primary transition-colors disabled:opacity-60">
                    {PLANS.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                  </select>
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

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border/60 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xl">{planIcon[editingPlan.plan]}</span>
                <h2 className="font-bold text-base">Edit {editingPlan.name} Plan</h2>
              </div>
              <button onClick={closeEdit} className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Pricing */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Monthly Price (₹)</label>
                    <input
                      type="number"
                      value={editForm.monthlyPrice ?? ''}
                      onChange={e => setEditForm(prev => ({ ...prev, monthlyPrice: +e.target.value }))}
                      className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Yearly Price (₹)</label>
                    <input
                      type="number"
                      value={editForm.yearlyPrice ?? ''}
                      onChange={e => setEditForm(prev => ({ ...prev, yearlyPrice: +e.target.value }))}
                      className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Limits</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['maxMembers', 'maxTrainers', 'maxStaff', 'maxBranches'] as const).map(field => (
                    <div key={field}>
                      <label className="block text-xs font-medium mb-1">{field.replace('max', 'Max ')}</label>
                      <input
                        type="number"
                        value={editForm[field] ?? ''}
                        onChange={e => setEditForm(prev => ({ ...prev, [field]: +e.target.value }))}
                        className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Features</p>
                <div className="space-y-1.5 mb-2">
                  {(editForm.features ?? []).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-emerald-500 text-xs">✓</span>
                      <span className="text-sm flex-1">{f}</span>
                      <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={featureInput}
                    onChange={e => setFeatureInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    placeholder="Add a feature…"
                    className="flex-1 h-9 rounded-lg border border-border px-3 text-sm bg-background outline-none focus:border-primary transition-colors"
                  />
                  <button
                    onClick={addFeature}
                    className="h-9 px-3 rounded-lg border border-border bg-muted hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Razorpay Plan ID */}
              <div>
                <label className="block text-xs font-medium mb-1">Razorpay Plan ID <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  value={editForm.razorpayPlanId ?? ''}
                  onChange={e => setEditForm(prev => ({ ...prev, razorpayPlanId: e.target.value }))}
                  placeholder="plan_XXXXXXXXXX"
                  className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Commission */}
              <div>
                <label className="block text-xs font-medium mb-1 flex items-center gap-1"><Percent className="w-3 h-3"/> Platform Commission (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={editForm.commissionPct ?? 0}
                  onChange={e => setEditForm(prev => ({ ...prev, commissionPct: +e.target.value }))}
                  className="w-full h-9 rounded-lg border border-border px-3 text-sm bg-background outline-none focus:border-primary transition-colors"
                  placeholder="e.g. 5 for 5%"
                />
                <p className="text-xs text-muted-foreground mt-0.5">% cut from each completed payment at gyms on this plan</p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Plan Active</span>
                <button
                  onClick={() => setEditForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors cursor-pointer',
                    editForm.isActive ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                    editForm.isActive ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-border/60">
              <button
                onClick={closeEdit}
                className="flex-1 h-10 rounded-xl border border-border font-semibold text-sm hover:bg-muted transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
