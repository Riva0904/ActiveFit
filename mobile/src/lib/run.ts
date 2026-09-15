/**
 * Run-tracker math and formatting — pure, node-testable.
 */

export interface LatLng { lat: number; lng: number }
export interface RoutePoint extends LatLng { ts: number; accuracy?: number | null }

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function totalDistance(points: ReadonlyArray<LatLng>): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += haversineMeters(points[i - 1], points[i]);
  return m;
}

/** Seconds per km, or null when the distance is too short to be meaningful. */
export function paceSecPerKm(meters: number, seconds: number): number | null {
  if (!(meters >= 100) || !(seconds > 0)) return null;
  return seconds / (meters / 1000);
}

/** "5'32\"" */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return "—'—\"";
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}'${String(s).padStart(2, '0')}"`;
}

/** "44:13" or "1:04:13" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Thousands separated with a thin space, like the reference ("8 566 m"). ≥ 100 km switches to km. */
export function formatDistance(meters: number): string {
  const m = Math.max(0, Math.round(Number.isFinite(meters) ? meters : 0));
  if (m >= 100000) return `${(m / 1000).toFixed(1)} km`;
  return `${groupThousands(m)} m`;
}

export function formatKm(meters: number, decimals = 2): string {
  const m = Math.max(0, Number.isFinite(meters) ? meters : 0);
  return `${(m / 1000).toFixed(decimals)} km`;
}

export function groupThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Rough running energy: ~1.036 kcal per kg per km. */
export function estimateKcal(meters: number, weightKg = 70): number {
  const km = Math.max(0, Number.isFinite(meters) ? meters : 0) / 1000;
  const kg = weightKg > 0 && Number.isFinite(weightKg) ? weightKg : 70;
  return Math.round(km * kg * 1.036);
}

export interface FilterOptions { maxAccuracy?: number; minMeters?: number }

/**
 * Accept a GPS fix only if it is accurate enough and moved far enough from the
 * previous accepted point — drops jitter while standing still.
 */
export function filterPoint(prev: RoutePoint | null, next: RoutePoint, opts: FilterOptions = {}): boolean {
  const { maxAccuracy = 30, minMeters = 3 } = opts;
  if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return false;
  if (typeof next.accuracy === 'number' && next.accuracy > maxAccuracy) return false;
  if (!prev) return true;
  return haversineMeters(prev, next) >= minMeters;
}

// ─── GPS quality + adaptive acceptance (used by the background tracker) ─────

export type GpsQuality = 'none' | 'poor' | 'ok' | 'good';

/** Bucket a fix's horizontal accuracy (metres) for the status pill. */
export function classifyGpsQuality(accuracy?: number | null): GpsQuality {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy > 100) return 'none';
  if (accuracy > 35) return 'poor';
  if (accuracy > 15) return 'ok';
  return 'good';
}

export interface AcceptOptions {
  /** First fixes after start: looser accuracy gate so a run can begin before the GPS settles. */
  warmup?: boolean;
  maxAccuracy?: number;
  warmupMaxAccuracy?: number;
  minMeters?: number;
  /** Anything faster than this between two fixes is a GPS jump, not a runner (12 m/s ≈ 43 km/h). */
  maxSpeedMps?: number;
}

/**
 * Stricter successor to `filterPoint`: accuracy gate (looser during warm-up),
 * timestamp ordering, a minimum move that scales with the fix's own accuracy
 * (so a ±20 m fix must move ≥10 m to count, capped at 20 m), and a speed cap.
 */
export function acceptFix(prev: RoutePoint | null, next: RoutePoint, opts: AcceptOptions = {}): boolean {
  const { warmup = false, maxAccuracy = 25, warmupMaxAccuracy = 50, minMeters = 3, maxSpeedMps = 12 } = opts;
  if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng) || !Number.isFinite(next.ts)) return false;
  const acc = typeof next.accuracy === 'number' && Number.isFinite(next.accuracy) ? next.accuracy : null;
  if (acc !== null && acc > (warmup ? warmupMaxAccuracy : maxAccuracy)) return false;
  if (!prev) return true;
  if (next.ts <= prev.ts) return false;
  const dist = haversineMeters(prev, next);
  const minMove = Math.min(20, Math.max(minMeters, (acc ?? 0) * 0.5));
  if (dist < minMove) return false;
  if (dist / (next.ts - prev.ts) > maxSpeedMps) return false;
  return true;
}

