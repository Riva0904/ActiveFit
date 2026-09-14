import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button, Card, EmptyState, Header, Loading, Screen } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

export default function MyMembershipScreen({ navigation }: any) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-membership'],
    queryFn: () => api.get('/memberships/my') as any,
  });

  const membership = (data as any)?.data?.[0] ?? (Array.isArray(data) ? data[0] : data);
  const active = membership?.status === 'ACTIVE';

  return (
    <Screen scroll>
      <Header title="My Membership" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : error || !membership ? (
        <EmptyState
          icon="award"
          title="No active membership"
          subtitle="Choose a plan to get started"
          action={{ label: 'Browse plans', onPress: () => navigation.navigate('MembershipRenewal') }}
        />
      ) : (
        <>
          <Card accent={active ? 'primary' : 'danger'}>
            <Text style={styles.planName}>{membership.plan?.name ?? 'Membership Plan'}</Text>
            <Text style={styles.planType}>{membership.plan?.type}</Text>
            <View style={[styles.badge, { backgroundColor: active ? colors.success : colors.danger }]}>
              <Text style={styles.badgeText}>{membership.status}</Text>
            </View>
          </Card>

          <Card padding="none">
            {[
              { label: 'Start date', value: membership.startDate ? new Date(membership.startDate).toLocaleDateString('en-IN') : '-' },
              { label: 'End date', value: membership.endDate ? new Date(membership.endDate).toLocaleDateString('en-IN') : '-' },
              { label: 'Duration', value: membership.plan?.durationMonths ? `${membership.plan.durationMonths} month(s)` : '-' },
              { label: 'Amount paid', value: membership.amount != null ? `₹${Number(membership.amount).toLocaleString('en-IN')}` : '-' },
            ].map(({ label, value }, i, arr) => (
              <View key={label} style={[styles.row, i < arr.length - 1 && styles.rowBorder]}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
              </View>
            ))}
          </Card>

          <Button title="Renew or change plan" variant="secondary" icon="refresh-cw" onPress={() => navigation.navigate('MembershipRenewal')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  planName: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  planType: { color: colors.textSecondary, ...typography.label, marginBottom: spacing.md },
  badge: { alignSelf: 'flex-start', borderRadius: radius.sm - 2, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.white, ...typography.caption, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.textSecondary, ...typography.body },
  rowValue: { color: colors.text, ...typography.body, fontWeight: '600', ...typography.number },
});
