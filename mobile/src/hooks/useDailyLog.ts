import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { localDateKey } from '../lib/weekly';

/**
 * The member's day: Home checklist ticks, water and calories.
 *
 * This used to be an in-memory zustand store, so a tick was lost the moment the
 * app restarted and no trainer or admin could ever see it. State now lives in
 * `member_daily_logs` server-side; writes are optimistic so the checkbox still
 * flips instantly.
 *
 * The day key is the *device's* local date — a member in IST ticking an item at
 * 00:30 writes today, not the server's yesterday.
 */
export interface DailyLog {
  date: string;
  items: Record<string, boolean>;
  waterMl: number;
  caloriesIn: number | null;
  notes: string | null;
}

const EMPTY: DailyLog = { date: '', items: {}, waterMl: 0, caloriesIn: null, notes: null };

export function dailyLogKey(date = localDateKey(new Date())) {
  return ['daily-log', date] as const;
}

export function useDailyLog(enabled = true) {
  const queryClient = useQueryClient();
  const date = localDateKey(new Date());
  const key = dailyLogKey(date);

  const { data, isLoading } = useQuery<DailyLog>({
    queryKey: key,
    queryFn: () => api.get('/mobile/daily-log', { params: { date } }) as any,
    enabled,
    staleTime: 60_000,
  });

  const log = data ?? { ...EMPTY, date };

  const mutation = useMutation({
    mutationFn: (body: Partial<DailyLog>) => api.put('/mobile/daily-log', { date, ...body }) as any,
    // Optimistic: the tick must not wait for the round-trip.
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DailyLog>(key);
      queryClient.setQueryData<DailyLog>(key, { ...(previous ?? { ...EMPTY, date }), ...body });
      return { previous };
    },
    onError: (_e, _body, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const isDone = useCallback((itemKey: string) => log.items[itemKey] === true, [log.items]);

  const toggle = useCallback(
    (itemKey: string) => {
      mutation.mutate({ items: { ...log.items, [itemKey]: !log.items[itemKey] } });
    },
    [log.items, mutation],
  );

  const setWater = useCallback((waterMl: number) => mutation.mutate({ waterMl: Math.max(0, waterMl) }), [mutation]);
  const setCalories = useCallback((caloriesIn: number) => mutation.mutate({ caloriesIn: Math.max(0, caloriesIn) }), [mutation]);

  return { log, isLoading, isDone, toggle, setWater, setCalories, saving: mutation.isPending };
}