/** expo-location `LocationObject` → RoutePoint (seconds, not ms). Kept structural so node tests need no RN types. */
export function locationToPoint(loc: { coords: { latitude: number; longitude: number; accuracy?: number | null }; timestamp: number }): RoutePoint {
  return { lat: loc.coords.latitude, lng: loc.coords.longitude, ts: loc.timestamp / 1000, accuracy: loc.coords.accuracy ?? null };
}

export interface MergeOptions extends Omit<AcceptOptions, 'warmup'> {
  /** Run start (seconds epoch) — drives the 30 s warm-up window. */
  startedAt?: number | null;
  /** Points accepted so far — drives the 5-point warm-up window. */
  acceptedCount?: number;
  warmupPoints?: number;
  warmupSeconds?: number;
}

export interface MergeResult {
  points: RoutePoint[];
  addedMeters: number;
  accepted: number;
  /** Newest fix seen, accepted or not — lets the UI show ±Xm while nothing counts yet. */
  lastFix: RoutePoint | null;
}

/**
 * Fold a batch of fixes (background tasks deliver several at once) into the
 * stored route: sorted by time, de-duplicated, gated by `acceptFix`.
 */
export function mergeLocationBatch(points: ReadonlyArray<RoutePoint>, incoming: ReadonlyArray<RoutePoint>, opts: MergeOptions = {}): MergeResult {
  const { startedAt = null, acceptedCount = 0, warmupPoints = 5, warmupSeconds = 30, ...gate } = opts;
  const out = [...points];
  const batch = [...incoming].filter((p) => Number.isFinite(p.ts)).sort((a, b) => a.ts - b.ts);
  let added = 0;
  let accepted = 0;
  let lastFix: RoutePoint | null = null;
  for (const p of batch) {
    if (!lastFix || p.ts >= lastFix.ts) lastFix = p;
    const prev = out[out.length - 1] ?? null;
    const count = acceptedCount + accepted;
    const warmup = count < warmupPoints || (startedAt !== null && p.ts - startedAt < warmupSeconds);
    if (!acceptFix(prev, p, { ...gate, warmup })) continue;
    if (prev) added += haversineMeters(prev, p);
    out.push(p);
    accepted++;
  }
  return { points: out, addedMeters: added, accepted, lastFix };
}

/** Elapsed seconds for a run whose timer may be mid-segment; `until` caps the segment (ms epoch). */
export function elapsedSeconds(elapsedBase: number, runningSince: number | null, until: number): number {
  const base = Number.isFinite(elapsedBase) ? Math.max(0, elapsedBase) : 0;
  if (runningSince === null || !Number.isFinite(runningSince)) return Math.floor(base);
  return Math.floor(base + Math.max(0, until - runningSince) / 1000);
}

// ─── SVG route projection (map fallback when no tiles are available) ────────

export interface XY { x: number; y: number }

/**
 * Equirectangular fit of a route into a w×h box with padding, aspect preserved
 * and centred. A single point (or zero span) lands in the middle.
 */
export function projectRoute(points: ReadonlyArray<LatLng>, width: number, height: number, pad = 16): XY[] {
  if (points.length === 0) return [];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const cos = Math.cos(toRad((minLat + maxLat) / 2)) || 1e-9;
  const spanX = (maxLng - minLng) * cos;
  const spanY = maxLat - minLat;
  const innerW = Math.max(1, width - 2 * pad);
  const innerH = Math.max(1, height - 2 * pad);
  const scale = spanX === 0 && spanY === 0 ? 0 : Math.min(spanX > 0 ? innerW / spanX : Infinity, spanY > 0 ? innerH / spanY : Infinity);
  const drawW = spanX * scale, drawH = spanY * scale;
  const offX = pad + (innerW - drawW) / 2;
  const offY = pad + (innerH - drawH) / 2;
  return points.map((p) => ({
    x: offX + (p.lng - minLng) * cos * scale,
    y: offY + (maxLat - p.lat) * scale, // north up
  }));
}

/** Build the API payload from an in-memory run. */
export function buildRunPayload(points: ReadonlyArray<RoutePoint>, startedAt: Date, endedAt: Date, durationSec: number, weightKg?: number) {
  const distanceMeters = Math.round(totalDistance(points));
  return {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    distanceMeters,
    durationSec: Math.max(1, Math.round(durationSec)),
    calories: estimateKcal(distanceMeters, weightKg),
    route: points.map((p) => ({ lat: p.lat, lng: p.lng, ts: Math.round(p.ts) })),
  };
}
