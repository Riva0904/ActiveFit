import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Emergency', 'Other'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  APPROVED: '#22C55E',
  REJECTED: '#EF4444',
};

export default function LeaveScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [leaveType, setLeaveType] = useState('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/leave-requests/my') as any,
  });

  const applyMutation = useMutation({
    mutationFn: (body: any) => api.post('/leave-requests', body) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setShowForm(false);
      setLeaveType(''); setReason(''); setStartDate(''); setEndDate('');
      Alert.alert('Applied!', 'Leave request submitted for approval');
    },
    onError: (e: any) => Alert.alert('Error', e?.message),
  });

  const requests: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  function submit() {
    if (!leaveType) return Alert.alert('Required', 'Select leave type');
    if (!startDate) return Alert.alert('Required', 'Enter start date (YYYY-MM-DD)');
    if (!endDate) return Alert.alert('Required', 'Enter end date (YYYY-MM-DD)');
    if (!reason.trim()) return Alert.alert('Required', 'Enter reason for leave');
    applyMutation.mutate({
      leaveType: leaveType.toUpperCase().replace(/ /g, '_'),
      reason: reason.trim(),
      startDate,
      endDate,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Leave Requests</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.addBtnText}>+ Apply</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const statusColor = STATUS_COLORS[item.status] ?? '#6B7280';
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.leaveType}>{item.leaveType?.replace(/_/g, ' ')}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.leaveDates}>
                  {new Date(item.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {' → '}
                  {new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
                <Text style={styles.leaveReason}>{item.reason}</Text>
                {item.adminNote && <Text style={styles.adminNote}>Admin: {item.adminNote}</Text>}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 48 }}>📋</Text>
              <Text style={styles.emptyText}>No leave requests</Text>
              <Text style={styles.emptySub}>Tap + Apply to request a leave</Text>
            </View>
          }
        />
      )}

      <Modal visible={showForm} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Apply for Leave</Text>

            <Text style={styles.fieldLabel}>Leave Type</Text>
            <View style={styles.chipRow}>
              {LEAVE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, leaveType === t && styles.chipActive]}
                  onPress={() => setLeaveType(t)}
                >
                  <Text style={[styles.chipText, leaveType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {[
              { label: 'Start Date (YYYY-MM-DD)', value: startDate, set: setStartDate, placeholder: '2025-07-10' },
              { label: 'End Date (YYYY-MM-DD)', value: endDate, set: setEndDate, placeholder: '2025-07-12' },
            ].map(({ label, value, set, placeholder }) => (
              <View key={label} style={styles.field}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={set}
                  placeholder={placeholder}
                  placeholderTextColor="#4B5563"
                />
              </View>
            ))}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Reason</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={reason}
                onChangeText={setReason}
                multiline
                placeholder="Reason for leave…"
                placeholderTextColor="#4B5563"
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submit} disabled={applyMutation.isPending}>
                {applyMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  card: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  leaveType: { color: '#F9FAFB', fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  leaveDates: { color: '#9CA3AF', fontSize: 13, marginBottom: 6 },
  leaveReason: { color: '#6B7280', fontSize: 12 },
  adminNote: { color: '#FF4D00', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#4B5563', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { color: '#F9FAFB', fontSize: 18, fontWeight: '700', marginBottom: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  chipActive: { backgroundColor: '#FF4D00', borderColor: '#FF4D00' },
  chipText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  field: { marginBottom: 14 },
  fieldLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1, borderColor: '#2A2A2A', color: '#F9FAFB', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: '#2A2A2A', borderRadius: 12 },
  cancelBtnText: { color: '#9CA3AF', fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: '#FF4D00', borderRadius: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
});
