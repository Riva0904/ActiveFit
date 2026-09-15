'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dumbbell, Plus, X, Loader2, Pencil, Trash2, Search, UserPlus, Users, CalendarDays, Copy,
} from 'lucide-react';
import { workoutPlansApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AssignMembersModal } from '@/components/shared/AssignMembersModal';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const inp = 'w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 transition-all';

// Full names only — the mobile workout screen filters on an exact match, so
// "Mon" would render as a rest day (and the backend DTO rejects it).
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const GOALS = ['MUSCLE_GAIN', 'WEIGHT_LOSS', 'ENDURANCE', 'FLEXIBILITY', 'GENERAL_FITNESS'];
const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const MUSCLES = ['chest', 'back', 'shoulders', 'legs', 'glutes', 'arms', 'core', 'full', 'cardio', 'mobility'];

interface Exercise { day: string; name: string; sets: number; reps?: string | number; rest?: number; muscle?: string; notes?: string }
interface Plan {
  id: string; name: string; goal: string; difficulty: string; description?: string; durationWeeks?: number;
  exercises: Exercise[]; isPremium: boolean; price?: number; durationDays?: number;
  _count?: { assignments: number };
}

export default function WorkoutPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    workoutPlansApi.listAll()
      .then((res: any) => setPlans(res ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (plan: Plan) => {
    if (!confirm(`Delete "${plan.name}"? Members on it will lose access.`)) return;
    setDeleting(plan.id);
    try {
      await workoutPlansApi.remove(plan.id);
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
            <span className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </span>
            Workout Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Build a weekly split exercise by exercise, then assign it to members.</p>
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
          <Dumbbell className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-bold">No workout plans yet</p>
          <p className="text-sm text-muted-foreground mt-1">Build one and assign it to a member.</p>
          <button onClick={() => setCreating(true)} className="mt-4 gradient-brand text-white font-bold text-sm px-4 py-2 rounded-xl">Create a plan</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plan, i) => {
            const days = new Set((plan.exercises ?? []).map((e) => e.day));
            return (
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.goal?.replace(/_/g, ' ')} · {plan.difficulty}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-3 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60">
                      <CalendarDays className="w-3 h-3" /> {days.size} days/week
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60">
                      <Dumbbell className="w-3 h-3" /> {plan.exercises?.length ?? 0} exercises
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/60">
                      <Users className="w-3 h-3" /> {plan._count?.assignments ?? 0}
                    </span>
                  </div>
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
            );
          })}
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
          onAssign={(ids) => workoutPlansApi.assign(assignTarget.id, ids)}
          loadAssignments={() => workoutPlansApi.assignments(assignTarget.id)}
          onUnassign={(id) => workoutPlansApi.unassign(id)}
          onClose={() => { setAssignTarget(null); load(); }}
        />
      )}
    </div>
  );
}

/* ─── Builder ─────────────────────────────────────────────────────────────── */

