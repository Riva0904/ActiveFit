import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, Header, Icon, Loading, Screen, type IconName } from '../../components';
import { colors, spacing, tint, typography } from '../../theme';

export default function InsightsScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-insights'],
    queryFn: () => api.get('/attendance/my-insights') as any,
  });

  const d: any = data ?? {};
  const stats: { label: string; value: string | number; icon: IconName; color: string }[] = [
    { label: 'Total visits', value: d.totalVisits ?? 0, icon: 'calendar', color: colors.primary },
    { label: 'Avg duration', value: d.avgDuration ? `${Math.round(d.avgDuration)} min` : '—', icon: 'clock', color: colors.info },
    { label: 'Current streak', value: `${d.currentStreak ?? 0} days`, icon: 'fire', color: colors.warning },
    { label: 'Best streak', value: `${d.bestStreak ?? 0} days`, icon: 'trophy-outline', color: colors.success },
  ];

  return (
    <Screen scroll>
      <Header title="Fitness Insights" subtitle="Your attendance patterns and habits" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <View style={styles.grid}>
            {stats.map((s) => (
              <Card key={s.label} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: tint(s.color) }]}><Icon name={s.icon} size={20} color={s.color} /></View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </Card>
            ))}
          </View>

          {d.favoriteDay ? (
            <Card padding="md" style={styles.infoCard}>
              <Text style={styles.infoLabel}>Favourite day</Text>
              <Text style={styles.infoValue}>{String(d.favoriteDay).charAt(0) + String(d.favoriteDay).slice(1).toLowerCase()}</Text>
            </Card>
          ) : null}
          {d.favoriteHour !== undefined && d.favoriteHour !== null ? (
            <Card padding="md" style={styles.infoCard}>
              <Text style={styles.infoLabel}>Peak time</Text>
              <Text style={styles.infoValue}>{d.favoriteHour}</Text>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  statCard: { width: '47.5%', alignItems: 'center', paddingVertical: spacing.xl, marginBottom: 0 },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { color: colors.text, ...typography.title, ...typography.number },
  statLabel: { color: colors.textSecondary, ...typography.micro, marginTop: spacing.xs, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  infoLabel: { color: colors.textSecondary, ...typography.body },
  infoValue: { color: colors.text, ...typography.body, fontWeight: '700' },
});
