import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B', CONFIRMED: '#3B82F6', SHIPPED: '#8B5CF6',
  DELIVERED: '#22C55E', CANCELLED: '#EF4444',
};

export default function OrderHistoryScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplement-orders'],
    queryFn: () => api.get('/supplements/orders') as any,
  });

  const orders: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Order History</Text>
      </View>

      {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={orders}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderId}>Order #{item.id?.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.date}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : ''}</Text>
                  <Text style={styles.items}>
                    {(item.items ?? item.orderItems ?? []).map((i: any) => i.supplement?.name ?? i.name).filter(Boolean).join(', ') || 'Supplement order'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.amount}>₹{item.totalAmount ?? item.amount}</Text>
                  <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] ?? '#6B7280' }]}>
                    <Text style={styles.badgeText}>{item.status}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  orderId: { color: '#F9FAFB', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  date: { color: '#6B7280', fontSize: 12, marginBottom: 4 },
  items: { color: '#9CA3AF', fontSize: 12, lineHeight: 18 },
  amount: { color: '#FF4D00', fontSize: 16, fontWeight: '700' },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  empty: { color: '#4B5563', textAlign: 'center', marginTop: 40 },
});
