'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Plus, Scale, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { progressApi } from '@/lib/api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

const FIELD_CONFIG = [
  { key: 'weight', label: 'Weight', unit: 'kg', icon: Scale },
  { key: 'bodyFat', label: 'Body Fat', unit: '%', icon: Activity },
  { key: 'chest', label: 'Chest', unit: 'cm', icon: Activity },
  { key: 'waist', label: 'Waist', unit: 'cm', icon: Activity },
  { key: 'arms', label: 'Arms', unit: 'cm', icon: Activity },
  { key: 'thighs', label: 'Thighs', unit: 'cm', icon: Activity },
];

export default function ProgressPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeChart, setActiveChart] = useState<'weight' | 'bodyFat'>('weight');
  const [form, setForm] = useState({ weight: '', bodyFat: '', chest: '', waist: '', arms: '', thighs: '', notes: '' });

  const fetchLogs = async () => {
    try {
      const data: any = await progressApi.getMyLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  const save = async () => {
    const hasData = Object.entries(form).some(([k, v]) => k !== 'notes' && v !== '');
    if (!hasData) { toast.error('Enter at least one measurement'); return; }
    setSaving(true);
    try {
      const payload: any = {};
      FIELD_CONFIG.forEach(({ key }) => { if ((form as any)[key]) payload[key] = parseFloat((form as any)[key]); });
      if (form.notes) payload.notes = form.notes;
      if (form.weight && form.weight) payload.height = undefined;
      await progressApi.create(payload);
      toast.success('Progress logged! Keep it up! 💪');
      setForm({ weight: '', bodyFat: '', chest: '', waist: '', arms: '', thighs: '', notes: '' });
      fetchLogs();
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to save progress');
    }
    setSaving(false);
  };

  const chartData = logs.slice(0, 12).reverse().map((l, i) => ({
    date: new Date(l.logDate).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    weight: l.weight ?? null,
    bodyFat: l.bodyFat ?? null,
  })).filter(d => d[activeChart] !== null);

  const latest = logs[0];
  const previous = logs[1];

  const metrics = [
    { label: 'Weight', key: 'weight', unit: 'kg', lowerIsBetter: true },
    { label: 'Body Fat', key: 'bodyFat', unit: '%', lowerIsBetter: true },
    { label: 'BMI', key: 'bmi', unit: '', lowerIsBetter: false },
    { label: 'Arms', key: 'arms', unit: 'cm', lowerIsBetter: false },
  ];

  const measurements = [
    { label: 'Chest', key: 'chest', unit: 'cm', color: 'gradient-blue', lowerIsBetter: true },
    { label: 'Waist', key: 'waist', unit: 'cm', color: 'gradient-green', lowerIsBetter: true },
    { label: 'Arms', key: 'arms', unit: 'cm', color: 'gradient-brand', lowerIsBetter: false },
    { label: 'Thighs', key: 'thighs', unit: 'cm', color: 'gradient-purple', lowerIsBetter: true },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Fitness Progress</h1>
          <p className="text-muted-foreground mt-0.5">Track your transformation journey</p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map(({ label, key, unit, lowerIsBetter }) => {
          const current = latest?.[key];
          const prev = previous?.[key];
          const change = current != null && prev != null ? +(current - prev).toFixed(1) : null;
          const improved = change !== null ? (lowerIsBetter ? change < 0 : change > 0) : null;
          return (
            <div key={label} className="bg-card border border-border/60 rounded-2xl p-5 hover:shadow-card transition-all">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
              <p className="text-3xl font-extrabold">
                {current != null ? current : '—'}
                {current != null && <span className="text-base font-medium text-muted-foreground ml-1">{unit}</span>}
              </p>
              {change !== null && (
                <div className={cn('flex items-center gap-1 mt-2 text-xs font-bold', improved ? 'text-emerald-600' : 'text-rose-600')}>
                  {improved ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                  {Math.abs(change)}{unit} vs last log
                </div>
              )}
              {change === null && <p className="text-xs text-muted-foreground mt-2">{logs.length === 0 ? 'No data yet' : 'First log'}</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Chart */}
        <div className="xl:col-span-2 bg-card border border-border/60 rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-lg">Progress Chart</h3>
              <p className="text-sm text-muted-foreground">{logs.length} measurements recorded</p>
            </div>
            <div className="flex gap-1 bg-muted/60 p-1 rounded-xl">
              {([{ key: 'weight', label: 'Weight' }, { key: 'bodyFat', label: 'Body Fat' }] as const).map(({ key, label }) => (
                <button key={key} onClick={() => setActiveChart(key)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', activeChart === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-[220px] shimmer-bg rounded-xl" />
          ) : chartData.length === 0 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
              <TrendingUp className="w-12 h-12 opacity-20 mb-2" />
              <p className="text-sm">Log your first measurement below</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="progGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                <Area type="monotone" dataKey={activeChart} stroke="#f97316" strokeWidth={2.5} fill="url(#progGrad)" dot={{ fill: '#f97316', r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Body measurements */}
        <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
          <h3 className="font-bold text-lg mb-5">Body Measurements</h3>
          {loading ? (
            <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 shimmer-bg rounded-xl" />)}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Scale className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No measurements yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {measurements.map(({ label, key, unit, color, lowerIsBetter }) => {
                const current = latest?.[key];
                const first = logs[logs.length - 1]?.[key];
                const diff = current != null && first != null ? +(current - first).toFixed(1) : null;
                const improved = diff !== null ? (lowerIsBetter ? diff <= 0 : diff >= 0) : null;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${color} rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {label[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-semibold">{label}</span>
                        <span className="font-bold">{current != null ? `${current} ${unit}` : '—'}</span>
                      </div>
                      {diff !== null && (
                        <p className={cn('text-[11px] font-bold', improved ? 'text-emerald-600' : 'text-rose-600')}>
                          {diff > 0 ? '+' : ''}{diff} {unit} since start
                        </p>
                      )}
                      {diff === null && <p className="text-[11px] text-muted-foreground">Not logged</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Log form */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center text-white">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold">Log Today's Progress</h3>
            <p className="text-sm text-muted-foreground">Track your measurements</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          {FIELD_CONFIG.map(({ key, label, unit }) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {label} <span className="lowercase normal-case font-normal">({unit})</span>
              </label>
              <input type="number" step="0.1" value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder="0"
                className="w-full h-10 px-3 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all text-center font-bold" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="How do you feel today? Any notes…"
            className="flex-1 h-10 px-4 text-sm bg-muted/50 border border-border/60 rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all" />
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-brand text-white font-bold text-sm shadow-brand hover:opacity-90 transition-all disabled:opacity-70">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Recent logs table */}
      {logs.length > 0 && (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-card">
          <div className="p-5 border-b border-border">
            <h3 className="font-bold">Progress History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {['Date', 'Weight', 'Body Fat', 'BMI', 'Chest', 'Waist', 'Arms', 'Notes'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {logs.slice(0, 10).map((l: any) => (
                  <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-medium whitespace-nowrap">{new Date(l.loggedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="py-3 px-4 text-muted-foreground">{l.weight != null ? `${l.weight} kg` : '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{l.bodyFat != null ? `${l.bodyFat}%` : '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{l.bmi != null ? l.bmi : '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{l.chest != null ? `${l.chest} cm` : '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{l.waist != null ? `${l.waist} cm` : '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{l.arms != null ? `${l.arms} cm` : '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs max-w-[150px] truncate">{l.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
