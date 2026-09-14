/**
 * Weight ruler math — pure, no React Native imports (tested with node --test).
 * The ruler is a horizontal strip: one tick per STEP kg, PX_PER_STEP px apart.
 * `offset` = scroll position of the strip; the centre needle reads the value under it.
 */

export const WEIGHT_MIN = 30;
export const WEIGHT_MAX = 200;
export const STEP = 0.5;
export const PX_PER_STEP = 8;

export const TICK_COUNT = Math.round((WEIGHT_MAX - WEIGHT_MIN) / STEP) + 1;

export function clampWeight(kg: number): number {
  if (!Number.isFinite(kg)) return WEIGHT_MIN;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, kg));
}

/** Snap to the nearest STEP (0.5 kg). */
export function snapWeight(kg: number): number {
  return Math.round(clampWeight(kg) / STEP) * STEP;
}

export function weightToOffset(kg: number): number {
  return Math.round((snapWeight(kg) - WEIGHT_MIN) / STEP) * PX_PER_STEP;
}

export function offsetToWeight(px: number): number {
  const steps = Math.round((Number.isFinite(px) ? px : 0) / PX_PER_STEP);
  return snapWeight(WEIGHT_MIN + steps * STEP);
}

export type TickKind = 'major' | 'mid' | 'minor';

/** Tick i (0-based from WEIGHT_MIN): every 5 kg major (labelled), every 1 kg mid, else minor. */
export function tickKind(i: number): TickKind {
  const kg = WEIGHT_MIN + i * STEP;
  if (Math.abs(kg % 5) < 1e-9) return 'major';
  if (Math.abs(kg % 1) < 1e-9) return 'mid';
  return 'minor';
}

export function tickLabel(i: number): string {
  return String(WEIGHT_MIN + i * STEP);
}

/** Most recent logged weight (by logDate desc, then createdAt), or null. */
export function latestWeight(logs: ReadonlyArray<{ weight?: number | null; logDate?: string | Date | null; createdAt?: string | Date | null }>): number | null {
  const withWeight = logs.filter((l) => typeof l.weight === 'number' && Number.isFinite(l.weight));
  if (withWeight.length === 0) return null;
  const ts = (l: (typeof withWeight)[number]) => new Date(l.logDate ?? l.createdAt ?? 0).getTime();
  return [...withWeight].sort((a, b) => ts(b) - ts(a))[0].weight as number;
}
