import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { bucketWeekMinutes, bucketWeekPresence, type HistoryRow } from '../lib/weekly';

/**
 * This week's gym minutes per day (Sun–Sat) for the bar chart.
 * Primary source: /attendance/history (real durations). Fallback when no durations
 * exist yet this week: /attendance/calendar presence → equal-height bars.
 */
export function useWeeklyActivity(enabled: boolean) {
  const now = new Date();

  const history = useQuery({
    queryKey: ['attendance-history-week'],
    queryFn: () => api.get('/attendance/history', { params: { limit: 60 } }) as any,
    enabled,
    staleTime: 5 * 60_000,
  });

  const calendar = useQuery({
    queryKey: ['attendance-calendar', now.getMonth(), now.getFullYear()],
    queryFn: () => api.get('/attendance/calendar', { params: { month: now.getMonth() + 1, year: now.getFullYear() } }) as any,
    enabled,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const raw: any[] = Array.isArray(history.data) ? history.data : (history.data as any)?.data ?? [];
    // Tolerate both shapes: { date, durationMinutes } and { checkInTime, checkOutTime }.
    const rows: HistoryRow[] = raw.map((r) => {
      const date = r.date ?? r.checkInTime ?? r.checkIn;
      let mins = r.durationMinutes;
      if ((mins === undefined || mins === null) && r.checkInTime && r.checkOutTime) {
        mins = Math.round((new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 60000);
      }
      return { date, durationMinutes: mins ?? null };
    });
    const minutes = bucketWeekMinutes(rows, now);
    const presence = bucketWeekPresence((calendar.data as any)?.presentDates ?? [], now);
    const hasMagnitude = minutes.some((m) => m > 0);
    const values = hasMagnitude ? minutes : presence.map((p) => (p ? 1 : 0));
    const todayIdx = now.getDay();
    return {
      values,
      presence,
      unit: hasMagnitude ? 'min' : undefined,
      highlightIndex: todayIdx,
      highlightLabel: hasMagnitude && minutes[todayIdx] > 0 ? `${minutes[todayIdx]} min` : undefined,
      totalMinutes: minutes.reduce((a, b) => a + b, 0),
      visits: presence.filter(Boolean).length,
      isLoading: history.isLoading || calendar.isLoading,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.data, calendar.data, history.isLoading, calendar.isLoading]);
}
