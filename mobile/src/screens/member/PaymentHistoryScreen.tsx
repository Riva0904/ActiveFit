import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, EmptyState, Header, Loading, Screen } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: colors.success, PENDING: colors.warning, FAILED: colors.danger, REFUNDED: colors.textMuted,
};

export default function PaymentHistoryScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-payments'],
    queryFn: () => api.get('/payments/my') as any,
  });

  const items: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <Screen>
      <Header title="Payment History" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const color = STATUS_COLOR[item.status] ?? colors.textMuted;
            return (
              <Card padding="md" style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.desc}>{item.description ?? String(item.type ?? 'Payment').replace(/_/g, ' ')}</Text>
                  <Text style={styles.date}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : ''}{item.method ? ` · ${item.method}` : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.amount}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
                  <View style={[styles.badge, { backgroundColor: tint(color, '22') }]}>
                    <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
                  </View>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={<EmptyState icon="credit-card" title="No payments yet" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  desc: { color: colors.text, ...typography.body, fontWeight: '600', marginBottom: 2, textTransform: 'capitalize' },
  date: { color: colors.textMuted, ...typography.caption },
  amount: { color: colors.text, ...typography.h2, ...typography.number },
  badge: { borderRadius: radius.sm - 2, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
