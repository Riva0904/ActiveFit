import React, { useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Card, EmptyState, Header, Loading, Screen } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

const { width } = Dimensions.get('window');
const CELL = Math.floor((width - spacing.screen * 2 - spacing.lg * 2 - 2) / 7);
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CalendarHeatmap({ presentDates }: { presentDates: string[] }) {
  const present = new Set(presentDates);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: firstDay + days }, (_, i) => {
    if (i < firstDay) return null;
    const d = i - firstDay + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { day: d, present: present.has(dateStr), today: d === now.getDate() };
  });
  return (
    <Card>
      <Text style={cal.month}>{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
      <View style={cal.dayRow}>
        {DAY_LETTERS.map((d, i) => <Text key={i} style={cal.dayLabel}>{d}</Text>)}
      </View>
      <View style={cal.grid}>
        {cells.map((cell, i) =>
          cell === null ? (
            <View key={`e${i}`} style={{ width: CELL, height: CELL }} />
          ) : (
            <View key={i} style={[cal.cell, cell.present && cal.cellPresent, cell.today && !cell.present && cal.cellToday]}>
              <Text style={[cal.cellText, cell.present && cal.cellTextPresent]}>{cell.day}</Text>
            </View>
          ),
        )}
      </View>
      <Text style={cal.summary}>{presentDates.length} visit{presentDates.length === 1 ? '' : 's'} this month</Text>
    </Card>
  );
}

const cal = StyleSheet.create({
  month: { color: colors.text, ...typography.body, fontWeight: '700', marginBottom: spacing.md, textAlign: 'center' },
  dayRow: { flexDirection: 'row', marginBottom: 6 },
  dayLabel: { width: CELL, textAlign: 'center', color: colors.textMuted, ...typography.micro, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  cellPresent: { backgroundColor: colors.primary },
  cellToday: { borderWidth: 1, borderColor: colors.primary },
  cellText: { color: colors.textFaint, ...typography.caption, ...typography.number },
  cellTextPresent: { color: colors.white, fontWeight: '700' },
  summary: { color: colors.textSecondary, ...typography.caption, textAlign: 'center', marginTop: spacing.md },
});

export default function AttendanceHistoryScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'calendar' | 'history'>('calendar');

  const now = new Date();
  const { data: calendar, isLoading: calLoading } = useQuery({
    queryKey: ['attendance-calendar', now.getMonth(), now.getFullYear()],
    queryFn: () => api.get('/attendance/calendar', { params: { month: now.getMonth() + 1, year: now.getFullYear() } }) as any,
    enabled: !!user,
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['attendance-history'],
    queryFn: () => api.get('/attendance/my') as any,
    enabled: !!user && tab === 'history',
  });

  const presentDates: string[] = (calendar as any)?.presentDates ?? [];
  const historyItems: any[] = Array.isArray(history) ? history : (history as any)?.data ?? [];

  return (
    <Screen>
      <Header title="Attendance" onBack={() => navigation.goBack()} />

      <View style={styles.tabs}>
        {(['calendar', 'history'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'calendar' ? 'Calendar' : 'History'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'calendar' ? (
        calLoading ? <Loading /> : <CalendarHeatmap presentDates={presentDates} />
      ) : histLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={historyItems}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const checkIn = new Date(item.checkInTime);
            const checkOut = item.checkOutTime ? new Date(item.checkOutTime) : null;
            const mins = checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : null;
            return (
              <Card padding="md" style={styles.histCard}>
                <View>
                  <Text style={styles.histDate}>{checkIn.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                  <Text style={styles.histTime}>
                    {checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {checkOut ? ` → ${checkOut.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ' → Active'}
                  </Text>
                </View>
                {mins !== null ? <Text style={styles.histDur}>{mins} min</Text> : <Text style={styles.histActive}>●</Text>}
              </Card>
            );
          }}
          ListEmptyComponent={<EmptyState icon="calendar" title="No attendance records" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', marginBottom: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.surfaceRaised },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textSecondary, ...typography.label, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  histCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  histDate: { color: colors.text, ...typography.body, fontWeight: '600', marginBottom: 2 },
  histTime: { color: colors.textSecondary, ...typography.caption },
  histDur: { color: colors.primary, ...typography.body, fontWeight: '700', ...typography.number },
  histActive: { color: colors.success, fontSize: 12 },
});
