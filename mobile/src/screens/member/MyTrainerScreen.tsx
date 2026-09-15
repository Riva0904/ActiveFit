import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Avatar, Button, Card, Chip, EmptyState, Field, Header, Icon, Loading, Screen, TextField } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const TIMES = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
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
    bookMutation.mutate({ trainerId: bookingTrainer.id, scheduledAt: buildISO(dayOffset, time), duration, notes: notes.trim() || undefined });
  }

  function openBooking(t: any) {
    setBookingTrainer(t); setDayOffset(1); setTime('09:00'); setDuration(60); setNotes('');
  }

  const specialization = (t: any) => t.specialization ?? (Array.isArray(t.specializations) && t.specializations.length ? t.specializations.join(', ') : 'General Fitness');

  return (
    <Screen scroll>
      <Header title="Book a Trainer" subtitle="Select a trainer and schedule your PT session" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : trainerList.length === 0 ? (
        <EmptyState icon="dumbbell" title="No trainers available in your gym" />
      ) : (
        trainerList.map((t: any) => (
          <Card key={t.id} style={styles.card}>
            <Avatar uri={t.user?.avatar} firstName={t.user?.firstName} lastName={t.user?.lastName} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{t.user?.firstName} {t.user?.lastName}</Text>
              <Text style={styles.spec} numberOfLines={1}>{specialization(t)}</Text>
              <View style={styles.tagRow}>
                {t.experience != null ? <Tag>{t.experience}yr exp</Tag> : null}
                {t.rating != null ? <Tag color={colors.success}>★ {Number(t.rating).toFixed(1)}</Tag> : null}
                {t.hourlyRate != null ? <Tag color={colors.info}>₹{t.hourlyRate}/hr</Tag> : null}
              </View>
            </View>
            <Button title="Book" onPress={() => openBooking(t)} />
          </Card>
        ))
      )}

      <Modal visible={!!bookingTrainer} transparent animationType="slide" onRequestClose={() => setBookingTrainer(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Book with {bookingTrainer?.user?.firstName}</Text>
            <Text style={styles.sheetSub}>{bookingTrainer ? specialization(bookingTrainer) : ''}</Text>

            <Field label="Date" style={styles.field}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {[0, 1, 2, 3, 4, 5, 6].map((off) => <Chip key={off} label={getDateLabel(off)} selected={dayOffset === off} onPress={() => setDayOffset(off)} />)}
              </ScrollView>
            </Field>
            <Field label="Time" style={styles.field}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {TIMES.map((t) => <Chip key={t} label={t} selected={time === t} onPress={() => setTime(t)} />)}
              </ScrollView>
            </Field>
            <Field label="Duration" style={styles.field}>
              <View style={styles.durRow}>
                {DURATIONS.map((d) => <Chip key={d} label={`${d} min`} selected={duration === d} onPress={() => setDuration(d)} style={{ flex: 1, alignItems: 'center' }} />)}
              </View>
            </Field>
            <Field label="Notes (optional)" style={styles.field}>
              <TextField value={notes} onChangeText={setNotes} placeholder="Goals, focus areas, injuries…" multiline maxLength={200} />
            </Field>

            <View style={styles.summary}>
              <View style={styles.summaryItem}><Icon name="calendar" size={14} color={colors.textSecondary} /><Text style={styles.summaryText}>{getDateLabel(dayOffset)}</Text></View>
              <View style={styles.summaryItem}><Icon name="clock" size={14} color={colors.textSecondary} /><Text style={styles.summaryText}>{time} · {duration} min</Text></View>
              {bookingTrainer?.hourlyRate ? <Text style={styles.summaryPrice}>Est. ₹{(bookingTrainer.hourlyRate * duration / 60).toFixed(0)}</Text> : null}
            </View>

            <View style={styles.btnRow}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setBookingTrainer(null)} />
              <Button title="Confirm booking" style={{ flex: 2 }} onPress={confirmBook} loading={bookMutation.isPending} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Tag({ children, color = colors.textSecondary }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: tint(color, '18') }]}>
      <Text style={[styles.tagText, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, ...typography.body, fontWeight: '600', marginBottom: 2 },
  spec: { color: colors.primary, ...typography.caption, marginBottom: 6 },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: { borderRadius: radius.sm - 2, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { ...typography.micro, fontWeight: '600' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl + 4, borderTopRightRadius: radius.xl + 4, padding: spacing.xxl, paddingBottom: 40, borderTopWidth: 1, borderColor: colors.border },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sheetSub: { color: colors.textMuted, ...typography.label, marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg },
  durRow: { flexDirection: 'row', gap: spacing.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: tint(colors.primary, '30') },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryText: { color: colors.text, ...typography.label },
  summaryPrice: { color: colors.success, ...typography.label, fontWeight: '700', marginLeft: 'auto' },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
