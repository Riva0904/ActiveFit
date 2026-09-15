import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoutePoint } from './run';

/**
 * Snapshot of an in-progress run. Written by the run store every few fixes so a
 * run survives the app being killed mid-way (the location task keeps running
 * headlessly; on relaunch we rehydrate and keep appending).
 */
export interface RunSnapshot {
  status: 'running' | 'paused';
  mode: 'background' | 'foreground';
  startedAt: number;          // ms epoch
  elapsedBase: number;        // seconds accumulated before the open segment
  runningSince: number | null; // ms epoch of the open segment, null when paused
  points: RoutePoint[];
  distanceMeters: number;
  acceptedCount: number;
  savedAt: number;            // ms epoch
}

const KEY = 'ab_active_run';
/** Anything older than this is a stale run we should not resurrect. */
export const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export async function saveRunSnapshot(snapshot: RunSnapshot): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(snapshot)); } catch { /* storage full / unavailable: non-fatal */ }
}

export async function loadRunSnapshot(now = Date.now()): Promise<RunSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as RunSnapshot;
    if (!snap || typeof snap.savedAt !== 'number' || now - snap.savedAt > SNAPSHOT_MAX_AGE_MS) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    if (!Array.isArray(snap.points)) snap.points = [];
    return snap;
  } catch {
    return null;
  }
}

export async function clearRunSnapshot(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}
