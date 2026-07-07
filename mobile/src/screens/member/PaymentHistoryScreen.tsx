import React from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#22C55E', PENDING: '#F59E0B', FAILED: '#EF4444', REFUNDED: '#6B7280',
};

export default function PaymentHistoryScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-payments'],
    queryFn: () => api.get('/payments/my') as any,
  });

  const items: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Payment History</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyTitle}>No payments yet</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.desc}>{item.description ?? item.type ?? 'Payment'}</Text>
                <Text style={styles.date}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>₹{item.amount}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] ?? '#6B7280' }]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { marginBottom: 12 },
  backText: { color: '#FF4D00', fontSize: 16 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  emptyCard: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#9CA3AF', fontSize: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  desc: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  date: { color: '#6B7280', fontSize: 12 },
  amount: { color: '#FF4D00', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
