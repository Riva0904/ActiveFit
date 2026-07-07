import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

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
  const exercises: any[] = (plan.workoutDays ?? []).find((d: any) => d.dayIndex === selectedDay || d.day === selectedDay + 1)?.exercises ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>{planName ?? plan.name ?? 'Workout Plan'}</Text>
        <Text style={styles.sub}>{plan.goal} · {plan.difficulty}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {DAYS.map((day, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.dayChip, selectedDay === i && styles.dayChipActive]}
            onPress={() => setSelectedDay(i)}
          >
            <Text style={[styles.dayChipText, selectedDay === i && styles.dayChipTextActive]}>
              {day.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={styles.dayTitle}>{DAYS[selectedDay]}</Text>
          {exercises.length === 0 ? (
            <Text style={styles.rest}>🛌 Rest Day</Text>
          ) : exercises.map((ex: any, i: number) => (
            <View key={i} style={styles.exCard}>
              <Text style={styles.exNum}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{ex.name ?? ex.exerciseName}</Text>
                <View style={styles.exMeta}>
                  {ex.sets && <Text style={styles.exMetaText}>{ex.sets} sets</Text>}
                  {ex.reps && <Text style={styles.exMetaText}>{ex.reps} reps</Text>}
                  {ex.duration && <Text style={styles.exMetaText}>{ex.duration}s</Text>}
                  {ex.weight && <Text style={styles.exMetaText}>{ex.weight} kg</Text>}
                  {ex.restSeconds && <Text style={styles.exMetaText}>Rest {ex.restSeconds}s</Text>}
                </View>
                {ex.notes && <Text style={styles.exNotes}>{ex.notes}</Text>}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 16 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  sub: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  dayScroll: { flexGrow: 0, marginBottom: 16 },
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
  },
  dayChipActive: { backgroundColor: '#FF4D00', borderColor: '#FF4D00' },
  dayChipText: { color: '#9CA3AF', fontWeight: '600', fontSize: 13 },
  dayChipTextActive: { color: '#fff' },
  dayTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  rest: { color: '#6B7280', fontSize: 15, textAlign: 'center', marginTop: 32 },
  exCard: {
    flexDirection: 'row', gap: 14, backgroundColor: '#1A1A1A', borderRadius: 12,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  exNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF4D00',
    color: '#fff', fontWeight: '700', textAlign: 'center', lineHeight: 28, fontSize: 13,
  },
  exName: { color: '#F9FAFB', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  exMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  exMetaText: {
    backgroundColor: '#2A2A2A', borderRadius: 6, paddingHorizontal: 8,
    paddingVertical: 3, color: '#9CA3AF', fontSize: 12,
  },
  exNotes: { color: '#6B7280', fontSize: 12, marginTop: 6 },
});
