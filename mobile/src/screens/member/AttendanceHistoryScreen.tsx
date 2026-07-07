import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');
const CELL = Math.floor((width - 56) / 7);

function CalendarHeatmap({ presentDates }: { presentDates: string[] }) {
  const present = new Set(presentDates);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cells = Array.from({ length: firstDay + days }, (_, i) => {
    if (i < firstDay) return null;
    const d = i - firstDay + 1;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { day: d, present: present.has(dateStr) };
  });
  return (
    <View style={cal.wrap}>
      <Text style={cal.month}>
        {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
      </Text>
      <View style={cal.dayRow}>
        {DAYS.map((d, i) => <Text key={i} style={cal.dayLabel}>{d}</Text>)}
      </View>
      <View style={cal.grid}>
        {cells.map((cell, i) =>
          cell === null ? (
            <View key={`e${i}`} style={{ width: CELL, height: CELL }} />
          ) : (
            <View key={i} style={[cal.cell, cell.present && cal.cellPresent]}>
              <Text style={[cal.cellText, cell.present && cal.cellTextPresent]}>{cell.day}</Text>
            </View>
          )
        )}
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  wrap: { marginHorizontal: 20, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#2A2A2A' },
  month: { color: '#F9FAFB', fontWeight: '700', fontSize: 15, marginBottom: 12, textAlign: 'center' },
  dayRow: { flexDirection: 'row', marginBottom: 6 },
  dayLabel: { width: CELL, textAlign: 'center', color: '#6B7280', fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  cellPresent: { backgroundColor: '#FF4D00' },
  cellText: { color: '#4B5563', fontSize: 12 },
  cellTextPresent: { color: '#fff', fontWeight: '700' },
});

export default function AttendanceHistoryScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'calendar' | 'history'>('calendar');

  const { data: calendar, isLoading: calLoading } = useQuery({
    queryKey: ['attendance-calendar'],
    queryFn: () => api.get('/attendance/calendar') as any,
    enabled: !!user,
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['attendance-history'],
    queryFn: () => api.get('/attendance/my') as any,
    enabled: !!user && tab === 'history',
  });

  const presentDates: string[] = Array.isArray(calendar) ? calendar : (calendar as any)?.dates ?? [];
  const historyItems: any[] = Array.isArray(history) ? history : (history as any)?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Attendance</Text>
      </View>

      <View style={styles.tabs}>
        {(['calendar', 'history'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'calendar' ? 'Calendar' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'calendar' ? (
        calLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
          <CalendarHeatmap presentDates={presentDates} />
        )
      ) : (
        histLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
          <FlatList
            data={historyItems}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const checkIn = new Date(item.checkInTime);
              const checkOut = item.checkOutTime ? new Date(item.checkOutTime) : null;
              const mins = checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000) : null;
              return (
                <View style={styles.histCard}>
                  <View>
                    <Text style={styles.histDate}>{checkIn.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                    <Text style={styles.histTime}>
                      {checkIn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {checkOut ? ` → ${checkOut.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ' → Active'}
                    </Text>
                  </View>
                  {mins !== null && (
                    <Text style={styles.histDur}>{mins} min</Text>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No attendance records</Text>}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 16 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  tabs: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 20,
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#FF4D00' },
  tabText: { color: '#9CA3AF', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  histCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A',
  },
  histDate: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  histTime: { color: '#9CA3AF', fontSize: 12 },
  histDur: { color: '#FF4D00', fontSize: 14, fontWeight: '700' },
  empty: { color: '#4B5563', textAlign: 'center', marginTop: 40 },
});
