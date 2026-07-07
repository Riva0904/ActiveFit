import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function MyTrainerScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: trainers, isLoading } = useQuery({
    queryKey: ['available-trainers'],
    queryFn: () => api.get('/pt-sessions/available-trainers') as any,
  });

  const bookMutation = useMutation({
    mutationFn: (body: any) => api.post('/pt-sessions/book', body) as any,
    onSuccess: () => {
      Alert.alert('Booked!', 'PT session request sent');
      queryClient.invalidateQueries({ queryKey: ['trainer-sessions'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Booking failed'),
  });

  const trainerList: any[] = Array.isArray(trainers) ? trainers : (trainers as any)?.data ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>My Trainer</Text>
        <Text style={styles.sub}>View available trainers and book PT sessions</Text>
      </View>

      {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
        trainerList.map((t: any) => (
          <View key={t.id} style={styles.card}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>
                {t.user?.firstName?.[0]}{t.user?.lastName?.[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{t.user?.firstName} {t.user?.lastName}</Text>
              <Text style={styles.spec}>{t.specialization ?? 'General Fitness'}</Text>
              {t.experience ? <Text style={styles.exp}>{t.experience} years experience</Text> : null}
              {t.memberCount !== undefined && (
                <Text style={styles.members}>{t.memberCount} assigned members</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() =>
                Alert.alert(
                  'Book PT Session',
                  `Book a session with ${t.user?.firstName}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Book',
                      onPress: () => bookMutation.mutate({ trainerId: t.id }),
                    },
                  ],
                )
              }
            >
              <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      {!isLoading && trainerList.length === 0 && (
        <Text style={styles.empty}>No trainers available</Text>
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
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginBottom: 12, backgroundColor: '#1A1A1A',
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2A2A2A',
  },
  avatarWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#FF4D00',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  name: { color: '#F9FAFB', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  spec: { color: '#FF4D00', fontSize: 12, marginBottom: 2 },
  exp: { color: '#9CA3AF', fontSize: 12 },
  members: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  bookBtn: {
    backgroundColor: '#FF4D00', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  bookBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { color: '#4B5563', textAlign: 'center', marginTop: 40 },
});
