import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={styles.header}>My Plans</Text>

      <View style={styles.aiRow}>
        <TouchableOpacity style={styles.aiBtn} onPress={() => navigation.navigate('AIWorkout')}>
          <Text style={styles.aiBtnText}>✨ AI Workout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.aiBtn} onPress={() => navigation.navigate('AIDiet')}>
          <Text style={styles.aiBtnText}>✨ AI Diet</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>💪 Workout Plans</Text>
      {wLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginVertical: 16 }} />
      ) : workoutList.length > 0 ? (
        workoutList.map((w: any) => {
          const plan = w.workoutPlan ?? w;
          return (
            <TouchableOpacity
              key={w.id}
              style={styles.card}
              onPress={() => navigation.navigate('WorkoutDetail', { planId: plan.id, planName: plan.name })}
              activeOpacity={0.7}
            >
              <View style={styles.cardInner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{plan.name ?? 'Workout Plan'}</Text>
                  <Text style={styles.cardSub}>{plan.goal} · {plan.difficulty}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.empty}>No workout plans assigned yet</Text>
      )}

      <Text style={styles.section}>🥗 Diet Plans</Text>
      {dLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginVertical: 16 }} />
      ) : dietList.length > 0 ? (
        dietList.map((d: any) => {
          const plan = d.dietPlan ?? d;
          return (
            <TouchableOpacity
              key={d.id}
              style={styles.card}
              onPress={() => navigation.navigate('DietDetail', { planId: plan.id, planName: plan.name })}
              activeOpacity={0.7}
            >
              <View style={styles.cardInner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{plan.name ?? 'Diet Plan'}</Text>
                  <Text style={styles.cardSub}>{plan.totalCalories ? `${plan.totalCalories} kcal/day` : 'Balanced nutrition'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.empty}>No diet plans assigned yet</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', paddingHorizontal: 20, paddingTop: 56, marginBottom: 16 },
  aiRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  aiBtn: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#FF4D0050',
  },
  aiBtnText: { color: '#FF4D00', fontWeight: '700', fontSize: 14 },
  section: { color: '#E5E7EB', fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  card: {
    marginHorizontal: 20, marginBottom: 10, backgroundColor: '#1A1A1A',
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardInner: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: '#F9FAFB', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  cardSub: { color: '#9CA3AF', fontSize: 13 },
  chevron: { color: '#FF4D00', fontSize: 22, fontWeight: '700' },
  empty: { color: '#4B5563', fontSize: 13, paddingHorizontal: 20, marginBottom: 8 },
});
