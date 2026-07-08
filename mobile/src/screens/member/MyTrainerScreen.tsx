import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Modal,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
const DURATIONS = [30, 45, 60, 90];

function getDateLabel(offset: number) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function buildISO(dayOffset: number, time: string) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const [h, m] = time.split(':');
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toISOString();
}

export default function MyTrainerScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [bookingTrainer, setBookingTrainer] = useState<any>(null);
  const [dayOffset, setDayOffset] = useState(1);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');

  const { data: trainers, isLoading } = useQuery({
    queryKey: ['available-trainers'],
    queryFn: () => api.get('/pt-sessions/available-trainers') as any,
  });

  const bookMutation = useMutation({
    mutationFn: (body: any) => api.post('/pt-sessions/book', body) as any,
    onSuccess: () => {
      setBookingTrainer(null);
      queryClient.invalidateQueries({ queryKey: ['trainer-sessions'] });
      Alert.alert('Booked!', 'PT session request sent to your trainer');
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Booking failed'),
  });

  const trainerList: any[] = Array.isArray(trainers) ? trainers : (trainers as any)?.data ?? [];

  function confirmBook() {
    if (!bookingTrainer) return;
    const scheduledAt = buildISO(dayOffset, time);
    bookMutation.mutate({
      trainerId: bookingTrainer.id,
      scheduledAt,
      duration,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Book a Trainer</Text>
        <Text style={styles.sub}>Select a trainer and schedule your PT session</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} />
      ) : trainerList.length === 0 ? (
        <Text style={styles.empty}>No trainers available in your gym</Text>
      ) : (
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
              <View style={styles.tagRow}>
                {t.experience != null && (
                  <View style={styles.tag}><Text style={styles.tagText}>{t.experience}yr exp</Text></View>
                )}
                {t.rating != null && (
                  <View style={[styles.tag, { backgroundColor: '#1A2A1A' }]}>
                    <Text style={[styles.tagText, { color: '#22C55E' }]}>★ {Number(t.rating).toFixed(1)}</Text>
                  </View>
                )}
                {t.hourlyRate != null && (
                  <View style={[styles.tag, { backgroundColor: '#1A1A2A' }]}>
                    <Text style={[styles.tagText, { color: '#818CF8' }]}>₹{t.hourlyRate}/hr</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => { setBookingTrainer(t); setDayOffset(1); setTime('09:00'); setDuration(60); setNotes(''); }}
            >
              <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Booking Modal */}
      <Modal visible={!!bookingTrainer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              Book with {bookingTrainer?.user?.firstName}
            </Text>
            <Text style={styles.modalSub}>
              {bookingTrainer?.specialization ?? 'Personal Training'}
            </Text>

            {/* Day selector */}
            <Text style={styles.sectionLabel}>Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[0, 1, 2, 3, 4, 5, 6].map((off) => (
                <TouchableOpacity
                  key={off}
                  style={[styles.chip, dayOffset === off && styles.chipActive]}
                  onPress={() => setDayOffset(off)}
                >
                  <Text style={[styles.chipText, dayOffset === off && styles.chipTextActive]}>
                    {getDateLabel(off)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time selector */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TIMES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, time === t && styles.chipActive]}
                  onPress={() => setTime(t)}
                >
                  <Text style={[styles.chipText, time === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Duration */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Duration</Text>
            <View style={styles.durRow}>
              {DURATIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durChip, duration === d && styles.chipActive]}
                  onPress={() => setDuration(d)}
                >
                  <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>{d} min</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Goals, focus areas, injuries…"
              placeholderTextColor="#4B5563"
              multiline
              maxLength={200}
            />

            {/* Summary */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>
                📅 {getDateLabel(dayOffset)} · ⏰ {time} · ⏱ {duration} min
              </Text>
              {bookingTrainer?.hourlyRate && (
                <Text style={styles.summaryPrice}>
                  Est. ₹{(bookingTrainer.hourlyRate * duration / 60).toFixed(0)}
                </Text>
              )}
            </View>

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setBookingTrainer(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, bookMutation.isPending && { opacity: 0.6 }]}
                onPress={confirmBook}
                disabled={bookMutation.isPending}
              >
                {bookMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Confirm Booking</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 12 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  sub: { color: '#6B7280', fontSize: 13, marginTop: 4 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginBottom: 12, backgroundColor: '#141414',
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1F1F1F',
  },
  avatarWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FF4D00',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  name: { color: '#F9FAFB', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  spec: { color: '#FF4D00', fontSize: 12, marginBottom: 6 },
  tagRow: { flexDirection: 'row', gap: 6 },
  tag: { backgroundColor: '#1F1F1F', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: '#9CA3AF', fontSize: 11 },
  bookBtn: {
    backgroundColor: '#FF4D00', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  bookBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty: { color: '#4B5563', textAlign: 'center', marginTop: 60, fontSize: 14 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#2A2A2A', borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { color: '#F9FAFB', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: '#6B7280', fontSize: 13, marginBottom: 20 },

  sectionLabel: { color: '#6B7280', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  chipActive: { backgroundColor: '#FF4D00', borderColor: '#FF4D00' },
  chipText: { color: '#9CA3AF', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  durRow: { flexDirection: 'row', gap: 8 },
  durChip: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },

  notesInput: {
    backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
    color: '#F9FAFB', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12,
    minHeight: 72, textAlignVertical: 'top',
  },

  summaryBox: {
    marginTop: 16, flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FF4D0030',
  },
  summaryText: { color: '#E5E7EB', fontSize: 13 },
  summaryPrice: { color: '#22C55E', fontWeight: '700', fontSize: 13 },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A',
  },
  cancelBtnText: { color: '#9CA3AF', fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 2, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#FF4D00', borderRadius: 14,
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
