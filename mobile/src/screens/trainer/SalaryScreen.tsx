import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const STATUS_COLORS: Record<string, string> = {
  PAID: '#22C55E',
  PENDING: '#F59E0B',
  PROCESSING: '#3B82F6',
};

export default function SalaryScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['salary-payouts'],
    queryFn: () => api.get('/salary-payouts/my') as any,
  });

  const payouts: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  const totalPaid = payouts
    .filter((p: any) => p.status === 'PAID')
    .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Salary History</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Earned (YTD)</Text>
        <Text style={styles.summaryAmount}>₹{totalPaid.toLocaleString('en-IN')}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const statusColor = STATUS_COLORS[item.status] ?? '#6B7280';
            const periodLabel = item.month
              ? new Date(item.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
              : item.period ?? 'Unknown period';
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.period}>{periodLabel}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.amountLabel}>Base</Text>
                    <Text style={styles.amount}>₹{(item.baseSalary ?? item.amount ?? 0).toLocaleString('en-IN')}</Text>
                  </View>
                  {item.bonus != null && (
                    <View>
                      <Text style={styles.amountLabel}>Bonus</Text>
                      <Text style={[styles.amount, { color: '#22C55E' }]}>+₹{item.bonus.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  {item.deductions != null && (
                    <View>
                      <Text style={styles.amountLabel}>Deductions</Text>
                      <Text style={[styles.amount, { color: '#EF4444' }]}>−₹{item.deductions.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.amountLabel}>Net</Text>
                    <Text style={[styles.amount, { color: '#FF4D00', fontSize: 18 }]}>
                      ₹{(item.netSalary ?? item.amount ?? 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
                {item.paidAt && (
                  <Text style={styles.paidAt}>
                    Paid on {new Date(item.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
                {item.paymentMethod && (
                  <Text style={styles.payMethod}>{item.paymentMethod}</Text>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 48 }}>💰</Text>
              <Text style={styles.emptyText}>No salary records yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 20 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  summaryCard: {
    marginHorizontal: 20, marginBottom: 20, backgroundColor: '#1A1A1A',
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#FF4D00',
    alignItems: 'center',
  },
  summaryLabel: { color: '#9CA3AF', fontSize: 13, marginBottom: 8 },
  summaryAmount: { color: '#FF4D00', fontSize: 32, fontWeight: '800' },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  period: { color: '#F9FAFB', fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  amountLabel: { color: '#6B7280', fontSize: 11, marginBottom: 2 },
  amount: { color: '#F9FAFB', fontSize: 14, fontWeight: '700' },
  paidAt: { color: '#9CA3AF', fontSize: 11, marginTop: 10 },
  payMethod: { color: '#4B5563', fontSize: 11, marginTop: 2 },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
});
