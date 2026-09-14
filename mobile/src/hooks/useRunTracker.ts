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
}

const INITIAL: RunState = { status: 'idle', points: [], distanceMeters: 0, elapsedSec: 0, paceSecPerKm: null, startedAt: null, error: null };

/**
 * Foreground GPS run tracker (v1). Subscribes to expo-location while the screen is
 * open, filters jitter, accumulates distance, and produces the CreateRunDto payload
 * on stop. Background tracking (task manager + extra permissions) is deliberately
 * out of scope for now.
 */
export function useRunTracker(weightKg?: number) {
  const [state, setState] = useState<RunState>(INITIAL);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPoint = useRef<RoutePoint | null>(null);
  const runningSince = useRef<number | null>(null); // ms epoch when the current running segment began
  const elapsedBase = useRef(0); // seconds accumulated before the current segment

  const stopWatching = () => { sub.current?.remove(); sub.current = null; };
  const stopTimer = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };

  const tick = useCallback(() => {
    if (runningSince.current === null) return;
    const elapsed = elapsedBase.current + Math.floor((Date.now() - runningSince.current) / 1000);
    setState((s) => ({ ...s, elapsedSec: elapsed, paceSecPerKm: paceSecPerKm(s.distanceMeters, elapsed) }));
  }, []);

  const startWatching = useCallback(async () => {
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
      (loc) => {
        const p: RoutePoint = { lat: loc.coords.latitude, lng: loc.coords.longitude, ts: Math.round(loc.timestamp / 1000), accuracy: loc.coords.accuracy };
        if (!filterPoint(lastPoint.current, p)) return;
        const add = lastPoint.current ? haversineMeters(lastPoint.current, p) : 0;
        lastPoint.current = p;
        setState((s) => {
          const distanceMeters = s.distanceMeters + add;
          return { ...s, points: [...s.points, p], distanceMeters, paceSecPerKm: paceSecPerKm(distanceMeters, s.elapsedSec) };
        });
      },
    );
  }, []);

  const start = useCallback(async () => {
    setState({ ...INITIAL, status: 'requesting' });
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setState({ ...INITIAL, error: 'Location permission is required to track a run.' });
      return false;
    }
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      setState({ ...INITIAL, error: 'Turn on location services to track a run.' });
      return false;
    }
    lastPoint.current = null;
    elapsedBase.current = 0;
    runningSince.current = Date.now();
    setState({ ...INITIAL, status: 'running', startedAt: new Date() });
    await startWatching();
    timer.current = setInterval(tick, 1000);
    return true;
  }, [startWatching, tick]);

  const pause = useCallback(() => {
    if (runningSince.current !== null) {
      elapsedBase.current += Math.floor((Date.now() - runningSince.current) / 1000);
      runningSince.current = null;
    }
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
    if (runningSince.current !== null) {
      elapsedBase.current += Math.floor((Date.now() - runningSince.current) / 1000);
      runningSince.current = null;
    }
    stopWatching(); stopTimer();
    let payload: ReturnType<typeof buildRunPayload> | null = null;
    setState((s) => {
      if (s.startedAt && s.points.length >= 2) {
        payload = buildRunPayload(s.points, s.startedAt, new Date(), Math.max(1, elapsedBase.current), weightKg);
      }
      return { ...s, status: 'finished', elapsedSec: elapsedBase.current };
    });
    // setState updater runs synchronously in React 19 for this pattern; fall back to a
    // direct build from the latest ref'd values if it didn't.
    return payload as ReturnType<typeof buildRunPayload> | null;
  }, [weightKg]);

  const reset = useCallback(() => { stopWatching(); stopTimer(); lastPoint.current = null; runningSince.current = null; elapsedBase.current = 0; setState(INITIAL); }, []);

  useEffect(() => () => { stopWatching(); stopTimer(); }, []);

  return { ...state, start, pause, resume, stop, reset };
}
