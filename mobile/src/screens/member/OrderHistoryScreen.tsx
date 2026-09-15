import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, EmptyState, Header, Loading, Screen } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const STATUS_COLOR: Record<string, string> = {
  PENDING: colors.warning, CONFIRMED: colors.info, DELIVERED: colors.success, CANCELLED: colors.danger,
};

export default function OrderHistoryScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['supplement-orders'],
    queryFn: () => api.get('/supplements/orders') as any,
  });

  const orders: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <Screen>
      <Header title="Order History" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const color = STATUS_COLOR[item.status] ?? colors.textMuted;
            const names = (item.items ?? item.orderItems ?? []).map((i: any) => i.supplement?.name ?? i.name).filter(Boolean).join(', ');
            return (
              <Card padding="md" style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderId}>{item.orderNumber ?? `Order #${item.id?.slice(-8).toUpperCase()}`}</Text>
                  <Text style={styles.date}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : ''}</Text>
                  <Text style={styles.items} numberOfLines={2}>{names || 'Supplement order'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.amount}>₹{Number(item.totalAmount ?? item.amount).toLocaleString('en-IN')}</Text>
                  <View style={[styles.badge, { backgroundColor: tint(color, '22') }]}><Text style={[styles.badgeText, { color }]}>{item.status}</Text></View>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={<EmptyState icon="package" title="No orders yet" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  orderId: { color: colors.text, ...typography.label, fontWeight: '700', marginBottom: 2, ...typography.number },
  date: { color: colors.textMuted, ...typography.caption, marginBottom: 4 },
  items: { color: colors.textSecondary, ...typography.caption, lineHeight: 18 },
  amount: { color: colors.text, ...typography.h2, ...typography.number },
  badge: { borderRadius: radius.sm - 2, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
