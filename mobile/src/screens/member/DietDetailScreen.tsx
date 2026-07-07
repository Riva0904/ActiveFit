import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const TIME_SLOTS = [
  { key: 'BREAKFAST', label: '🌅 Breakfast', time: '7:00 AM' },
  { key: 'MORNING_SNACK', label: '🍎 Morning Snack', time: '10:30 AM' },
  { key: 'LUNCH', label: '☀️ Lunch', time: '1:00 PM' },
  { key: 'EVENING_SNACK', label: '🫐 Snack', time: '4:00 PM' },
  { key: 'DINNER', label: '🌙 Dinner', time: '8:00 PM' },
  { key: 'POST_WORKOUT', label: '💪 Post Workout', time: 'After workout' },
];

export default function DietDetailScreen({ route, navigation }: any) {
  const { planId, planName } = route.params;

  const { data, isLoading } = useQuery({
    queryKey: ['diet-detail', planId],
    queryFn: () => api.get(`/diet-plans/${planId}`) as any,
    enabled: !!planId,
  });

  const plan: any = data ?? {};
  const meals: any[] = plan.meals ?? plan.dietMeals ?? [];

  const mealsBySlot = TIME_SLOTS.map((slot) => ({
    ...slot,
    meals: meals.filter((m: any) => m.mealTime === slot.key || m.timeSlot === slot.key),
  })).filter((s) => s.meals.length > 0);

  const otherMeals = meals.filter(
    (m: any) => !TIME_SLOTS.some((s) => s.key === m.mealTime || s.key === m.timeSlot),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>{planName ?? plan.name ?? 'Diet Plan'}</Text>
        {plan.totalCalories && <Text style={styles.sub}>{plan.totalCalories} kcal/day</Text>}
      </View>

      {plan.goal && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Goal</Text>
          <Text style={styles.infoValue}>{plan.goal}</Text>
        </View>
      )}

      {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
        <>
          {mealsBySlot.map((slot) => (
            <View key={slot.key} style={styles.slotSection}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotLabel}>{slot.label}</Text>
                <Text style={styles.slotTime}>{slot.time}</Text>
              </View>
              {slot.meals.map((meal: any, i: number) => (
                <View key={i} style={styles.mealCard}>
                  <Text style={styles.mealName}>{meal.name ?? meal.foodItem}</Text>
                  <View style={styles.macroRow}>
                    {meal.quantity && <Text style={styles.macro}>{meal.quantity}{meal.unit ?? 'g'}</Text>}
                    {meal.calories && <Text style={[styles.macro, { color: '#FF4D00' }]}>{meal.calories} kcal</Text>}
                    {meal.protein && <Text style={styles.macro}>P:{meal.protein}g</Text>}
                    {meal.carbs && <Text style={styles.macro}>C:{meal.carbs}g</Text>}
                    {meal.fat && <Text style={styles.macro}>F:{meal.fat}g</Text>}
                  </View>
                  {meal.notes && <Text style={styles.mealNotes}>{meal.notes}</Text>}
                </View>
              ))}
            </View>
          ))}

          {otherMeals.map((meal: any, i: number) => (
            <View key={`other${i}`} style={styles.mealCard}>
              <Text style={styles.mealName}>{meal.name ?? meal.foodItem}</Text>
            </View>
          ))}

          {meals.length === 0 && (
            <Text style={styles.empty}>No meals defined in this plan</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 16 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  sub: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
    marginBottom: 12,
  },
  infoLabel: { color: '#9CA3AF', fontSize: 13 },
  infoValue: { color: '#F9FAFB', fontSize: 13, fontWeight: '600' },
  slotSection: { marginHorizontal: 20, marginBottom: 20 },
  slotHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  slotLabel: { color: '#F9FAFB', fontSize: 15, fontWeight: '700' },
  slotTime: { color: '#FF4D00', fontSize: 12, fontWeight: '600' },
  mealCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A',
  },
  mealName: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  macro: {
    backgroundColor: '#2A2A2A', borderRadius: 6, paddingHorizontal: 8,
    paddingVertical: 3, color: '#9CA3AF', fontSize: 12,
  },
  mealNotes: { color: '#6B7280', fontSize: 12, marginTop: 6 },
  empty: { color: '#4B5563', textAlign: 'center', marginTop: 40 },
});
