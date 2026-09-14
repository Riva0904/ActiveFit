/**
 * Weekly bar-chart bucketing — pure, node-testable.
 * Weeks start on Sunday to match the calendar heatmap (Date#getDay()).
 */

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Local-time midnight of the Sunday on or before `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** 'YYYY-MM-DD' in local time. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Index 0–6 (Sun–Sat) of `date` within the week containing `now`, or -1 if outside it. */
export function weekIndex(date: Date, now: Date): number {
  const start = startOfWeek(now);
  const diffDays = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - start.getTime()) / 86400000);
  return diffDays >= 0 && diffDays < 7 ? diffDays : -1;
}

export interface HistoryRow {
  /** ISO date/datetime of the visit (checkInTime or date). */
  date: string;
  durationMinutes?: number | null;
}

/** Minutes in the gym per weekday for the week containing `now`. */
export function bucketWeekMinutes(rows: ReadonlyArray<HistoryRow>, now: Date): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    const i = weekIndex(d, now);
    if (i < 0) continue;
    out[i] += Math.max(0, Number(r.durationMinutes) || 0);
  }
  return out;
}

/** Presence per weekday from 'YYYY-MM-DD' strings (calendar endpoint). */
export function bucketWeekPresence(presentDates: ReadonlyArray<string>, now: Date): boolean[] {
  const out = [false, false, false, false, false, false, false];
  for (const s of presentDates) {
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) continue;
    const i = weekIndex(new Date(y, m - 1, d), now);
    if (i >= 0) out[i] = true;
  }
  return out;
}

/** Scale values to pixel heights; non-zero values never drop below `minPx`. All-zero → all `minPx`. */
export function scaleBars(values: ReadonlyArray<number>, maxHeightPx: number, minPx = 4): number[] {
  const max = Math.max(0, ...values.map((v) => (Number.isFinite(v) ? v : 0)));
  return values.map((v) => {
    const n = Number.isFinite(v) ? Math.max(0, v) : 0;
    if (max <= 0 || n <= 0) return minPx;
    return Math.max(minPx, Math.round((n / max) * maxHeightPx));
  });
}
