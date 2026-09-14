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
