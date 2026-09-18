import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useDailyLog } from '../../hooks/useDailyLog';
import { Card, EmptyState, Header, Icon, Loading, Screen, type IconName } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

/** One tap is a rough meal's worth; precision here is not the point. */
const CAL_STEP = 100;

const MEAL_ICONS: Record<string, IconName> = {
  Breakfast: 'sun',
  'Mid-Morning': 'clock',
  Lunch: 'sun',
  'Afternoon Snack': 'clock',
  Snack: 'clock',
  Dinner: 'moon',
  Evening: 'moon',
};

export default function DietDetailScreen({ route, navigation }: any) {
  const { planId, planName } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['diet-detail', planId],
    queryFn: () => api.get(`/diet-plans/${planId}`) as any,
    enabled: !!planId,
  });

  const plan: any = data ?? {};
  const meals: any[] = plan.meals ?? plan.dietMeals ?? [];

  const { log, setCalories, saving } = useDailyLog();
  const eaten = log.caloriesIn ?? 0;
  const target: number | null = typeof plan.totalCalories === 'number' ? plan.totalCalories : null;

  return (
    <Screen scroll>
      <Header
        title={planName ?? plan.name ?? 'Diet Plan'}
        subtitle={plan.totalCalories ? `${plan.totalCalories} kcal/day` : undefined}
        onBack={() => navigation.goBack()}
      />

      {plan.goal ? (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Goal</Text>
          <Text style={styles.infoValue}>{String(plan.goal).replace(/_/g, ' ')}</Text>
        </View>
      ) : null}

      {/* What they actually ate, against what the plan asks for. */}
      <Card padding="md">
        <View style={styles.calTop}>
          <View>
            <Text style={styles.calValue}>
              {eaten}<Text style={styles.calUnit}> kcal today</Text>
            </Text>
            <Text style={styles.calLabel}>
              {target
                ? eaten <= target
                  ? `${target - eaten} kcal left of ${target}`
                  : `${eaten - target} kcal over ${target}`
                : 'No daily target on this plan'}
            </Text>
          </View>
          <View style={styles.calBtns}>
            <TouchableOpacity
              style={[styles.calBtn, eaten === 0 && styles.calBtnOff]}
              disabled={eaten === 0 || saving}
              onPress={() => setCalories(Math.max(0, eaten - CAL_STEP))}
            >
              <Icon name="minus" size={16} color={eaten === 0 ? colors.textMuted : colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.calBtn, styles.calBtnAdd]}
              disabled={saving}
              onPress={() => setCalories(eaten + CAL_STEP)}
            >
              <Icon name="plus" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
        {target ? (
          <View style={styles.calTrack}>
            <View
              style={[
                styles.calFill,
                {
                  width: `${Math.min(100, (eaten / target) * 100)}%`,
                  backgroundColor: eaten > target ? colors.warning : colors.success,
                },
              ]}
            />
          </View>
        ) : null}
        <Text style={styles.calHint}>Tap + for each {CAL_STEP} kcal — rough is fine.</Text>
      </Card>

      {isLoading ? (
        <Loading />
      ) : meals.length === 0 ? (
        <EmptyState icon="food-apple-outline" title="No meals defined in this plan" />
      ) : (
        meals.map((meal: any, i: number) => {
          const title = meal.meal ?? `Meal ${i + 1}`;
          const items: string[] | null = Array.isArray(meal.items) ? meal.items : null;
          return (
            <Card key={i} padding="md">
              <View style={styles.slotHeader}>
                <View style={styles.slotIcon}><Icon name={MEAL_ICONS[title] ?? 'clock'} size={16} color={colors.primary} /></View>
                <Text style={styles.slotLabel}>{title}</Text>
                {meal.calories ? <Text style={styles.slotCal}>{meal.calories} kcal</Text> : null}
              </View>
              {items ? (
                items.map((item, j) => (
                  <View key={j} style={styles.itemRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.itemText}>{item}</Text>
                  </View>
                ))
              ) : (
                <>
                  <Text style={styles.itemText}>{meal.name ?? meal.foodItem}</Text>
                  <View style={styles.macroRow}>
                    {meal.protein ? <Text style={styles.macro}>P {meal.protein}g</Text> : null}
                    {meal.carbs ? <Text style={styles.macro}>C {meal.carbs}g</Text> : null}
                    {meal.fat ? <Text style={styles.macro}>F {meal.fat}g</Text> : null}
                  </View>
                </>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.lg },

  calTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  calValue: { color: colors.text, ...typography.h2, ...typography.number },
  calUnit: { color: colors.textMuted, ...typography.caption },
  calLabel: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  calBtns: { flexDirection: 'row', gap: spacing.sm },
  calBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  calBtnOff: { opacity: 0.5 },
  calBtnAdd: { backgroundColor: colors.success, borderColor: colors.success },
  calTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  calFill: { height: '100%', borderRadius: 3 },
  calHint: { color: colors.textMuted, ...typography.micro, marginTop: spacing.sm },
  infoLabel: { color: colors.textSecondary, ...typography.label },
  infoValue: { color: colors.text, ...typography.label, fontWeight: '600' },
  slotHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  slotIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  slotLabel: { color: colors.text, ...typography.body, fontWeight: '700', flex: 1 },
  slotCal: { color: colors.primary, ...typography.caption, fontWeight: '600', ...typography.number },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textFaint },
  itemText: { color: colors.textSecondary, ...typography.body, flex: 1 },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  macro: { backgroundColor: colors.border, borderRadius: radius.sm - 2, paddingHorizontal: 8, paddingVertical: 3, color: colors.textSecondary, ...typography.caption },
});
