import { create } from 'zustand';
import { localDateKey } from '../lib/weekly';

/**
 * Local-only toggles for the Home checklist items that have no server state yet
 * (workout done / diet followed). Keyed by local date so they reset each day.
 * v1 is in-memory: clears on app restart. Persisting (AsyncStorage) is a follow-up.
 */
interface DailyChecklistState {
  done: Record<string, Record<string, boolean>>; // { 'YYYY-MM-DD': { workout: true } }
  isDone: (key: string, date?: Date) => boolean;
  toggle: (key: string, date?: Date) => void;
}

export const useDailyChecklistStore = create<DailyChecklistState>((set, get) => ({
  done: {},
  isDone: (key, date = new Date()) => !!get().done[localDateKey(date)]?.[key],
  toggle: (key, date = new Date()) => {
    const day = localDateKey(date);
    set((s) => ({ done: { ...s.done, [day]: { ...(s.done[day] ?? {}), [key]: !s.done[day]?.[key] } } }));
  },
}));
