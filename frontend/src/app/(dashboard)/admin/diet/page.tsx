'use client';

import { useEffect, useState } from 'react';
import { Utensils, Plus, X, Save, Trash2, Pencil, Flame, Tag, ShoppingBag } from 'lucide-react';
import { dietPlansApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const inp = 'w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all';

function PackageModal({ pkg, onClose, onSuccess }: any) {
  const isEdit = !!pkg;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: pkg?.name ?? '',
    goal: pkg?.goal ?? 'Weight Loss',
    description: pkg?.description ?? '',
    price: pkg?.price ?? 0,
    durationDays: pkg?.durationDays ?? 30,
    totalCalories: pkg?.totalCalories ?? '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    if (!form.price || form.price <= 0) { toast.error('Price must be > 0'); return; }
    setSaving(true);
    try {
      const data = { ...form, price: +form.price, durationDays: +form.durationDays, totalCalories: form.totalCalories ? +form.totalCalories : null, meals: [] };
      if (isEdit) await dietPlansApi.updatePackage(pkg.id, data);
      else await dietPlansApi.createPackage(data);
      toast.success(isEdit ? 'Package updated' : 'Package created');
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md animate-pop overflow-hidden">
        <div className={`${isEdit ? 'gradient-teal' : 'gradient-purple'} p-5 relative overflow-hidden`}>
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none"/>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center"><ShoppingBag className="w-5 h-5 text-white"/></div>
              <div><h2 className="font-extrabold text-xl text-white">{isEdit ? 'Edit Package' : 'New Package'}</h2><p className="text-sm text-white/70">{isEdit ? `Editing ${pkg.name}` : 'Create premium diet plan'}</p></div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><X className="w-4 h-4"/></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Package Name *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Weight Loss Pro" className={inp}/></div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Goal</label>
            <select value={form.goal} onChange={e=>set('goal',e.target.value)} className={inp+' appearance-none cursor-pointer'}>
              {['Weight Loss','Muscle Gain','Maintenance','Endurance','Lean Bulk'].map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={2} placeholder="Brief description of this plan…" className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 resize-none transition-all"/></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Price (₹) *</label><input type="number" min="1" value={form.price} onChange={e=>set('price',e.target.value)} className={inp}/></div>
            <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Days</label><input type="number" min="1" value={form.durationDays} onChange={e=>set('durationDays',e.target.value)} className={inp}/></div>
            <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Calories/day</label><input type="number" min="0" value={form.totalCalories} onChange={e=>set('totalCalories',e.target.value)} placeholder="Optional" className={inp}/></div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className={cn('flex-[2] py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60', isEdit?'gradient-teal':'gradient-purple')}>
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Save className="w-4 h-4"/>}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Package'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDietPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editPkg, setEditPkg] = useState<any>(null);

  const fetch = () => {
    setLoading(true);
    dietPlansApi.getPackages().then((r: any) => setPackages(Array.isArray(r) ? r : r.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, []);

  return (
    <div className="space-y-6 animate-slide-up">
      {showAdd && <PackageModal onClose={()=>setShowAdd(false)} onSuccess={fetch}/>}
      {editPkg && <PackageModal pkg={editPkg} onClose={()=>setEditPkg(null)} onSuccess={fetch}/>}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Premium Diet Plans</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create sellable diet packages for members</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-purple text-white font-bold text-sm hover:opacity-90 transition-all">
          <Plus className="w-4 h-4"/>Create Package
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({length:3}).map((_,i)=><div key={i} className="h-52 shimmer-bg rounded-2xl"/>)}
        </div>
      ) : packages.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20"/>
          <p className="font-semibold text-lg">No premium diet packages</p>
          <p className="text-sm mt-1">Create packages for members to purchase and follow</p>
          <button onClick={()=>setShowAdd(true)} className="mt-4 px-5 py-2.5 rounded-xl gradient-purple text-white font-bold text-sm hover:opacity-90">Create First Package</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {packages.map((pkg: any) => (
            <div key={pkg.id} className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:shadow-lifted hover:-translate-y-1 transition-all duration-300">
              <div className="gradient-purple p-5 relative overflow-hidden">
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10 pointer-events-none"/>
                <div className="relative">
                  <p className="text-white font-extrabold text-lg">{pkg.name}</p>
                  <p className="text-white/70 text-xs mt-0.5">{pkg.goal} · {pkg.durationDays ?? 30} days</p>
                  <p className="text-2xl font-extrabold text-white mt-2">₹{pkg.price?.toLocaleString()}</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {pkg.description && <p className="text-sm text-muted-foreground line-clamp-2">{pkg.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {pkg.totalCalories && (
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 rounded-lg">
                      <Flame className="w-3 h-3"/>{pkg.totalCalories} kcal/day
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs px-2.5 py-1 bg-muted rounded-lg">
                    <Tag className="w-3 h-3"/>{pkg.goal}
                  </span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={()=>setEditPkg(pkg)} className="flex-1 py-2 text-xs font-bold rounded-xl gradient-teal text-white hover:opacity-90 flex items-center justify-center gap-1">
                    <Pencil className="w-3 h-3"/>Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
