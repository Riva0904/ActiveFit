import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function MyMembershipScreen({ navigation }: any) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-membership'],
    queryFn: () => api.get('/memberships/my') as any,
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Membership</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.empty}>No membership data found</Text>
      ) : !data ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🏅</Text>
          <Text style={styles.emptyTitle}>No Active Membership</Text>
          <Text style={styles.emptyText}>Contact your gym admin to get a membership plan</Text>
        </View>
      ) : (
        <>
          <View style={[styles.card, { borderColor: '#FF4D00' }]}>
            <Text style={styles.planName}>{data.plan?.name ?? 'Membership Plan'}</Text>
            <Text style={styles.planType}>{data.plan?.type}</Text>
            <View style={[styles.badge, { backgroundColor: data.status === 'ACTIVE' ? '#22C55E' : '#EF4444' }]}>
              <Text style={styles.badgeText}>{data.status}</Text>
            </View>
          </View>

          {[
            { label: 'Start Date', value: data.startDate ? new Date(data.startDate).toLocaleDateString('en-IN') : '-' },
            { label: 'End Date', value: data.endDate ? new Date(data.endDate).toLocaleDateString('en-IN') : '-' },
            { label: 'Duration', value: data.plan?.durationMonths ? `${data.plan.durationMonths} month(s)` : '-' },
            { label: 'Amount Paid', value: data.amountPaid != null ? `₹${data.amountPaid}` : '-' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { marginBottom: 12 },
  backText: { color: '#FF4D00', fontSize: 16 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  empty: { color: '#4B5563', textAlign: 'center', marginTop: 40 },
  emptyCard: { margin: 20, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#F9FAFB', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center' },
  card: {
    marginHorizontal: 20, marginBottom: 20, backgroundColor: '#1A1A1A',
    borderRadius: 16, padding: 20, borderWidth: 1,
  },
  planName: { color: '#F9FAFB', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  planType: { color: '#9CA3AF', fontSize: 14, marginBottom: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  rowLabel: { color: '#9CA3AF', fontSize: 14 },
  rowValue: { color: '#F9FAFB', fontSize: 14, fontWeight: '600' },
});
