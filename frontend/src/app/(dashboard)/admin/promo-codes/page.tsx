'use client';

import { useEffect, useState } from 'react';
import { promoCodesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Plus, Tag, Trash2, X, Loader2, ToggleLeft, ToggleRight, Percent, IndianRupee } from 'lucide-react';

function CreatePromoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);

  const [form, setForm] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    maxUses: '',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: nextMonth.toISOString().split('T')[0],
    description: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const autoGenCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '23456789';
    const code = Array.from({ length: 6 }, (_, i) =>
      i % 2 === 0 ? chars[Math.floor(Math.random() * chars.length)] : nums[Math.floor(Math.random() * nums.length)]
    ).join('');
    setForm(f => ({ ...f, code }));
  };

  const save = async () => {
    if (!form.code || !form.discountValue || !form.validFrom || !form.validTo) {
      toast.error('Fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      await promoCodesApi.create({
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        validFrom: form.validFrom,
        validTo: form.validTo,
        description: form.description || undefined,
        isActive: form.isActive,
      });
      toast.success('Promo code created!');
      onSaved();
      onClose();
    } catch { }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl animate-zoom-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-bold text-lg">Create Promo Code</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Code */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Promo Code *</label>
            <div className="flex gap-2">
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. SAVE20"
                maxLength={20}
                className="flex-1 border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30 uppercase font-mono"
              />
              <button onClick={autoGenCode} className="px-3 py-2 text-xs border border-border rounded-xl hover:bg-muted/50 font-medium">Auto</button>
            </div>
          </div>

          {/* Discount Type */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Discount Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'PERCENTAGE', label: '% Percentage', icon: Percent },
                { value: 'FIXED', label: '₹ Fixed Amount', icon: IndianRupee },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setForm(f => ({ ...f, discountType: value }))}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    form.discountType === value ? 'border-brand bg-brand/10 text-brand' : 'border-border hover:bg-muted/50'
                  )}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Discount Value */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
              Discount Value * {form.discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}
            </label>
            <input
              type="number"
              min={0}
              max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
              value={form.discountValue}
              onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
              placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 500'}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {/* Max Uses */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Max Uses (leave blank for unlimited)</label>
            <input
              type="number"
              min={1}
              value={form.maxUses}
              onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
              placeholder="e.g. 100"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Valid From *', key: 'validFrom' },
              { label: 'Valid To *',   key: 'validTo' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">{label}</label>
                <input
                  type="date"
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Description (optional)</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. New Year 2026 special"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted/50">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 text-sm gradient-brand text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Code
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data: any = await promoCodesApi.getAll();
      setCodes(data ?? []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (code: any) => {
    setToggling(code.id);
    try {
      await promoCodesApi.update(code.id, { isActive: !code.isActive });
      setCodes(prev => prev.map(c => c.id === code.id ? { ...c, isActive: !c.isActive } : c));
    } catch { }
    finally { setToggling(null); }
  };

  const deleteCode = async (id: string) => {
    if (!confirm('Delete this promo code?')) return;
    try {
      await promoCodesApi.remove(id);
      setCodes(prev => prev.filter(c => c.id !== id));
      toast.success('Deleted');
    } catch { }
  };

  const isExpired = (code: any) => new Date(code.validTo) < new Date();
  const isNotStarted = (code: any) => new Date(code.validFrom) > new Date();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Tag className="w-6 h-6 text-brand" /> Promo Codes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Create discount codes to boost membership sign-ups</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 gradient-brand text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-brand"
        >
          <Plus className="w-4 h-4" /> New Code
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
      ) : codes.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-bold">No promo codes yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first code to offer discounts</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {['Code', 'Discount', 'Uses', 'Valid Period', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {codes.map((code: any) => {
                  const expired = isExpired(code);
                  const notStarted = isNotStarted(code);
                  return (
                    <tr key={code.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-sm bg-muted px-2 py-1 rounded-lg">{code.code}</span>
                        {code.description && <p className="text-xs text-muted-foreground mt-0.5">{code.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold">
                          {code.discountType === 'PERCENTAGE' ? `${code.discountValue}%` : `₹${code.discountValue}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {code.usedCount}{code.maxUses ? `/${code.maxUses}` : ' / ∞'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(code.validFrom).toLocaleDateString('en-IN')} –{' '}
                        {new Date(code.validTo).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                          expired ? 'bg-red-100 text-red-700' :
                          notStarted ? 'bg-blue-100 text-blue-700' :
                          code.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        )}>
                          {expired ? 'Expired' : notStarted ? 'Scheduled' : code.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!expired && (
                            <button
                              onClick={() => toggleActive(code)}
                              disabled={toggling === code.id}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title={code.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {toggling === code.id ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : code.isActive ? (
                                <ToggleRight className="w-5 h-5 text-brand" />
                              ) : (
                                <ToggleLeft className="w-5 h-5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => deleteCode(code.id)}
                            className="text-muted-foreground hover:text-red-600 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
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
      )}

      {showCreate && <CreatePromoModal onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}
