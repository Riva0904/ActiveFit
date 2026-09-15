import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { buildRunPayload, filterPoint, haversineMeters, paceSecPerKm, type RoutePoint } from '../lib/run';

export type RunStatus = 'idle' | 'requesting' | 'running' | 'paused' | 'finished';

export interface RunState {
  status: RunStatus;
  points: RoutePoint[];
  distanceMeters: number;
  elapsedSec: number;
  paceSecPerKm: number | null;
  startedAt: Date | null;
  error: string | null;
  /** True once at least one GPS fix has arrived — lets the UI say "waiting for GPS". */
  hasFix: boolean;
}

const INITIAL: RunState = { status: 'idle', points: [], distanceMeters: 0, elapsedSec: 0, paceSecPerKm: null, startedAt: null, error: null, hasFix: false };

/**
 * Foreground GPS run tracker (v1). Subscribes to expo-location while the screen is
 * open, filters jitter, accumulates distance, and produces the CreateRunDto payload
 * on stop. Background tracking (task manager + extra permissions) is deliberately
 * out of scope for now.
 *
 * The authoritative run data lives in refs (points/distance/elapsed) and is mirrored
 * into state for rendering — `stop()` must read synchronously, and React 19 defers
 * setState updater functions to render time.
 */
export function useRunTracker(weightKg?: number) {
  const [state, setState] = useState<RunState>(INITIAL);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const points = useRef<RoutePoint[]>([]);
  const distance = useRef(0);
  const startedAt = useRef<Date | null>(null);
  const runningSince = useRef<number | null>(null); // ms epoch when the current running segment began
  const elapsedBase = useRef(0); // seconds accumulated before the current segment

  const stopWatching = () => { sub.current?.remove(); sub.current = null; };
  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const elapsedNow = () => elapsedBase.current + (runningSince.current !== null ? Math.floor((Date.now() - runningSince.current) / 1000) : 0);

  const tick = useCallback(() => {
    const elapsed = elapsedNow();
    setState((s) => ({ ...s, elapsedSec: elapsed, paceSecPerKm: paceSecPerKm(distance.current, elapsed) }));
  }, []);

  const startWatching = useCallback(async () => {
    stopWatching();
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 3 },
      (loc) => {
        const p: RoutePoint = { lat: loc.coords.latitude, lng: loc.coords.longitude, ts: Math.round(loc.timestamp / 1000), accuracy: loc.coords.accuracy };
        const prev = points.current[points.current.length - 1] ?? null;
        if (!filterPoint(prev, p)) { setState((s) => (s.hasFix ? s : { ...s, hasFix: true })); return; }
        if (prev) distance.current += haversineMeters(prev, p);
        points.current = [...points.current, p];
        const elapsed = elapsedNow();
        setState((s) => ({ ...s, hasFix: true, points: points.current, distanceMeters: distance.current, paceSecPerKm: paceSecPerKm(distance.current, elapsed) }));
      },
    );
  }, []);

  const start = useCallback(async () => {
    setState({ ...INITIAL, status: 'requesting' });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState({ ...INITIAL, error: 'Location permission is required to track a run. Enable it in Settings.' });
        return false;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setState({ ...INITIAL, error: 'Turn on location services (GPS) to track a run.' });
        return false;
      }
      points.current = [];
      distance.current = 0;
      elapsedBase.current = 0;
      startedAt.current = new Date();
      runningSince.current = Date.now();
      setState({ ...INITIAL, status: 'running', startedAt: startedAt.current });
      await startWatching();
      timer.current = setInterval(tick, 1000);
      return true;
    } catch (e: any) {
      setState({ ...INITIAL, error: e?.message ?? 'Could not start location tracking' });
      return false;
    }
  }, [startWatching, tick]);

  const pause = useCallback(() => {
    elapsedBase.current = elapsedNow();
    runningSince.current = null;
    stopWatching(); stopTimer();
    setState((s) => ({ ...s, status: 'paused', elapsedSec: elapsedBase.current }));
  }, []);

  const resume = useCallback(async () => {
    runningSince.current = Date.now();
    setState((s) => ({ ...s, status: 'running' }));
    await startWatching();
    timer.current = setInterval(tick, 1000);
  }, [startWatching, tick]);

  /** Stops tracking and returns the API payload (null if nothing usable was recorded). */
  const stop = useCallback(() => {
    elapsedBase.current = elapsedNow();
    runningSince.current = null;
    stopWatching(); stopTimer();
    setState((s) => ({ ...s, status: 'finished', elapsedSec: elapsedBase.current }));
    if (!startedAt.current || points.current.length < 2) return null;
    return buildRunPayload(points.current, startedAt.current, new Date(), Math.max(1, elapsedBase.current), weightKg);
  }, [weightKg]);

  const reset = useCallback(() => {
    stopWatching(); stopTimer();
    points.current = []; distance.current = 0; startedAt.current = null; runningSince.current = null; elapsedBase.current = 0;
    setState(INITIAL);
  }, []);

  useEffect(() => () => { stopWatching(); stopTimer(); }, []);

  return { ...state, start, pause, resume, stop, reset };
}
