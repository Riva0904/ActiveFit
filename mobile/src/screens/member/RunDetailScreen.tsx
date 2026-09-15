import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { estimateKcal, formatDistance, formatDuration, formatPace } from '../../lib/run';
import { Card, EmptyState, Header, HeroStat, Icon, Loading, Screen, StatRow } from '../../components';
import { RunMap } from '../../components/widgets/RunMap';
import { colors, spacing, tint, typography } from '../../theme';
import type { ActivityRun } from '../../types';

export default function RunDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { data: run, isLoading } = useQuery<ActivityRun>({
    queryKey: ['runs', id],
    queryFn: () => api.get(`/activities/runs/${id}`) as any,
    enabled: !!id,
  });

  return (
    <Screen scroll>
      <Header title="Run" subtitle={run ? new Date(run.startedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined} onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : !run ? (
        <EmptyState icon="run" title="Run not found" />
      ) : (
        <>
          {run.route && run.route.length >= 2 ? <RunMap route={run.route} style={styles.map} /> : null}
          <Card style={styles.summary}>
            <View style={styles.titleRow}>
              <View style={styles.runIcon}><Icon name="run" size={18} color={colors.primary} /></View>
              <Text style={styles.title}>Running</Text>
            </View>
            <HeroStat value={formatDistance(run.distanceMeters)} label="Distance" />
            <StatRow style={styles.stats} items={[
              { label: 'Time', value: formatDuration(run.durationSec) },
              { label: 'Pace', value: formatPace(run.avgPaceSecPerKm), unit: '/km' },
              { label: 'Energy', value: run.calories ?? estimateKcal(run.distanceMeters), unit: 'kcal' },
            ]} />
          </Card>
          <Text style={styles.footnote}>Points: +15 for logging a run</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 280, marginBottom: spacing.md },
  summary: { alignItems: 'stretch' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  runIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, ...typography.h2 },
  stats: { marginTop: spacing.lg },
  footnote: { color: colors.textFaint, ...typography.caption, textAlign: 'center', marginTop: spacing.sm },
});
