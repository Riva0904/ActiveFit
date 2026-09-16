import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Avatar, Button, Card, Chip, ChipRow, EmptyState, Header, Icon, Loading, PressScale, Screen, SectionTitle, StatRow,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');

const TABS = [
  { value: 'pending-upi', label: 'To confirm' },
  { value: 'all', label: 'All payments' },
];

export default function PaymentsScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('pending-upi');

  const scope = useGymScope();

  const stats = useQuery({
    queryKey: scope.key(['payment-stats']),
    queryFn: () => api.get('/payments/stats', { params: scope.params() }) as any,
    staleTime: 60_000,
  });

  const pending = useQuery({
    queryKey: scope.key(['pending-upi']),
    queryFn: () => api.get('/payments/manual-upi/pending', { params: scope.params() }) as any,
    enabled: tab === 'pending-upi',
  });

  const all = useQuery({
    queryKey: scope.key(['payments-all']),
    queryFn: () => api.get('/payments', { params: scope.params({ limit: 50 }) }) as any,
    enabled: tab === 'all',
  });

  const confirm = useMutation({
    mutationFn: (id: string) => api.post(`/payments/${id}/confirm-upi`) as any,
    onSuccess: () => {
      Alert.alert('Confirmed', 'The payment has been marked as received.');
      queryClient.invalidateQueries({ queryKey: scope.key(['pending-upi']) });
      queryClient.invalidateQueries({ queryKey: scope.key(['payments-all']) });
      queryClient.invalidateQueries({ queryKey: scope.key(['payment-stats']) });
      queryClient.invalidateQueries({ queryKey: ['gym-stats'] });
    },
    onError: (e: any) => Alert.alert('Could not confirm', e?.message ?? 'Try again'),
  });

  const active = tab === 'pending-upi' ? pending : all;
  const rows: any[] = Array.isArray(active.data) ? active.data : (active.data?.data ?? []);
  const s: any = stats.data ?? {};

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header title="Payments" subtitle="Money coming in" onBack={() => navigation.goBack()} />

        <Card padding="md">
          <StatRow items={[
            { label: 'This month', value: money(s.thisMonth ?? s.monthlyRevenue ?? 0), color: colors.success },
            { label: 'Total', value: money(s.total ?? s.totalRevenue ?? 0) },
            { label: 'Pending', value: s.pending ?? s.pendingCount ?? 0, color: colors.warning },
          ]} />
        </Card>

        <View style={styles.tabs}>
          <ChipRow>
            {TABS.map((t) => (
              <Chip key={t.value} label={t.label} selected={tab === t.value} onPress={() => setTab(t.value)} />
            ))}
          </ChipRow>
        </View>

        <SectionTitle
          title={tab === 'pending-upi' ? 'Members who say they paid' : 'Recent payments'}
        />
      </View>

      {active.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p, i) => p.id ?? String(i)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={active.refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'pending-upi' ? 'check' : 'credit-card'}
              title={tab === 'pending-upi' ? 'Nothing to confirm' : 'No payments yet'}
              subtitle={tab === 'pending-upi' ? 'UPI payments waiting on you appear here.' : 'Payments show up as members pay.'}
            />
          }
          renderItem={({ item }) => {
            const u = item.member?.user ?? item.user ?? {};
            const isPending = tab === 'pending-upi';
            return (
              <View style={styles.row}>
                <Avatar firstName={u.firstName} lastName={u.lastName} size={40} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {u.firstName ?? 'Member'} {u.lastName ?? ''}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.type?.replace(/_/g, ' ') ?? 'Payment'} · {day(item.memberConfirmedAt ?? item.paidAt ?? item.createdAt)}
                    {item.member?.memberCode ? ` · ${item.member.memberCode}` : ''}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>{money(item.amount ?? 0)}</Text>
                  {isPending ? (
                    <PressScale
                      style={styles.confirmBtn}
                      onPress={() =>
                        Alert.alert(
                          'Confirm this payment?',
                          `Only confirm after you see ${money(item.amount ?? 0)} in your UPI or bank app.`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Confirm', onPress: () => confirm.mutate(item.id) },
                          ],
                        )
                      }
                    >
                      <Icon name="check" size={13} color={colors.white} />
                      <Text style={styles.confirmText}>Confirm</Text>
                    </PressScale>
                  ) : (
                    <View style={[styles.pill, { backgroundColor: tint(item.status === 'COMPLETED' ? colors.success : colors.warning, '22') }]}>
                      <Text style={[styles.pillText, { color: item.status === 'COMPLETED' ? colors.success : colors.warning }]}>
                        {item.status === 'COMPLETED' ? 'Paid' : item.status}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  tabs: { marginTop: spacing.md },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.h2 },
  rowMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowAmount: { color: colors.text, ...typography.h2, ...typography.number },
  pill: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { ...typography.micro, fontWeight: '700' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success,
    borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4,
  },
  confirmText: { color: colors.white, ...typography.micro, fontWeight: '700' },
});
