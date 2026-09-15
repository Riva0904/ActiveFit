import { create } from 'zustand';
import * as Location from 'expo-location';
import { classifyGpsQuality, elapsedSeconds, locationToPoint, mergeLocationBatch, type GpsQuality, type LatLng, type RoutePoint } from '../lib/run';
import { clearRunSnapshot, loadRunSnapshot, saveRunSnapshot, type RunSnapshot } from '../lib/runPersistence';
import { RUN_LOCATION_TASK } from '../lib/runTaskName';

export type RunStatus = 'idle' | 'requesting' | 'running' | 'paused' | 'finished';
export type RunMode = 'background' | 'foreground';

interface RunState {
  status: RunStatus;
  mode: RunMode | null;
  points: RoutePoint[];
  distanceMeters: number;
  startedAt: number | null;      // ms epoch
  elapsedBase: number;           // seconds before the open segment
  runningSince: number | null;   // ms epoch of the open segment
  lastFix: RoutePoint | null;    // newest fix, accepted or not
  seedCenter: LatLng | null;     // last-known position, for centring the map before the first fix
  acceptedCount: number;
  error: string | null;
  /** Non-fatal information ("Background tracking unavailable…"). */
  notice: string | null;
  /** True when the app was killed/force-stopped mid-run and the timer had to be cut at the last save. */
  interrupted: boolean;
  hydrated: boolean;

  begin: (mode: RunMode) => void;
  setStatus: (status: RunStatus) => void;
  setMode: (mode: RunMode) => void;
  seed: (loc: Location.LocationObject) => void;
  /** Entry point for both the background task and the foreground watcher. Ignored unless running. */
  ingest: (locations: ReadonlyArray<Location.LocationObject>) => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;
  setError: (error: string | null) => void;
  setNotice: (notice: string | null) => void;
  elapsedNow: (now?: number) => number;
  gpsQuality: () => GpsQuality;
  /** Restore an in-progress run after a relaunch. Resolves true when one was found. */
  hydrate: () => Promise<boolean>;
}

const INITIAL = {
  status: 'idle' as RunStatus, mode: null, points: [] as RoutePoint[], distanceMeters: 0, startedAt: null, elapsedBase: 0,
  runningSince: null, lastFix: null, seedCenter: null, acceptedCount: 0, error: null, notice: null, interrupted: false,
};

// Persist throttle (module-level; not part of React state).
let lastPersistAt = 0;
let acceptedAtPersist = 0;
const PERSIST_EVERY_POINTS = 10;
const PERSIST_EVERY_MS = 15_000;

function snapshotOf(s: RunState): RunSnapshot | null {
  if ((s.status !== 'running' && s.status !== 'paused') || s.startedAt === null || !s.mode) return null;
  return {
    status: s.status, mode: s.mode, startedAt: s.startedAt, elapsedBase: s.elapsedBase, runningSince: s.runningSince,
    points: s.points, distanceMeters: s.distanceMeters, acceptedCount: s.acceptedCount, savedAt: Date.now(),
  };
}

function persist(s: RunState, force = false) {
  const snap = snapshotOf(s);
  if (!snap) return;
  const due = force || s.acceptedCount - acceptedAtPersist >= PERSIST_EVERY_POINTS || Date.now() - lastPersistAt >= PERSIST_EVERY_MS;
  if (!due) return;
  lastPersistAt = Date.now();
  acceptedAtPersist = s.acceptedCount;
  void saveRunSnapshot(snap);
}

export const useRunStore = create<RunState>((set, get) => ({
  ...INITIAL,
  hydrated: false,

  begin: (mode) => {
    lastPersistAt = 0; acceptedAtPersist = 0;
    const now = Date.now();
    set({ ...INITIAL, mode, status: 'running', startedAt: now, runningSince: now, seedCenter: get().seedCenter, hydrated: true });
    persist(get(), true);
  },
  setStatus: (status) => set({ status }),
  setMode: (mode) => set({ mode }),
  seed: (loc) => set({ seedCenter: { lat: loc.coords.latitude, lng: loc.coords.longitude } }),

  ingest: (locations) => {
    const s = get();
    if (locations.length === 0) return;
    const incoming = locations.map(locationToPoint);
    if (s.status !== 'running') {
      // Paused / not started: keep the pill honest but count nothing.
      const newest = incoming.reduce((a, b) => (b.ts >= a.ts ? b : a));
      set({ lastFix: newest, seedCenter: s.seedCenter ?? { lat: newest.lat, lng: newest.lng } });
      return;
    }
    const r = mergeLocationBatch(s.points, incoming, {
      startedAt: s.startedAt !== null ? s.startedAt / 1000 : null,
      acceptedCount: s.acceptedCount,
    });
    set({
      points: r.points,
      distanceMeters: s.distanceMeters + r.addedMeters,
      acceptedCount: s.acceptedCount + r.accepted,
      lastFix: r.lastFix ?? s.lastFix,
      seedCenter: s.seedCenter ?? (r.lastFix ? { lat: r.lastFix.lat, lng: r.lastFix.lng } : null),
    });
    if (r.accepted > 0) persist(get());
  },

  pause: () => {
    const s = get();
    if (s.status !== 'running') return;
    set({ status: 'paused', elapsedBase: elapsedSeconds(s.elapsedBase, s.runningSince, Date.now()), runningSince: null });
    persist(get(), true);
  },
  resume: () => {
    const s = get();
    if (s.status !== 'paused') return;
    set({ status: 'running', runningSince: Date.now(), interrupted: false });
    persist(get(), true);
  },
  finish: () => {
    const s = get();
    set({ status: 'finished', elapsedBase: elapsedSeconds(s.elapsedBase, s.runningSince, Date.now()), runningSince: null });
    void clearRunSnapshot();
  },
  reset: () => {
    set({ ...INITIAL, hydrated: true });
    void clearRunSnapshot();
  },
  setError: (error) => set({ error }),
  setNotice: (notice) => set({ notice }),
  elapsedNow: (now = Date.now()) => { const s = get(); return elapsedSeconds(s.elapsedBase, s.runningSince, now); },
  gpsQuality: () => classifyGpsQuality(get().lastFix?.accuracy),

  hydrate: async () => {
    const snap = await loadRunSnapshot();
    if (!snap) { set({ hydrated: true }); return false; }
    let live = false;
    try { live = await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK); } catch { live = false; }
    const last = snap.points[snap.points.length - 1] ?? null;
    if (live && snap.mode === 'background') {
      // Task survived (swiped from Recents): timer and points simply continue.
      set({
        ...INITIAL, hydrated: true, status: snap.status, mode: snap.mode, startedAt: snap.startedAt, elapsedBase: snap.elapsedBase,
        runningSince: snap.runningSince, points: snap.points, distanceMeters: snap.distanceMeters, acceptedCount: snap.acceptedCount,
        lastFix: last, seedCenter: last ? { lat: last.lat, lng: last.lng } : null,
      });
    } else {
      // Process was force-stopped: count time only up to the last save and wait for the user to resume.
      set({
        ...INITIAL, hydrated: true, status: 'paused', mode: snap.mode, startedAt: snap.startedAt,
        elapsedBase: elapsedSeconds(snap.elapsedBase, snap.runningSince, snap.savedAt), runningSince: null,
        points: snap.points, distanceMeters: snap.distanceMeters, acceptedCount: snap.acceptedCount,
        lastFix: last, seedCenter: last ? { lat: last.lat, lng: last.lng } : null, interrupted: snap.status === 'running',
      });
    }
    return true;
  },
}));