function PlanModal({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [goal, setGoal] = useState(plan?.goal ?? 'MUSCLE_GAIN');
  const [difficulty, setDifficulty] = useState(plan?.difficulty ?? 'BEGINNER');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [durationWeeks, setDurationWeeks] = useState(plan?.durationWeeks ? String(plan.durationWeeks) : '4');
  const [isPremium, setIsPremium] = useState(plan?.isPremium ?? false);
  const [price, setPrice] = useState(plan?.price ? String(plan.price) : '');
  const [exercises, setExercises] = useState<Exercise[]>(plan?.exercises ?? []);
  const [activeDay, setActiveDay] = useState(DAYS[0]);
  const [saving, setSaving] = useState(false);

  const dayExercises = exercises.filter((e) => e.day === activeDay);
  const daysUsed = new Set(exercises.map((e) => e.day));

  const addExercise = () => {
    setExercises((prev) => [...prev, { day: activeDay, name: '', sets: 3, reps: '10', rest: 60, muscle: 'chest' }]);
  };

  const patchExercise = (globalIdx: number, patch: Partial<Exercise>) =>
    setExercises((prev) => prev.map((e, i) => (i === globalIdx ? { ...e, ...patch } : e)));

  const indexOfNth = (n: number) => {
    // Map the nth exercise of the active day back to its index in the flat list.
    let seen = -1;
    for (let i = 0; i < exercises.length; i++) {
      if (exercises[i].day === activeDay) seen++;
      if (seen === n) return i;
    }
    return -1;
  };

  const copyDay = (from: string) => {
    const source = exercises.filter((e) => e.day === from);
    if (source.length === 0) { toast.error(`${from} has no exercises`); return; }
    setExercises((prev) => [...prev.filter((e) => e.day !== activeDay), ...source.map((e) => ({ ...e, day: activeDay }))]);
    toast.success(`Copied ${from} to ${activeDay}`);
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Give the plan a name'); return; }
    const cleaned = exercises
      .map((e) => ({
        day: e.day,
        name: e.name.trim(),
        sets: Number(e.sets) || 1,
        ...(e.reps !== undefined && e.reps !== '' ? { reps: e.reps } : {}),
        ...(e.rest !== undefined ? { rest: Number(e.rest) || 0 } : {}),
        ...(e.muscle ? { muscle: e.muscle } : {}),
        ...(e.notes?.trim() ? { notes: e.notes.trim() } : {}),
      }))
      .filter((e) => e.name);

    if (cleaned.length === 0) { toast.error('Add at least one exercise'); return; }
    if (isPremium && !(Number(price) > 0)) { toast.error('A premium plan needs a price'); return; }

    const body: any = {
      name: name.trim(),
      goal,
      difficulty,
      description: description.trim() || undefined,
      durationWeeks: Number(durationWeeks) || 4,
      exercises: cleaned,
      isPremium,
      ...(isPremium ? { price: Number(price) } : {}),
    };

    setSaving(true);
    try {
      if (plan) await workoutPlansApi.updatePlan(plan.id, body);
      else await workoutPlansApi.createPackage(body);
      toast.success(plan ? 'Plan updated' : 'Plan created');
      onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not save the plan');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-pop">
        <div className="gradient-purple p-5 relative overflow-hidden shrink-0">
          <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <h2 className="font-extrabold text-xl text-white">{plan ? 'Edit workout plan' : 'New workout plan'}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <Field label="Plan name *">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push Pull Legs" className={inp} />
              </Field>
            </div>
            <Field label="Goal">
              <select value={goal} onChange={(e) => setGoal(e.target.value)} className={inp}>
                {GOALS.map((g) => <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Level">
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inp}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Duration (weeks)">
              <input type="number" value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} className={inp} />
            </Field>
            <Field label="Description">
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={inp} />
            </Field>
          </div>

          {/* Day tabs */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Weekly schedule</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {DAYS.map((d) => {
                const count = exercises.filter((e) => e.day === d).length;
                return (
                  <button
                    key={d}
                    onClick={() => setActiveDay(d)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all',
                      activeDay === d ? 'gradient-brand text-white border-transparent'
                        : count > 0 ? 'bg-muted/60 border-border/60' : 'bg-muted/20 border-border/40 text-muted-foreground',
                    )}
                  >
                    {d.slice(0, 3)}
                    {count > 0 && <span className="ml-1.5 opacity-75">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exercises for the active day */}
          <div className="border border-border/60 rounded-xl p-3 bg-muted/20">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-sm">{activeDay}</p>
              <div className="flex items-center gap-2">
                {daysUsed.size > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) { copyDay(e.target.value); e.target.value = ''; } }}
                    defaultValue=""
                    className="h-8 px-2 text-xs bg-card border border-border/60 rounded-lg outline-none"
                  >
                    <option value="">Copy from…</option>
                    {[...daysUsed].filter((d) => d !== activeDay).map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
                <button onClick={addExercise} className="text-xs font-bold text-primary flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add exercise
                </button>
              </div>
            </div>

            {dayExercises.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Rest day — add an exercise to train on {activeDay}.</p>
            ) : (
              <div className="space-y-2">
                {dayExercises.map((ex, n) => {
                  const gi = indexOfNth(n);
                  return (
                    <div key={n} className="bg-card border border-border/60 rounded-lg p-2.5 space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={ex.name}
                          onChange={(e) => patchExercise(gi, { name: e.target.value })}
                          placeholder="Exercise name"
                          className="flex-1 h-9 px-2.5 text-sm font-semibold bg-muted/40 border border-border/60 rounded-lg outline-none focus:border-primary/40"
                        />
                        <button onClick={() => setExercises((prev) => prev.filter((_, i) => i !== gi))} className="w-9 h-9 rounded-lg border border-border/60 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <NumBox label="Sets" value={ex.sets} onChange={(v) => patchExercise(gi, { sets: Number(v) || 1 })} />
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Reps</label>
                          <input
                            value={ex.reps ?? ''}
                            onChange={(e) => patchExercise(gi, { reps: e.target.value })}
                            placeholder="8-10"
                            className="w-full h-8 px-2 text-sm bg-muted/40 border border-border/60 rounded-lg outline-none focus:border-primary/40"
                          />
                        </div>
                        <NumBox label="Rest (s)" value={ex.rest ?? 60} onChange={(v) => patchExercise(gi, { rest: Number(v) || 0 })} />
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Muscle</label>
                          <select
                            value={ex.muscle ?? ''}
                            onChange={(e) => patchExercise(gi, { muscle: e.target.value })}
                            className="w-full h-8 px-1.5 text-sm bg-muted/40 border border-border/60 rounded-lg outline-none focus:border-primary/40"
                          >
                            {MUSCLES.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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

function NumBox({ label, value, onChange }: { label: string; value: number | string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-muted-foreground uppercase">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-2 text-sm bg-muted/40 border border-border/60 rounded-lg outline-none focus:border-primary/40"
      />
    </div>
  );
}
