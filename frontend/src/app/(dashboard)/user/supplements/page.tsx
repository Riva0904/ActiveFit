'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Plus, Minus, ShoppingCart, Star, Search, Package, Zap, CheckCircle, Tag } from 'lucide-react';
import { supplementsApi, paymentsApi } from '@/lib/api';
import { ManualUpiModal } from '@/components/shared/ManualUpiModal';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const categoryGrads: Record<string, string> = {
  Protein: 'from-blue-500 to-blue-700',
  Performance: 'from-purple-500 to-purple-700',
  Recovery: 'from-emerald-500 to-emerald-700',
  'Pre-Workout': 'from-rose-500 to-rose-700',
  Vitamins: 'from-amber-500 to-amber-700',
};

export default function UserSupplementsPage() {
  const [supplements, setSupplements] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [upiModal, setUpiModal] = useState<any>(null);
  const [orderingUpi, setOrderingUpi] = useState(false);

  useEffect(() => {
    supplementsApi.getAll({ limit: 24 })
      .then((res: any) => setSupplements(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = ['', ...Array.from(new Set(supplements.map(s => s.category)))];
  const filtered = supplements.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) &&
    (!selectedCategory || s.category === selectedCategory)
  );

  const updateCart = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] ?? 0;
      const next = current + delta;
      if (next <= 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: next };
    });
  };

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((total, [id, qty]) => {
    const s = supplements.find(s => s.id === id);
    return total + (s ? (s.discountPrice ?? s.price) * qty : 0);
  }, 0);

  const placeOrder = async () => {
    if (cartCount === 0) return;
    setOrdering(true);
    try {
      const items = Object.entries(cart).map(([supplementId, quantity]) => ({ supplementId, quantity }));
      const orderRes: any = await supplementsApi.createCheckout(items);
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderRes.amount * 100,
          currency: 'INR',
          name: 'ActiveBoost',
          description: `Supplement order — ${cartCount} item${cartCount > 1 ? 's' : ''}`,
          order_id: orderRes.orderId,
          handler: async (response: any) => {
            await paymentsApi.verify({ paymentId: orderRes.paymentId, razorpayPaymentId: response.razorpay_payment_id, razorpayOrderId: response.razorpay_order_id, signature: response.razorpay_signature });
            toast.success('Order placed successfully! 🎉');
            setCart({});
          },
          theme: { color: '#f97316' },
        });
        rzp.open();
      } else { toast.error('Razorpay not loaded'); }
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Checkout failed'); }
    setOrdering(false);
  };

  const placeOrderUpi = async () => {
    if (cartCount === 0) return;
    setOrderingUpi(true);
    try {
      const items = Object.entries(cart).map(([supplementId, quantity]) => ({ supplementId, quantity }));
      const orderRes: any = await supplementsApi.createCheckout(items, true);
      setUpiModal({ paymentId: orderRes.paymentId, amount: orderRes.amount, vpa: orderRes.vpa, payeeName: orderRes.payeeName, description: `Supplement order — ${cartCount} item${cartCount > 1 ? 's' : ''}` });
    } catch (e: any) { toast.error(e.response?.data?.message ?? 'Checkout failed'); }
    setOrderingUpi(false);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Supplement Store</h1>
          <p className="text-muted-foreground mt-0.5">Quality nutrition for your fitness journey</p>
        </div>
        {cartCount > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={placeOrderUpi} disabled={orderingUpi}
              className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-bold disabled:opacity-70">
              Pay via UPI
            </button>
            <button onClick={placeOrder} disabled={ordering}
              className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all disabled:opacity-70">
              <ShoppingCart className="w-4 h-4" />
              Order {cartCount} item{cartCount > 1 ? 's' : ''} · {formatCurrency(cartTotal)}
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 rounded-full text-[10px] font-extrabold flex items-center justify-center">{cartCount}</span>
            </button>
          </div>
        )}
      </div>

      {upiModal && (
        <ManualUpiModal
          {...upiModal}
          onClose={() => setUpiModal(null)}
          onMarkedPaid={() => setCart({})}
        />
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplements…"
            className="w-full h-10 pl-10 pr-4 text-sm bg-card border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={cn('px-3.5 py-2 rounded-xl text-xs font-bold transition-all', selectedCategory === cat ? 'gradient-brand text-white shadow-sm' : 'bg-card border border-border hover:bg-muted text-muted-foreground')}>
              {cat || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Cart summary bar */}
      {cartCount > 0 && (
        <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center text-white">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold">{cartCount} item{cartCount > 1 ? 's' : ''} in cart</p>
              <p className="text-xs text-muted-foreground">Total: {formatCurrency(cartTotal)}</p>
            </div>
          </div>
          <button onClick={placeOrder} disabled={ordering}
            className="px-5 py-2 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all">
            {ordering ? 'Placing…' : 'Place Order →'}
          </button>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-80 shimmer-bg rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((s: any) => {
            const qty = cart[s.id] ?? 0;
            const price = s.discountPrice ?? s.price;
            const grad = categoryGrads[s.category] ?? 'from-orange-500 to-orange-700';
            const discount = s.discountPrice ? Math.round((1 - s.discountPrice / s.price) * 100) : 0;

            return (
              <div key={s.id} className={cn('group bg-card border border-border/60 rounded-2xl overflow-hidden transition-all duration-300',
                qty > 0 ? 'border-primary/40 shadow-brand' : 'hover:shadow-lifted hover:-translate-y-1',
                s.stock === 0 && 'opacity-70')}>
                {/* Product image */}
                <div className={`bg-gradient-to-br ${grad} h-40 relative flex items-center justify-center overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
                  <Package className="w-16 h-16 text-white/40" />
                  {discount > 0 && (
                    <div className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" /> {discount}% OFF
                    </div>
                  )}
                  {s.isFeatured && (
                    <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-amber-900" /> Featured
                    </div>
                  )}
                  {s.stock === 0 && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                      <span className="text-sm font-bold text-muted-foreground bg-card border border-border px-4 py-2 rounded-xl">Out of Stock</span>
                    </div>
                  )}
                  {qty > 0 && (
                    <div className="absolute bottom-2 right-2 w-6 h-6 gradient-brand rounded-full flex items-center justify-center text-white text-xs font-extrabold">
                      {qty}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <p className="font-bold truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-3">{s.brand} · {s.category}</p>

                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-extrabold text-xl text-primary">{formatCurrency(price)}</span>
                      {s.discountPrice && (
                        <span className="text-xs text-muted-foreground line-through ml-2">{formatCurrency(s.price)}</span>
                      )}
                    </div>
                    <span className={cn('text-xs font-bold', s.stock <= 5 ? 'text-rose-600' : 'text-muted-foreground')}>
                      {s.stock} left
                    </span>
                  </div>

                  {qty === 0 ? (
                    <button onClick={() => updateCart(s.id, 1)} disabled={s.stock === 0}
                      className={cn('w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2', s.stock === 0 ? 'bg-muted text-muted-foreground cursor-not-allowed' : `bg-gradient-to-r ${grad} text-white hover:opacity-90 shadow-sm`)}>
                      <Plus className="w-4 h-4" /> Add to Cart
                    </button>
                  ) : (
                    <div className="flex items-center justify-between bg-muted/50 rounded-xl p-1">
                      <button onClick={() => updateCart(s.id, -1)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-card transition-all font-bold text-lg">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-extrabold text-base">{qty}</span>
                      <button onClick={() => updateCart(s.id, 1)} className={`w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-to-r ${grad} text-white transition-all hover:opacity-90`}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="col-span-4 bg-card border border-dashed border-border rounded-2xl p-16 text-center text-muted-foreground">
              <ShoppingBag className="w-14 h-14 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No supplements found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
