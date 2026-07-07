import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function InsightsScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-insights'],
    queryFn: () => api.get('/attendance/my-insights') as any,
  });

  const d: any = data ?? {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Fitness Insights</Text>
        <Text style={styles.sub}>Your attendance patterns and habits</Text>
      </View>

      {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.grid}>
            {[
              { label: 'Total Visits', value: d.totalVisits ?? 0, icon: '📅', suffix: '' },
              { label: 'Avg Duration', value: d.avgDurationMinutes ? `${Math.round(d.avgDurationMinutes)}` : '—', icon: '⏱️', suffix: d.avgDurationMinutes ? ' min' : '' },
              { label: 'Current Streak', value: d.currentStreak ?? 0, icon: '🔥', suffix: ' days' },
              { label: 'Best Streak', value: d.bestStreak ?? 0, icon: '🏆', suffix: ' days' },
            ].map(({ label, value, icon, suffix }) => (
              <View key={label} style={styles.statCard}>
                <Text style={styles.statIcon}>{icon}</Text>
                <Text style={styles.statValue}>{value}{suffix}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {d.favoriteDay && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Favorite Day</Text>
              <Text style={styles.infoValue}>{d.favoriteDay}</Text>
            </View>
          )}
          {d.favoritePeakHour !== undefined && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Peak Time</Text>
              <Text style={styles.infoValue}>{d.favoritePeakHour}:00 – {d.favoritePeakHour + 1}:00</Text>
            </View>
          )}
          {d.attendanceRate !== undefined && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Attendance Rate (30 days)</Text>
              <Text style={styles.infoValue}>{Math.round(d.attendanceRate * 100)}%</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  sub: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
  statCard: {
    width: '47%', backgroundColor: '#1A1A1A', borderRadius: 14, padding: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  statIcon: { fontSize: 28, marginBottom: 8 },
  statValue: { color: '#FF4D00', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 4, textAlign: 'center' },
  infoCard: {
    marginHorizontal: 20, marginBottom: 10, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2A2A2A',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  infoLabel: { color: '#9CA3AF', fontSize: 14 },
  infoValue: { color: '#F9FAFB', fontSize: 14, fontWeight: '700' },
});
