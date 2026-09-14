import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Card, Header, Icon, ListRow, Loading, Screen, SectionTitle, type IconName } from '../../components';
import { colors, spacing, tint, typography } from '../../theme';

export default function PlansScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);

  const { data: workouts, isLoading: wLoading } = useQuery({
    queryKey: ['my-workouts'],
    queryFn: () => api.get('/workout-plans/my') as any,
    enabled: !!user,
  });

  const { data: diets, isLoading: dLoading } = useQuery({
    queryKey: ['my-diets'],
    queryFn: () => api.get('/diet-plans/my') as any,
    enabled: !!user,
  });

  const workoutList: any[] = Array.isArray(workouts) ? workouts : (workouts as any)?.data ?? [];
  const dietList: any[] = Array.isArray(diets) ? diets : (diets as any)?.data ?? [];

  return (
    <Screen scroll>
      <Header title="My Plans" subtitle="Workouts and nutrition assigned to you" />

      <View style={styles.aiRow}>
        <AiCard icon="dumbbell" label="AI Workout" onPress={() => navigation.navigate('AIWorkout')} />
        <AiCard icon="food-apple-outline" label="AI Diet" onPress={() => navigation.navigate('AIDiet')} />
      </View>

      <SectionTitle title="Workout plans" />
      {wLoading ? (
        <Loading />
      ) : workoutList.length > 0 ? (
        <Card padding="none">
          {workoutList.map((w: any, i: number) => {
            const plan = w.workoutPlan ?? w;
            return (
              <ListRow
                key={w.id}
                icon="dumbbell"
                iconColor={colors.purple}
                label={plan.name ?? 'Workout Plan'}
                subtitle={[plan.goal, plan.difficulty].filter(Boolean).join(' · ')}
                chevron
                last={i === workoutList.length - 1}
                onPress={() => navigation.navigate('WorkoutDetail', { planId: plan.id, planName: plan.name })}
              />
            );
          })}
        </Card>
      ) : (
        <Text style={styles.empty}>No workout plans assigned yet</Text>
      )}

      <SectionTitle title="Diet plans" />
      {dLoading ? (
        <Loading />
      ) : dietList.length > 0 ? (
        <Card padding="none">
          {dietList.map((d: any, i: number) => {
            const plan = d.dietPlan ?? d;
            return (
              <ListRow
                key={d.id}
                icon="food-apple-outline"
                iconColor={colors.success}
                label={plan.name ?? 'Diet Plan'}
                subtitle={plan.totalCalories ? `${plan.totalCalories} kcal/day` : 'Balanced nutrition'}
                chevron
                last={i === dietList.length - 1}
                onPress={() => navigation.navigate('DietDetail', { planId: plan.id, planName: plan.name })}
              />
            );
          })}
        </Card>
      ) : (
        <Text style={styles.empty}>No diet plans assigned yet</Text>
      )}
    </Screen>
  );
}

function AiCard({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Card style={styles.aiCard} accent="primary" onPress={onPress}>
      <View style={styles.aiIcon}><Icon name={icon} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.aiLabel}>{label}</Text>
        <Text style={styles.aiSub}>Generate</Text>
      </View>
      <Icon name="zap" size={16} color={colors.primary} />
    </Card>
  );
}

const styles = StyleSheet.create({
  aiRow: { flexDirection: 'row', gap: spacing.md },
  aiCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  aiIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  aiLabel: { color: colors.text, ...typography.label, fontWeight: '700' },
  aiSub: { color: colors.textMuted, ...typography.micro },
  empty: { color: colors.textFaint, ...typography.label, marginBottom: spacing.sm },
});
