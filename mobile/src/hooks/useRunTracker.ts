import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { buildRunPayload, paceSecPerKm, type GpsQuality, type LatLng, type RoutePoint } from '../lib/run';
import { FOREGROUND_WATCH_OPTIONS, RUN_LOCATION_TASK, RUN_TASK_OPTIONS } from '../lib/runTask';
import { useRunStore, type RunMode, type RunStatus } from '../store/runStore';

export type { RunStatus };

export interface RunTracker {
  status: RunStatus;
  mode: RunMode | null;
  points: RoutePoint[];
  distanceMeters: number;
  elapsedSec: number;
  paceSecPerKm: number | null;
  startedAt: Date | null;
  error: string | null;
  notice: string | null;
  interrupted: boolean;
  /** True once at least one fix has arrived (accepted or not). */
  hasFix: boolean;
  gpsAccuracy: number | null;
  gpsQuality: GpsQuality;
  seedCenter: LatLng | null;
  start: () => Promise<boolean>;
  pause: () => void;
  resume: () => void;
  /** Stops tracking and returns the API payload (null if nothing usable was recorded). */
  stop: () => ReturnType<typeof buildRunPayload> | null;
  reset: () => void;
  openLocationSettings: () => void;
}

const noop = () => {};
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  new Promise<T | null>((resolve) => { const t = setTimeout(() => resolve(null), ms); p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(null); }); });

async function stopAllTracking(watch: { current: Location.LocationSubscription | null }) {
  watch.current?.remove(); watch.current = null;
  try { if (await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK)) await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK); } catch { /* not registered */ }
}

/**
 * GPS run tracker. The run itself lives in `useRunStore` (fed by the background
 * location task in `lib/runTask.ts`); this hook owns permissions, start/stop of
 * the task, the foreground fallback watcher, and a 1 s ticker for the UI.
 *
 * Android: foreground service → tracking continues with the screen off and after
 * the app is swiped away. iOS: UIBackgroundModes location. Expo Go: falls back
 * to a foreground-only watcher.
 */
export function useRunTracker(weightKg?: number): RunTracker {
  const store = useRunStore();
  const watch = useRef<Location.LocationSubscription | null>(null);
  const [tick, setTick] = useState(0);

  // 1 s ticker while running; also refresh the moment the app returns to the foreground.
  useEffect(() => {
    if (store.status !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setTick((t) => t + 1); });
    return () => { clearInterval(id); sub.remove(); };
  }, [store.status]);

  // Unmounting the screen must NOT stop the task — only the foreground fallback watcher.
  useEffect(() => () => { watch.current?.remove(); watch.current = null; }, []);

  const openLocationSettings = useCallback(() => { Linking.openSettings().catch(noop); }, []);

  const startForegroundWatch = useCallback(async () => {
    watch.current?.remove();
    watch.current = await Location.watchPositionAsync(FOREGROUND_WATCH_OPTIONS, (loc) => useRunStore.getState().ingest([loc]));
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    const s = useRunStore.getState();
    s.setError(null); s.setNotice(null); s.setStatus('requesting');
    const fail = (msg: string) => { useRunStore.getState().setStatus('idle'); useRunStore.getState().setError(msg); return false; };

    try {
      // 1. Foreground permission.
      let perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        return fail(perm.canAskAgain
          ? 'Location permission is required to track a run.'
          : 'Location permission is off for ActiveBoost. Enable it in Settings.');
      }
      // 2. Android 12+: "Approximate" gives ~2 km fixes — useless for a run. Ask once more (OS shows the upgrade dialog).
      if (Platform.OS === 'android' && perm.android?.accuracy === 'coarse') {
        perm = await Location.requestForegroundPermissionsAsync();
        if (perm.android?.accuracy === 'coarse') {
          return fail('Precise location is off. In Settings → ActiveBoost → Location, turn on "Use precise location".');
        }
      }
      // 3. Android 13+: the foreground-service notification needs this; denial is non-fatal.
      if (Platform.OS === 'android') await Notifications.requestPermissionsAsync().catch(noop);
      // 4. Device location services.
      if (!(await Location.hasServicesEnabledAsync())) {
        if (Platform.OS === 'android') {
          try { await Location.enableNetworkProviderAsync(); } catch { return fail('Turn on location services (GPS) to track a run.'); }
        } else {
          return fail('Turn on Location Services in Settings to track a run.');
        }
      }

      // 5. Seed the map immediately, then take a first precise fix (bounded wait).
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 }).catch(() => null);
      if (last) useRunStore.getState().seed(last);

      // 6. Start the run — points are only counted from here on.
      useRunStore.getState().begin('background');
      void withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }), 8000)
        .then((loc) => { if (loc) useRunStore.getState().ingest([loc]); });

      try {
        await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, RUN_TASK_OPTIONS);
      } catch (e: any) {
        // Expo Go, missing background mode, or FGS not allowed → still track while the app is open.
        useRunStore.getState().setMode('foreground');
        useRunStore.getState().setNotice('Background tracking unavailable on this build — keep the app open while you run.');
        await startForegroundWatch();
      }
      return true;
    } catch (e: any) {
      await stopAllTracking(watch);
      return fail(e?.message ?? 'Could not start location tracking');
    }
  }, [startForegroundWatch]);

  const pause = useCallback(() => { useRunStore.getState().pause(); }, []);

  const resume = useCallback(() => {
    const s = useRunStore.getState();
    s.resume();
    // After a force-stop the task is gone: restart tracking (app is in the foreground here, which Android requires).
    void (async () => {
      const live = await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK).catch(() => false);
      if (live || watch.current) return;
      try {
        await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, RUN_TASK_OPTIONS);
        useRunStore.getState().setMode('background');
      } catch {
        useRunStore.getState().setMode('foreground');
        await startForegroundWatch().catch(noop);
      }
    })();
  }, [startForegroundWatch]);

  const stop = useCallback(() => {
    const s = useRunStore.getState();
    const startedAt = s.startedAt;
    const points = s.points;
    const elapsed = s.elapsedNow();
    s.finish();
    void stopAllTracking(watch);
    if (startedAt === null || points.length < 2) return null;
    return buildRunPayload(points, new Date(startedAt), new Date(), Math.max(1, elapsed), weightKg);
  }, [weightKg]);

  const reset = useCallback(() => {
    useRunStore.getState().reset();
    void stopAllTracking(watch);
  }, []);

  const elapsedSec = store.elapsedNow();
  void tick; // re-render driver
  return {
    status: store.status,
    mode: store.mode,
    points: store.points,
    distanceMeters: store.distanceMeters,
    elapsedSec,
    paceSecPerKm: paceSecPerKm(store.distanceMeters, elapsedSec),
    startedAt: store.startedAt !== null ? new Date(store.startedAt) : null,
    error: store.error,
    notice: store.notice,
    interrupted: store.interrupted,
    hasFix: store.lastFix !== null,
    gpsAccuracy: store.lastFix?.accuracy ?? null,
    gpsQuality: store.gpsQuality(),
    seedCenter: store.seedCenter,
    start, pause, resume, stop, reset, openLocationSettings,
  };
}
