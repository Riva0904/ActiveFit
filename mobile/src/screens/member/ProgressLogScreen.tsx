import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { latestWeight } from '../../lib/weight';
import { Button, Card, EmptyState, Field, Header, Loading, Screen, SectionTitle, TextField } from '../../components';
import { WeightGauge } from '../../components/widgets';
import { colors, radius, spacing, typography } from '../../theme';

const DEFAULT_WEIGHT = 70;

export default function ProgressLogScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_WEIGHT);
  const [bodyFat, setBodyFat] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['progress-logs'],
    queryFn: () => api.get('/progress-logs/my') as any,
  });

  const logs: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const latest = latestWeight(logs);

  // Seed the ruler from the most recent log once it arrives.
  useEffect(() => { if (latest !== null) setDraft(latest); }, [latest]);

  const logMutation = useMutation({
    mutationFn: (body: any) => api.post('/progress-logs', body) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-logs'] });
      queryClient.invalidateQueries({ queryKey: ['my-points'] });
      setShowForm(false);
      setBodyFat(''); setChest(''); setWaist(''); setHips(''); setNotes('');
      Alert.alert('Logged!', 'Progress entry saved');
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Could not save'),
  });

  const num = (s: string) => (s.trim() ? parseFloat(s) : undefined);

  function submitFull() {
    logMutation.mutate({
      weight: draft,
      bodyFat: num(bodyFat),
      chest: num(chest),
      waist: num(waist),
      hips: num(hips),
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Screen scroll>
      <Header
        title="Progress Log"
        subtitle={latest !== null ? `Last logged ${latest} kg` : 'Track your body measurements'}
        onBack={() => navigation.goBack()}
        right={<Button title="Details" variant="secondary" icon="plus" onPress={() => setShowForm(true)} />}
      />

      <Card style={styles.gaugeCard}>
        <WeightGauge value={draft} onChange={setDraft} label="Current weight" />
        <Button
          title={`Log ${draft.toFixed(1)} kg`}
          size="lg"
          icon="check"
          style={{ marginTop: spacing.xl }}
          onPress={() => logMutation.mutate({ weight: draft })}
          loading={logMutation.isPending && !showForm}
        />
      </Card>

      <SectionTitle title="History" />
      {isLoading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <EmptyState icon="trending-up" title="No progress logged yet" subtitle="Slide the ruler to your weight and tap Log" />
      ) : (
        logs.map((log: any, i: number) => (
          <Card key={log.id ?? i} padding="md">
            <Text style={styles.logDate}>
              {new Date(log.logDate ?? log.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <View style={styles.metricsRow}>
              {log.weight != null ? <Metric label="Weight" value={`${log.weight} kg`} highlight /> : null}
              {log.bodyFat != null ? <Metric label="Body fat" value={`${log.bodyFat}%`} /> : null}
              {log.bmi != null ? <Metric label="BMI" value={`${log.bmi}`} /> : null}
              {log.chest != null ? <Metric label="Chest" value={`${log.chest} cm`} /> : null}
              {log.waist != null ? <Metric label="Waist" value={`${log.waist} cm`} /> : null}
              {log.hips != null ? <Metric label="Hips" value={`${log.hips} cm`} /> : null}
            </View>
            {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
          </Card>
        ))
      )}

      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Log measurements</Text>
            <Text style={styles.sheetSub}>Weight {draft.toFixed(1)} kg from the ruler · others optional</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 340 }}>
              <Field label="Body fat %" style={styles.field}><TextField value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" placeholder="0" /></Field>
              <Field label="Chest (cm)" style={styles.field}><TextField value={chest} onChangeText={setChest} keyboardType="decimal-pad" placeholder="0" /></Field>
              <Field label="Waist (cm)" style={styles.field}><TextField value={waist} onChangeText={setWaist} keyboardType="decimal-pad" placeholder="0" /></Field>
              <Field label="Hips (cm)" style={styles.field}><TextField value={hips} onChangeText={setHips} keyboardType="decimal-pad" placeholder="0" /></Field>
              <Field label="Notes" style={styles.field}><TextField value={notes} onChangeText={setNotes} multiline placeholder="Optional notes…" /></Field>
            </ScrollView>
            <View style={styles.btnRow}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setShowForm(false)} />
              <Button title="Save" style={{ flex: 2 }} onPress={submitFull} loading={logMutation.isPending && showForm} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, highlight && { color: colors.primary }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gaugeCard: { paddingVertical: spacing.xxl },
  logDate: { color: colors.textSecondary, ...typography.caption, fontWeight: '600', marginBottom: spacing.sm },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { alignItems: 'flex-start', minWidth: 64 },
  metricValue: { color: colors.text, ...typography.body, fontWeight: '700', ...typography.number },
  metricLabel: { color: colors.textMuted, ...typography.micro },
  logNotes: { color: colors.textMuted, ...typography.caption, marginTop: spacing.sm },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl + 4, borderTopRightRadius: radius.xl + 4, padding: spacing.xxl, paddingBottom: 40, borderTopWidth: 1, borderColor: colors.border },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sheetSub: { color: colors.textMuted, ...typography.label, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
