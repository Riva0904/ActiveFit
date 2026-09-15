import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, Chip, EmptyState, Header, Loading, Screen } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WorkoutDetailScreen({ route, navigation }: any) {
  const { planId, planName } = route.params;
  const [selectedDay, setSelectedDay] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['workout-detail', planId],
    queryFn: () => api.get(`/workout-plans/${planId}`) as any,
    enabled: !!planId,
  });

  const plan: any = data ?? {};
  const exercises: any[] = (plan.exercises ?? []).filter((ex: any) => ex.day === DAYS[selectedDay]);

  return (
    <Screen scroll>
      <Header
        title={planName ?? plan.name ?? 'Workout Plan'}
        subtitle={[plan.goal, plan.difficulty].filter(Boolean).join(' · ') || undefined}
        onBack={() => navigation.goBack()}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayRow}>
        {DAYS.map((day, i) => (
          <Chip key={day} label={day.slice(0, 3)} selected={selectedDay === i} onPress={() => setSelectedDay(i)} />
        ))}
      </ScrollView>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <Text style={styles.dayTitle}>{DAYS[selectedDay]}</Text>
          {exercises.length === 0 ? (
            <EmptyState icon="moon" title="Rest day" subtitle="Recovery is part of the plan" />
          ) : (
            exercises.map((ex: any, i: number) => (
              <Card key={i} style={styles.exCard} padding="md">
                <View style={styles.exNum}><Text style={styles.exNumText}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.name ?? ex.exerciseName}</Text>
                  <View style={styles.exMeta}>
                    {ex.sets ? <Meta>{ex.sets} sets</Meta> : null}
                    {ex.reps ? <Meta>{ex.reps} reps</Meta> : null}
                    {ex.duration ? <Meta>{ex.duration}s</Meta> : null}
                    {ex.weight ? <Meta>{ex.weight} kg</Meta> : null}
                    {ex.restSeconds ?? ex.rest ? <Meta>Rest {ex.restSeconds ?? ex.rest}s</Meta> : null}
                  </View>
                  {ex.notes ? <Text style={styles.exNotes}>{ex.notes}</Text> : null}
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <Text style={styles.metaText}>{children}</Text>;
}

const styles = StyleSheet.create({
  dayScroll: { flexGrow: 0, marginBottom: spacing.lg, marginHorizontal: -spacing.screen },
  dayRow: { paddingHorizontal: spacing.screen, gap: spacing.sm },
  dayTitle: { color: colors.text, ...typography.h2, marginBottom: spacing.lg },
  exCard: { flexDirection: 'row', gap: spacing.md },
  exNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  exNumText: { color: colors.white, fontWeight: '700', ...typography.label, ...typography.number },
  exName: { color: colors.text, ...typography.body, fontWeight: '600', marginBottom: 6 },
  exMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaText: { backgroundColor: colors.border, borderRadius: radius.sm - 2, paddingHorizontal: 8, paddingVertical: 3, color: colors.textSecondary, ...typography.caption },
  exNotes: { color: colors.textMuted, ...typography.caption, marginTop: 6 },
});
