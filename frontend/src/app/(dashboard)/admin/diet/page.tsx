'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Utensils, Plus, X, Loader2, Pencil, Trash2, Search, UserPlus, Users, Flame, Tag, GripVertical,
} from 'lucide-react';
import { dietPlansApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AssignMembersModal } from '@/components/shared/AssignMembersModal';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const inp = 'w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 transition-all';

const GOALS = ['WEIGHT_LOSS', 'MUSCLE_GAIN', 'MAINTENANCE', 'ENDURANCE', 'GENERAL'];
const DEFAULT_SLOTS = ['Breakfast', 'Mid-Morning', 'Lunch', 'Afternoon Snack', 'Dinner', 'Evening'];

interface Meal { meal: string; items: string[]; calories?: number; notes?: string }
interface Plan {
  id: string; name: string; goal: string; description?: string; totalCalories?: number;
  meals: Meal[]; restrictions: string[]; isPremium: boolean; price?: number; durationDays?: number;
  _count?: { assignments: number };
}

const emptyMeal = (name: string): Meal => ({ meal: name, items: [''], calories: undefined });

export default function DietPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    dietPlansApi.listAll()
      .then((res: any) => setPlans(res ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (plan: Plan) => {
    if (!confirm(`Delete "${plan.name}"? Members on it will lose access.`)) return;
    setDeleting(plan.id);
    try {
      await dietPlansApi.remove(plan.id);
      toast.success('Plan deleted');
      load();
    } catch {
      toast.error('Could not delete');
    }
    setDeleting(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? plans.filter((p) => p.name.toLowerCase().includes(q)) : plans;
  }, [plans, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl gradient-teal flex items-center justify-center">
              <Utensils className="w-5 h-5 text-white" />
            </span>
            Diet Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Build a plan meal by meal, then assign it to members or sell it in the store.</p>
        </div>
        <button onClick={() => setCreating(true)} className="gradient-brand text-white font-bold text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-brand self-start">
          <Plus className="w-4 h-4" /> New plan
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plans…" className={cn(inp, 'pl-9')} />
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="shimmer-card h-48 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border/60 rounded-2xl p-12 text-center">
          <Utensils className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-bold">No diet plans yet</p>
          <p className="text-sm text-muted-foreground mt-1">Build one and assign it to a member.</p>
          <button onClick={() => setCreating(true)} className="mt-4 gradient-brand text-white font-bold text-sm px-4 py-2 rounded-xl">Create a plan</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plan, i) => (
            <div key={plan.id} className="bg-card border border-border/60 rounded-2xl overflow-hidden flex flex-col stagger-delay" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="p-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-extrabold leading-tight">{plan.name}</h3>
                  {plan.isPremium ? (
                    <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 shrink-0">
                      {plan.price ? formatCurrency(plan.price) : 'PREMIUM'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-muted text-muted-foreground shrink-0">CUSTOM</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{plan.goal?.replace(/_/g, ' ')}</p>

                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60">
                    <Utensils className="w-3 h-3" /> {plan.meals?.length ?? 0} meals
                  </span>
                  {plan.totalCalories ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60">
                      <Flame className="w-3 h-3" /> {plan.totalCalories} kcal
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60">
                    <Users className="w-3 h-3" /> {plan._count?.assignments ?? 0}
                  </span>
                </div>

                {plan.restrictions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {plan.restrictions.map((r) => (
                      <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400">{r}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex border-t border-border/60 divide-x divide-border/60">
                <button onClick={() => setAssignTarget(plan)} className="flex-1 py-2.5 text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Assign
                </button>
                <button onClick={() => setEditing(plan)} className="flex-1 py-2.5 text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => remove(plan)} disabled={deleting === plan.id} className="px-4 py-2.5 text-xs font-bold hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
                  {deleting === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PlanModal
          plan={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}

      {assignTarget && (
        <AssignMembersModal
          planName={assignTarget.name}
          onAssign={(ids) => dietPlansApi.assign(assignTarget.id, ids)}
          loadAssignments={() => dietPlansApi.assignments(assignTarget.id)}
          onUnassign={(id) => dietPlansApi.unassign(id)}
          onClose={() => { setAssignTarget(null); load(); }}
        />
      )}
    </div>
  );
}

/* ─── Builder ─────────────────────────────────────────────────────────────── */

function PlanModal({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [goal, setGoal] = useState(plan?.goal ?? 'WEIGHT_LOSS');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [totalCalories, setTotalCalories] = useState(plan?.totalCalories ? String(plan.totalCalories) : '');
  const [isPremium, setIsPremium] = useState(plan?.isPremium ?? false);
  const [price, setPrice] = useState(plan?.price ? String(plan.price) : '');
  const [durationDays, setDurationDays] = useState(plan?.durationDays ? String(plan.durationDays) : '30');
  const [restrictions, setRestrictions] = useState<string[]>(plan?.restrictions ?? []);
  const [restrictionInput, setRestrictionInput] = useState('');
  const [meals, setMeals] = useState<Meal[]>(
    plan?.meals?.length ? plan.meals.map((m) => ({ ...m, items: [...(m.items ?? [])] })) : [emptyMeal('Breakfast')],
  );
  const [saving, setSaving] = useState(false);

  const setMeal = (idx: number, patch: Partial<Meal>) =>
    setMeals((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const setItem = (mealIdx: number, itemIdx: number, value: string) =>
    setMeals((prev) => prev.map((m, i) => (i === mealIdx ? { ...m, items: m.items.map((it, j) => (j === itemIdx ? value : it)) } : m)));

  const addItem = (mealIdx: number) =>
    setMeals((prev) => prev.map((m, i) => (i === mealIdx ? { ...m, items: [...m.items, ''] } : m)));

  const removeItem = (mealIdx: number, itemIdx: number) =>
    setMeals((prev) => prev.map((m, i) => (i === mealIdx ? { ...m, items: m.items.filter((_, j) => j !== itemIdx) } : m)));

  const addMeal = () => {
    const next = DEFAULT_SLOTS.find((s) => !meals.some((m) => m.meal === s)) ?? `Meal ${meals.length + 1}`;
    setMeals((prev) => [...prev, emptyMeal(next)]);
  };

  const mealCalories = meals.reduce((s, m) => s + (Number(m.calories) || 0), 0);

  const save = async () => {
    if (!name.trim()) { toast.error('Give the plan a name'); return; }
    const cleaned = meals
      .map((m) => ({
        meal: m.meal.trim(),
        items: m.items.map((i) => i.trim()).filter(Boolean),
        ...(m.calories ? { calories: Number(m.calories) } : {}),
      }))
      .filter((m) => m.meal && m.items.length > 0);

    if (cleaned.length === 0) { toast.error('Add at least one meal with an item'); return; }
    if (isPremium && !(Number(price) > 0)) { toast.error('A premium plan needs a price'); return; }

    const body: any = {
      name: name.trim(),
      goal,
      description: description.trim() || undefined,
      totalCalories: totalCalories ? Number(totalCalories) : undefined,
      meals: cleaned,
      restrictions,
      isPremium,
      ...(isPremium ? { price: Number(price) } : {}),
      durationDays: Number(durationDays) || 30,
    };

    setSaving(true);
    try {
      if (plan) await dietPlansApi.updatePlan(plan.id, body);
      else await dietPlansApi.createPackage(body);
      toast.success(plan ? 'Plan updated' : 'Plan created');
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not save the plan');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-pop">
        <div className="gradient-teal p-5 relative overflow-hidden shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <h2 className="font-extrabold text-xl text-white">{plan ? 'Edit diet plan' : 'New diet plan'}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Basics */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Plan name *">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fat loss — 1800 kcal" className={inp} />
            </Field>
            <Field label="Goal">
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className={inp}>
                {GOALS.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Daily calories">
              <input type="number" value={totalCalories} onChange={(e) => setTotalCalories(e.target.value)} placeholder="1800" className={inp} />
            </Field>
            <Field label="Duration (days)">
              <input type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className={inp} />
            </Field>
          </div>

          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 resize-none" />
          </Field>

          {/* Restrictions */}
          <Field label="Dietary tags">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {restrictions.map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400">
                  {r}
                  <button onClick={() => setRestrictions((p) => p.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={restrictionInput}
                onChange={(e) => setRestrictionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && restrictionInput.trim()) {
                    e.preventDefault();
                    setRestrictions((p) => [...p, restrictionInput.trim().toUpperCase()]);
                    setRestrictionInput('');
                  }
                }}
                placeholder="e.g. VEGAN, then press Enter"
                className={inp}
              />
              <button
                onClick={() => { if (restrictionInput.trim()) { setRestrictions((p) => [...p, restrictionInput.trim().toUpperCase()]); setRestrictionInput(''); } }}
                className="px-3 rounded-xl border border-border hover:bg-muted text-sm font-bold shrink-0"
              >
                <Tag className="w-4 h-4" />
              </button>
            </div>
          </Field>

          {/* Meal builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                Meals {mealCalories > 0 && <span className="normal-case font-medium">· {mealCalories} kcal total</span>}
              </p>
              <button onClick={addMeal} className="text-xs font-bold text-primary flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add meal
              </button>
            </div>

            <div className="space-y-3">
              {meals.map((meal, mi) => (
                <div key={mi} className="border border-border/60 rounded-xl p-3 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      value={meal.meal}
                      onChange={(e) => setMeal(mi, { meal: e.target.value })}
                      placeholder="Meal name"
                      className="flex-1 h-9 px-2.5 text-sm font-bold bg-card border border-border/60 rounded-lg outline-none focus:border-primary/40"
                    />
                    <input
                      type="number"
                      value={meal.calories ?? ''}
                      onChange={(e) => setMeal(mi, { calories: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="kcal"
                      className="w-20 h-9 px-2.5 text-sm bg-card border border-border/60 rounded-lg outline-none focus:border-primary/40"
                    />
                    {meals.length > 1 && (
                      <button onClick={() => setMeals((p) => p.filter((_, i) => i !== mi))} className="w-9 h-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 pl-6">
                    {meal.items.map((item, ii) => (
                      <div key={ii} className="flex gap-2">
                        <input
                          value={item}
                          onChange={(e) => setItem(mi, ii, e.target.value)}
                          placeholder="e.g. 100 g oats"
                          className="flex-1 h-9 px-2.5 text-sm bg-card border border-border/60 rounded-lg outline-none focus:border-primary/40"
                        />
                        <button onClick={() => removeItem(mi, ii)} className="w-9 h-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-muted shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => addItem(mi)} className="text-xs font-bold text-primary flex items-center gap-1 pt-0.5">
                      <Plus className="w-3 h-3" /> Add item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selling */}
          <div className="border-t border-border/60 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className="text-sm font-bold">Sell this plan in the member store</span>
            </label>
            <p className="text-xs text-muted-foreground mt-1 ml-6.5">
              Leave off to keep it as a custom plan you assign directly. Selling requires a Professional plan or higher.
            </p>
            {isPremium && (
              <div className="mt-3 max-w-[200px]">
                <Field label="Price (₹) *">
                  <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inp} />
                </Field>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-border shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-[2] py-2.5 rounded-xl gradient-brand text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {plan ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
