import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function CreateSessionScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [notes, setNotes] = useState('');

  const { data: membersData } = useQuery({
    queryKey: ['assigned-members'],
    queryFn: () => api.get('/pt-sessions/assigned-members') as any,
  });

  const members: any[] = Array.isArray(membersData) ? membersData : (membersData as any)?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/pt-sessions', body) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-sessions'] });
      Alert.alert('Created!', 'PT session scheduled successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to create session'),
  });

  function submit() {
    if (!selectedMember) return Alert.alert('Required', 'Select a member');
    if (!date) return Alert.alert('Required', 'Enter session date (YYYY-MM-DD)');
    if (!startTime) return Alert.alert('Required', 'Enter start time (HH:MM)');

    const scheduledAt = `${date}T${startTime}:00`;
    createMutation.mutate({
      memberId: selectedMember.memberId ?? selectedMember.id,
      scheduledAt,
      duration: parseInt(durationMinutes) || 60,
      notes: notes || undefined,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Create PT Session</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Select Member</Text>
        {members.length === 0 ? (
          <Text style={styles.noMembers}>No assigned members found</Text>
        ) : (
          members.map((m: any) => {
            const isSelected = selectedMember?.memberId === m.memberId || selectedMember?.id === m.id;
            const name = m.memberName ?? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() ?? 'Member';
            return (
              <TouchableOpacity
                key={m.memberId ?? m.id}
                style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                onPress={() => setSelectedMember(m)}
                activeOpacity={0.7}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{name[0]?.toUpperCase() ?? 'M'}</Text>
                </View>
                <Text style={[styles.memberName, isSelected && styles.memberNameSelected]}>{name}</Text>
                {isSelected && <Text style={{ color: '#FF4D00', fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Session Details</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="2025-07-15"
            placeholderTextColor="#4B5563"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Start Time (HH:MM)</Text>
          <TextInput
            style={styles.input}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="09:00"
            placeholderTextColor="#4B5563"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Duration (minutes)</Text>
          <View style={styles.durationRow}>
            {[30, 45, 60, 90].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.durationChip, durationMinutes === String(d) && styles.durationChipActive]}
                onPress={() => setDurationMinutes(String(d))}
              >
                <Text style={[styles.durationChipText, durationMinutes === String(d) && styles.durationChipTextActive]}>
                  {d}m
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="number-pad"
              placeholder="Custom"
              placeholderTextColor="#4B5563"
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Session focus, exercises to cover…"
            placeholderTextColor="#4B5563"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.createBtn, createMutation.isPending && styles.createBtnDisabled]}
        onPress={submit}
        disabled={createMutation.isPending}
      >
        {createMutation.isPending
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.createBtnText}>Create Session</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  noMembers: { color: '#6B7280', fontSize: 13, fontStyle: 'italic' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#2A2A2A',
  },
  memberRowSelected: { borderColor: '#FF4D00' },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FF4D0030', alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { color: '#FF4D00', fontSize: 16, fontWeight: '700' },
  memberName: { flex: 1, color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
  memberNameSelected: { color: '#FF4D00' },
  field: { marginBottom: 14 },
  fieldLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 10, borderWidth: 1,
    borderColor: '#2A2A2A', color: '#F9FAFB', fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 0,
  },
  durationRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  durationChip: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  durationChipActive: { backgroundColor: '#FF4D00', borderColor: '#FF4D00' },
  durationChipText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  durationChipTextActive: { color: '#fff' },
  createBtn: { marginHorizontal: 20, backgroundColor: '#FF4D00', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
