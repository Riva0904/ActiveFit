import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { latestWeight } from '../../lib/weight';
import { Button, Card, EmptyState, Field, Header, Icon, Loading, Screen, SectionTitle, TextField } from '../../components';
import { WeightGauge } from '../../components/widgets';
import { colors, radius, spacing, tint, typography } from '../../theme';

const DEFAULT_WEIGHT = 70;

const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

export default function ProgressLogScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_WEIGHT);
  const [bodyFat, setBodyFat] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['progress-logs'],
    queryFn: () => api.get('/progress-logs/my') as any,
  });

  const logs: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const latest = latestWeight(logs);

  // Logs arrive newest-first, so the oldest photographed entry is the "before".
  const withPhotos = useMemo(() => logs.filter((l) => (l.photos?.length ?? 0) > 0), [logs]);
  const before = withPhotos[withPhotos.length - 1];
  const after = withPhotos[0];

  // Seed the ruler from the most recent log once it arrives.
  useEffect(() => { if (latest !== null) setDraft(latest); }, [latest]);

  const logMutation = useMutation({
    mutationFn: (body: any) => api.post('/progress-logs', body) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-logs'] });
      queryClient.invalidateQueries({ queryKey: ['my-points'] });
      setShowForm(false);
      setBodyFat(''); setChest(''); setWaist(''); setHips(''); setNotes(''); setPhotos([]);
      Alert.alert('Logged!', 'Progress entry saved');
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Could not save'),
  });

  const num = (s: string) => (s.trim() ? parseFloat(s) : undefined);

  /**
   * `ProgressLog.photos[]` has existed since the model was written and the app
   * never filled it — which is why there was no transformation view to show.
   * Uploads reuse the same endpoint as avatars and chat attachments.
   */
  async function addPhoto(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow access in Settings to add a photo.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      // Content-Type is left to axios so it generates the multipart boundary.
      formData.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: `progress-${Date.now()}.jpg` } as any);
      const uploaded: any = await api.post('/chat/upload', formData);
      setPhotos((prev) => [...prev, uploaded.url]);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Try again');
    } finally {
      setUploading(false);
    }
  }

  function pickPhotoSource() {
    Alert.alert('Add progress photo', 'Choose a source', [
      { text: 'Camera', onPress: () => addPhoto('camera') },
      { text: 'Gallery', onPress: () => addPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function submitFull() {
    logMutation.mutate({
      weight: draft,
      bodyFat: num(bodyFat),
      chest: num(chest),
      waist: num(waist),
      hips: num(hips),
      notes: notes.trim() || undefined,
      photos: photos.length ? photos : undefined,
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

      {before && after && before.id !== after.id ? (
        <>
          <SectionTitle title="Your transformation" />
          <Card padding="md">
            <View style={styles.compareRow}>
              <ComparePane label={shortDate(before.logDate ?? before.createdAt)} uri={before.photos[0]} weight={before.weight} />
              <Icon name="chevron-right" size={20} color={colors.textMuted} />
              <ComparePane label={shortDate(after.logDate ?? after.createdAt)} uri={after.photos[0]} weight={after.weight} />
            </View>
            {typeof before.weight === 'number' && typeof after.weight === 'number' ? (
              <Text style={styles.compareDelta}>
                {(() => {
                  const d = after.weight - before.weight;
                  if (d === 0) return 'Same weight — measurements may still be moving.';
                  return `${d > 0 ? '+' : ''}${d.toFixed(1)} kg since ${shortDate(before.logDate ?? before.createdAt)}`;
                })()}
              </Text>
            ) : null}
          </Card>
        </>
      ) : null}

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

              <Field label="Progress photos" style={styles.field}>
                <View style={styles.photoPickRow}>
                  {photos.map((uri) => (
                    <View key={uri} style={styles.photoThumbWrap}>
                      <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.photoRemove}
                        onPress={() => setPhotos((prev) => prev.filter((p) => p !== uri))}
                        hitSlop={6}
                      >
                        <Icon name="x" size={12} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.photoAdd} onPress={pickPhotoSource} disabled={uploading}>
                    {uploading
                      ? <ActivityIndicator color={colors.primary} size="small" />
                      : <Icon name="camera" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                </View>
                <Text style={styles.photoHint}>
                  Shared with your assigned trainer so they can see how you are changing.
                </Text>
              </Field>
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

function ComparePane({ label, uri, weight }: { label: string; uri: string; weight?: number | null }) {
  return (
    <View style={styles.comparePane}>
      <Image source={{ uri }} style={styles.compareImage} resizeMode="cover" />
      <Text style={styles.compareLabel}>{label}</Text>
      {weight != null ? <Text style={styles.compareWeight}>{weight} kg</Text> : null}
    </View>
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

  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  comparePane: { flex: 1, alignItems: 'center', gap: 4 },
  compareImage: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  compareLabel: { color: colors.textMuted, ...typography.micro },
  compareWeight: { color: colors.text, ...typography.caption, fontWeight: '700' },
  compareDelta: { color: colors.textSecondary, ...typography.caption, textAlign: 'center', marginTop: spacing.md },

  photoPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 64, height: 84, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  photoRemove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  photoAdd: {
    width: 64, height: 84, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tint(colors.primary, '12'), borderWidth: 1, borderColor: tint(colors.primary, '38'),
  },
  photoHint: { color: colors.textMuted, ...typography.micro, marginTop: spacing.sm },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl + 4, borderTopRightRadius: radius.xl + 4, padding: spacing.xxl, paddingBottom: 40, borderTopWidth: 1, borderColor: colors.border },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sheetSub: { color: colors.textMuted, ...typography.label, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
