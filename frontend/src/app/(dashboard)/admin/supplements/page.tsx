'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Package, Plus, AlertTriangle, ShoppingBag, TrendingUp, Star,
  Search, X, Zap, Sparkles, RefreshCw, ChevronRight, Eye, Edit2,
  Dumbbell, FlaskConical, Leaf, Flame, Apple, Pill, Cpu, Trash2,
} from 'lucide-react';
import { supplementsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { StatsCard } from '@/components/shared/StatsCard';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const CATEGORIES = ['Protein', 'Performance', 'Recovery', 'Pre-Workout', 'Vitamins', 'Weight Gainer', 'BCAA', 'Other'];

const CATEGORY_META: Record<string, { color: string; bg: string; grad: string; icon: React.ElementType; emoji: string }> = {
  'Protein':       { color: 'text-blue-700 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-900/30',   grad: 'from-blue-500 to-blue-700',      icon: Dumbbell,    emoji: '💪' },
  'Performance':   { color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', grad: 'from-purple-500 to-purple-700', icon: Cpu,         emoji: '⚡' },
  'Recovery':      { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', grad: 'from-emerald-500 to-teal-600', icon: Leaf,       emoji: '🌿' },
  'Pre-Workout':   { color: 'text-rose-700 dark:text-rose-400',   bg: 'bg-rose-100 dark:bg-rose-900/30',   grad: 'from-rose-500 to-pink-600',      icon: Flame,       emoji: '🔥' },
  'Vitamins':      { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', grad: 'from-amber-400 to-orange-500',   icon: Apple,       emoji: '🍊' },
  'Weight Gainer': { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', grad: 'from-orange-500 to-red-500',  icon: TrendingUp,  emoji: '📈' },
  'BCAA':          { color: 'text-teal-700 dark:text-teal-400',   bg: 'bg-teal-100 dark:bg-teal-900/30',   grad: 'from-teal-500 to-cyan-500',      icon: FlaskConical, emoji: '🧪' },
  'Other':         { color: 'text-slate-700 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-900/30', grad: 'from-slate-500 to-slate-700',    icon: Pill,        emoji: '💊' },
};

const DEFAULT_SUPPLEMENTS = [
  { name: 'ON Gold Standard Whey', category: 'Protein', brand: 'Optimum Nutrition', price: 4999, discountPrice: 3999, stock: 50, description: "World's best-selling whey protein. 24g protein per serving.", weight: '2kg', isFeatured: true, images: ['https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&h=400&fit=crop&q=80'] },
  { name: 'Creatine Monohydrate', category: 'Performance', brand: 'MuscleBlaze', price: 999, discountPrice: 799, stock: 100, description: 'Pure creatine monohydrate for strength and power.', weight: '250g', isFeatured: false, images: ['https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop&q=80'] },
  { name: 'BCAA 2:1:1 Powder', category: 'BCAA', brand: 'Dymatize', price: 1799, discountPrice: 1399, stock: 75, description: 'Branched-chain amino acids for muscle recovery and growth.', weight: '300g', isFeatured: false, images: ['https://images.unsplash.com/photo-1544991875-5dc1b05f1571?w=400&h=400&fit=crop&q=80'] },
  { name: 'C4 Pre-Workout', category: 'Pre-Workout', brand: 'Cellucor', price: 2499, discountPrice: null, stock: 40, description: 'Explosive energy and endurance for intense workouts.', weight: '195g', isFeatured: true, images: ['https://images.unsplash.com/photo-1579722820648-2a743f82b89f?w=400&h=400&fit=crop&q=80'] },
  { name: 'Mass Gainer Pro', category: 'Weight Gainer', brand: 'MuscleTech', price: 3499, discountPrice: 2799, stock: 30, description: 'High-calorie formula for maximum muscle and weight gain.', weight: '3kg', isFeatured: false, images: ['https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=400&fit=crop&q=80'] },
  { name: 'Daily Multivitamin', category: 'Vitamins', brand: 'GNC', price: 799, discountPrice: 649, stock: 120, description: '23 essential vitamins and minerals for overall health.', weight: '60 tabs', isFeatured: false, images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop&q=80'] },
  { name: 'Omega-3 Fish Oil', category: 'Vitamins', brand: 'Now Foods', price: 699, discountPrice: null, stock: 85, description: 'High-potency omega-3 for heart and joint health.', weight: '90 caps', isFeatured: false, images: ['https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=400&fit=crop&q=80'] },
  { name: 'L-Glutamine', category: 'Recovery', brand: 'Labrada', price: 1299, discountPrice: 999, stock: 60, description: 'Essential amino acid for muscle recovery and immune support.', weight: '250g', isFeatured: false, images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop&q=80'] },
  { name: 'Casein Protein Night', category: 'Protein', brand: 'Dymatize Elite', price: 3999, discountPrice: 3299, stock: 25, description: 'Slow-release protein for overnight muscle recovery.', weight: '1.8kg', isFeatured: false, images: ['https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=400&fit=crop&q=80'] },
  { name: 'ZMA Sleep Support', category: 'Recovery', brand: 'Universal Nutrition', price: 899, discountPrice: null, stock: 45, description: 'Zinc, magnesium & B6 blend for recovery and deep sleep.', weight: '90 caps', isFeatured: false, images: ['https://images.unsplash.com/photo-1544991875-5dc1b05f1571?w=400&h=400&fit=crop&q=80'] },
  { name: 'Vitamin D3 + K2', category: 'Vitamins', brand: 'Sports Research', price: 599, discountPrice: 499, stock: 95, description: 'Synergistic vitamin D3 and K2 for bone and immune health.', weight: '60 caps', isFeatured: false, images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop&q=80'] },
  { name: 'Whey Isolate CFM', category: 'Protein', brand: 'Isopure', price: 5999, discountPrice: 4799, stock: 35, description: 'Ultra-pure whey isolate, 25g protein, 0g sugar, lactose-free.', weight: '1.5kg', isFeatured: true, images: ['https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&h=400&fit=crop&q=80'] },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const toPid = (id: string) => `PRD-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

/* ─── Add Product Modal ──────────────────────────────────────────────────── */
function AddProductModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [form, setForm] = useState({
    name: '', category: 'Protein', brand: '', price: '', discountPrice: '',
    stock: '', description: '', weight: '', isFeatured: false, imageUrl: '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.price || !form.stock) {
      toast.error('Name, price and stock are required');
      return;
    }
    setSaving(true);
    try {
      await supplementsApi.create({
        name: form.name,
        category: form.category,
        brand: form.brand || null,
        price: parseFloat(form.price),
        discountPrice: form.discountPrice ? parseFloat(form.discountPrice) : null,
        stock: parseInt(form.stock),
        description: form.description || null,
        weight: form.weight || null,
        isFeatured: form.isFeatured,
        isActive: true,
        images: form.imageUrl ? [form.imageUrl] : [],
      });
      toast.success(`${form.name} added to inventory!`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to add product');
    }
    setSaving(false);
  };

  const meta = CATEGORY_META[form.category] ?? CATEGORY_META['Other'];
  const CatIcon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-lifted w-full max-w-lg max-h-[92vh] flex flex-col animate-zoom-in">
        {/* Header */}
        <div className={`bg-gradient-to-r ${meta.grad} p-6 rounded-t-3xl shrink-0 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <CatIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-extrabold text-lg text-white">Add Product</h2>
                <p className="text-sm text-white/70">Add to supplement inventory</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Image URL */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Product Image URL</label>
            <div className="flex gap-2">
              <input
                value={form.imageUrl}
                onChange={e => { set('imageUrl', e.target.value); setImagePreview(e.target.value); }}
                placeholder="https://example.com/product.jpg"
                className="flex-1 h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all"
              />
              {imagePreview && (
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-border/60 shrink-0">
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" onError={() => setImagePreview('')} />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Product Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Whey Protein Gold Standard"
              className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Brand</label>
              <input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Optimum Nutrition"
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Price (₹) *</label>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="2999"
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Sale Price (₹)</label>
              <input type="number" value={form.discountPrice} onChange={e => set('discountPrice', e.target.value)} placeholder="2499"
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Stock *</label>
              <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="50"
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Weight / Size</label>
              <input value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="2kg / 5lbs"
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all" />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2.5 cursor-pointer h-10 px-3 bg-muted/50 border border-border/60 rounded-xl hover:bg-muted transition-all">
                <input type="checkbox" checked={form.isFeatured} onChange={e => set('isFeatured', e.target.checked)} className="w-4 h-4 accent-orange-500 rounded" />
                <span className="text-sm font-medium">Mark as Featured</span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Product description…"
              className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none input-glow transition-all resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-border shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-medium transition-all">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all disabled:opacity-60 flex items-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Product
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Product Card ───────────────────────────────────────────────────────── */
function ProductCard({
  s, index, onRestock, onDelete,
}: {
  s: any;
  index: number;
  onRestock: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [restocking, setRestocking] = useState(false);
  const [restockQty, setRestockQty] = useState('');
  const [showRestock, setShowRestock] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isLow = s.stock <= 5;
  const imageUrl = s.images?.[0];
  const meta = CATEGORY_META[s.category] ?? CATEGORY_META['Other'];
  const CatIcon = meta.icon;
  const discount = s.discountPrice ? Math.round((1 - s.discountPrice / s.price) * 100) : 0;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supplementsApi.delete(s.id);
      toast.success(`${s.name} removed`);
      onDelete(s.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to remove product');
    }
    setDeleting(false);
    setConfirmDelete(false);
  };

  const handleRestock = async () => {
    const qty = parseInt(restockQty);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return; }
    setRestocking(true);
    try {
      await supplementsApi.updateStock(s.id, qty);
      toast.success('Stock updated');
      setShowRestock(false);
      setRestockQty('');
      onRestock(s.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to update stock');
    }
    setRestocking(false);
  };

  return (
    <div
      className="product-card group bg-card border border-border/60 rounded-2xl overflow-hidden animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Visual Header */}
      <div className={`relative h-44 bg-gradient-to-br ${meta.grad} overflow-hidden`}>
        {imageUrl ? (
          <img src={imageUrl} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-5xl" role="img">{meta.emoji}</span>
              <CatIcon className="w-8 h-8 text-white/20 absolute bottom-4 right-4" />
            </div>
          </div>
        )}
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* PID badge top-right */}
        <div className="absolute top-3 right-3">
          <span className="pid-badge">{toPid(s.id)}</span>
        </div>

        {/* Featured badge top-left */}
        {s.isFeatured && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-400/90 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
            <Star className="w-3 h-3 fill-amber-900" /> Featured
          </div>
        )}

        {/* Low stock warning */}
        {isLow && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse-glow-brand">
            <AlertTriangle className="w-3 h-3" /> Low Stock
          </div>
        )}

        {/* Category badge */}
        {!isLow && (
          <div className={`absolute bottom-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm ${meta.bg} ${meta.color}`}>
            {s.category}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate">{s.name}</h3>
              {s.brand && <p className="text-xs text-muted-foreground mt-0.5">{s.brand}</p>}
            </div>
            {s.weight && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-lg shrink-0">{s.weight}</span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="font-extrabold text-xl text-primary">{formatCurrency(s.discountPrice ?? s.price)}</span>
          {s.discountPrice && (
            <>
              <span className="text-xs text-muted-foreground line-through">{formatCurrency(s.price)}</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md">
                -{discount}%
              </span>
            </>
          )}
        </div>

        {/* Stock bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground font-medium">Stock Level</span>
            <span className={`font-bold ${isLow ? 'text-rose-500' : 'text-foreground'}`}>{s.stock} units</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${isLow ? 'from-rose-500 to-rose-400' : meta.grad} transition-[width] duration-700 ease-out`}
              style={{ width: `${Math.min(s.stock, 100)}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        {showRestock ? (
          <div className="flex gap-2 items-center animate-slide-up">
            <input
              type="number" min="1" value={restockQty}
              onChange={e => setRestockQty(e.target.value)}
              placeholder="Qty to add"
              className="flex-1 h-9 px-3 text-xs bg-muted border border-border/60 rounded-xl outline-none input-glow"
              autoFocus
            />
            <button onClick={handleRestock} disabled={restocking}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all">
              {restocking ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Add'}
            </button>
            <button onClick={() => { setShowRestock(false); setRestockQty(''); }}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : confirmDelete ? (
          <div className="flex gap-2 items-center animate-slide-up">
            <p className="flex-1 text-xs text-rose-600 font-semibold">Remove this product?</p>
            <button onClick={handleDelete} disabled={deleting}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-all flex items-center gap-1">
              {deleting ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3 h-3" />}Yes
            </button>
            <button onClick={() => setConfirmDelete(false)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowRestock(true)}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl text-white bg-gradient-to-r ${meta.grad} hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-1.5`}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Restock
            </button>
            <button onClick={() => setConfirmDelete(true)} className="w-10 h-10 flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 transition-all text-rose-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function SupplementsPage() {
  const [supplements, setSupplements] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<'inventory' | 'orders'>('inventory');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      supplementsApi.getAll({ limit: 100 }),
      supplementsApi.getOrders({ limit: 10 }),
    ]).then(([s, o]: any[]) => {
      setSupplements(s.data ?? []);
      setOrders(o.data ?? []);
    }).catch(() => toast.error('Failed to load supplement data')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSeedProducts = async () => {
    setSeeding(true);
    let successCount = 0;
    for (const product of DEFAULT_SUPPLEMENTS) {
      try {
        await supplementsApi.create({ ...product, isActive: true });
        successCount++;
      } catch {}
    }
    toast.success(`${successCount} products added successfully!`);
    fetchData();
    setSeeding(false);
  };

  const filtered = supplements.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.brand?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || s.category === catFilter;
    return matchSearch && matchCat;
  });

  const lowStock = supplements.filter(s => s.stock <= 5);
  const totalValue = supplements.reduce((a, s) => a + (s.discountPrice ?? s.price) * s.stock, 0);
  const catCounts = CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: supplements.filter(s => s.category === c).length }), {} as Record<string, number>);

  const statsData = [
    { title: 'Total Products', value: supplements.length, icon: Package, gradient: 'blue' as const },
    { title: 'Low Stock', value: lowStock.length, icon: AlertTriangle, gradient: 'rose' as const, subtitle: 'Need restock' },
    { title: 'Inventory Value', value: totalValue, icon: TrendingUp, gradient: 'green' as const, isCurrency: true },
    { title: 'Total Orders', value: orders.length, icon: ShoppingBag, gradient: 'orange' as const },
  ];

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    CANCELLED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {showAddModal && <AddProductModal onClose={() => setShowAddModal(false)} onSuccess={fetchData} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center shadow-brand">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Supplement Store</h1>
          </div>
          <p className="text-muted-foreground text-sm">Manage inventory · track orders · {supplements.length} products</p>
        </div>
        <div className="flex items-center gap-2">
          {supplements.length === 0 && !loading && (
            <button
              onClick={handleSeedProducts}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-sm transition-all disabled:opacity-60"
            >
              {seeding ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {seeding ? 'Adding Products…' : 'Seed Demo Products'}
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger-fast">
        {statsData.map(s => <StatsCard key={s.title} {...s} />)}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 rounded-2xl animate-slide-in-right">
          <div className="w-9 h-9 bg-amber-400/20 rounded-xl flex items-center justify-center shrink-0 animate-pulse">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Low Stock Alert — {lowStock.length} product{lowStock.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-700/70 dark:text-amber-500 truncate">
              {lowStock.map(s => s.name).join(', ')}
            </p>
          </div>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            Restock needed <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl w-fit">
        {(['inventory', 'orders'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-2 rounded-lg text-sm font-bold capitalize transition-all', tab === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t}
            <span className={cn('ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full', t === 'inventory' ? 'gradient-brand text-white' : 'bg-blue-500 text-white')}>
              {t === 'inventory' ? supplements.length : orders.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'inventory' ? (
        <>
          {/* Category filter + search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
                className="w-full h-10 pl-10 pr-4 text-sm bg-card border border-border/60 rounded-xl outline-none input-glow transition-all" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCatFilter('')}
                className={cn('px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all', !catFilter ? 'gradient-brand text-white border-transparent shadow-brand' : 'bg-card border-border text-muted-foreground hover:bg-muted')}
              >
                All
              </button>
              {CATEGORIES.filter(c => catCounts[c] > 0).map(c => {
                const m = CATEGORY_META[c];
                return (
                  <button
                    key={c}
                    onClick={() => setCatFilter(catFilter === c ? '' : c)}
                    className={cn('px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5',
                      catFilter === c ? `bg-gradient-to-r ${m.grad} text-white border-transparent` : `bg-card border-border/60 ${m.color} hover:bg-muted`)}
                  >
                    <span>{m.emoji}</span>
                    {c}
                    <span className="bg-black/10 px-1.5 py-0.5 rounded-full text-[10px]">{catCounts[c]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shimmer-card h-80" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-3 bg-card border border-dashed border-border rounded-2xl p-16 text-center animate-fade-in">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="font-bold text-muted-foreground mb-1">No products found</p>
              <p className="text-sm text-muted-foreground/60 mb-4">
                {supplements.length === 0 ? 'Add your first product or seed demo data' : 'Try adjusting your search or filter'}
              </p>
              {supplements.length === 0 && (
                <button
                  onClick={handleSeedProducts}
                  disabled={seeding}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all"
                >
                  <Sparkles className="w-4 h-4" /> Seed Demo Products
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((s: any, i) => (
                <ProductCard key={s.id} s={s} index={i} onRestock={fetchData} onDelete={() => fetchData()} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Orders tab */
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-16 text-center animate-fade-in">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="font-bold text-muted-foreground">No orders yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Orders placed by members will appear here</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-fast">
              {orders.map((o: any) => (
                <div key={o.id} className="group bg-card border border-border/60 rounded-2xl p-5 hover:shadow-lifted hover:-translate-y-0.5 transition-all flex items-center gap-4 animate-slide-up">
                  <div className="w-12 h-12 gradient-brand rounded-2xl flex items-center justify-center text-white shrink-0 shadow-brand">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold">#{o.orderNumber}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${statusColors[o.status] ?? 'bg-muted text-muted-foreground'}`}>{o.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{o.user?.firstName} {o.user?.lastName} · {o.items?.length} items</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-xl">{formatCurrency(o.totalAmount)}</p>
                    <div className="flex gap-2 mt-1.5 justify-end">
                      {['Confirm', 'Ship', 'Deliver'].map(action => (
                        <button key={action} className="text-xs font-bold text-primary hover:underline transition-all">{action}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
