import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function ProgressLogScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['progress-logs'],
    queryFn: () => api.get('/progress-logs/my') as any,
  });

  const logMutation = useMutation({
    mutationFn: (body: any) => api.post('/progress-logs', body) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-logs'] });
      setShowForm(false);
      setWeight(''); setBodyFat(''); setChest(''); setWaist(''); setHips(''); setNotes('');
      Alert.alert('Logged!', 'Progress entry saved');
    },
    onError: (e: any) => Alert.alert('Error', e?.message),
  });

  const logs: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  function submit() {
    if (!weight) return Alert.alert('Required', 'Enter at least your weight');
    logMutation.mutate({
      weight: parseFloat(weight),
      bodyFatPercentage: bodyFat ? parseFloat(bodyFat) : undefined,
      chest: chest ? parseFloat(chest) : undefined,
      waist: waist ? parseFloat(waist) : undefined,
      hips: hips ? parseFloat(hips) : undefined,
      notes: notes || undefined,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Progress Log</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.addBtnText}>+ Log</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {logs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 48 }}>📊</Text>
              <Text style={styles.emptyText}>No progress logged yet</Text>
              <Text style={styles.emptySub}>Tap + Log to record your measurements</Text>
            </View>
          ) : (
            logs.map((log: any, i: number) => (
              <View key={log.id ?? i} style={styles.card}>
                <Text style={styles.logDate}>
                  {new Date(log.date ?? log.createdAt).toLocaleDateString('en-IN', {
                    weekday: 'short', day: 'numeric', month: 'short',
                  })}
                </Text>
                <View style={styles.metricsRow}>
                  {log.weight && <Metric label="Weight" value={`${log.weight} kg`} highlight />}
                  {log.bodyFatPercentage && <Metric label="Body Fat" value={`${log.bodyFatPercentage}%`} />}
                  {log.chest && <Metric label="Chest" value={`${log.chest} cm`} />}
                  {log.waist && <Metric label="Waist" value={`${log.waist} cm`} />}
                  {log.hips && <Metric label="Hips" value={`${log.hips} cm`} />}
                </View>
                {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Log Progress</Text>
            <ScrollView>
              {[
                { label: 'Weight (kg) *', value: weight, set: setWeight },
                { label: 'Body Fat %', value: bodyFat, set: setBodyFat },
                { label: 'Chest (cm)', value: chest, set: setChest },
                { label: 'Waist (cm)', value: waist, set: setWaist },
                { label: 'Hips (cm)', value: hips, set: setHips },
              ].map(({ label, value, set }) => (
                <View key={label} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={set}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#4B5563"
                  />
                </View>
              ))}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  placeholder="Optional notes…"
                  placeholderTextColor="#4B5563"
                />
              </View>
            </ScrollView>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submit} disabled={logMutation.isPending}>
                {logMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color: highlight ? '#FF4D00' : '#F9FAFB', fontSize: 15, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: '#6B7280', fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 20 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  addBtn: { backgroundColor: '#FF4D00', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#4B5563', fontSize: 13 },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#2A2A2A',
  },
  logDate: { color: '#F9FAFB', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  metricsRow: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  logNotes: { color: '#6B7280', fontSize: 12, marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '80%',
  },
  modalTitle: { color: '#F9FAFB', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  field: { marginBottom: 14 },
  fieldLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1,
    borderColor: '#2A2A2A', color: '#F9FAFB', fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#2A2A2A', borderRadius: 12,
  },
  cancelBtnText: { color: '#9CA3AF', fontWeight: '600' },
  saveBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#FF4D00', borderRadius: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
