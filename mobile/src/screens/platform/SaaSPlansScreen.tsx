import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, EmptyState, Enter, Header, Icon, Loading, Screen } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

export interface SaaSPlan {
  id: string;
  name: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  monthlyPrice: number;
  yearlyPrice: number;
  maxMembers: number;
  maxTrainers: number;
  maxStaff: number;
  maxBranches: number;
  features: string[];
  commissionPct: number;
  isActive: boolean;
}

const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

const TIER_COLOR: Record<string, string> = {
  STARTER: colors.textMuted,
  PROFESSIONAL: colors.primary,
  ENTERPRISE: colors.purple,
};

/**
 * The three packs gyms buy. They are enum-backed rows, so there is deliberately
 * no create or delete — only editing what each tier costs and allows.
 */
export default function SaaSPlansScreen({ navigation }: any) {
  const plansQ = useQuery<SaaSPlan[]>({
    queryKey: ['saas-plans'],
    queryFn: () => api.get('/saas-plans') as any,
    staleTime: 60_000,
  });

  if (plansQ.isLoading) return <Loading fullScreen />;
  const plans = Array.isArray(plansQ.data) ? plansQ.data : [];

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={plansQ.isRefetching} onRefresh={plansQ.refetch} tintColor={colors.primary} />}
    >
      <Header
        title="Subscription packs"
        subtitle="What gyms pay, and what each pack allows"
        onBack={() => navigation.goBack()}
      />

      {plans.length === 0 ? (
        <EmptyState
          icon="crown-outline"
          title="No packs yet"
          subtitle="Seed the default tiers from the web dashboard, then edit them here."
        />
      ) : (
        plans.map((p, i) => {
          const color = TIER_COLOR[p.plan] ?? colors.primary;
          return (
            <Enter key={p.id} index={i}>
              <Card onPress={() => navigation.navigate('SaaSPlanEdit', { plan: p })}>
                <View style={styles.top}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={styles.name}>{p.name}</Text>
                  {!p.isActive ? (
                    <View style={styles.offChip}><Text style={styles.offText}>Hidden</Text></View>
                  ) : null}
                  <Icon name="chevron-right" size={18} color={colors.textMuted} />
                </View>

                <Text style={styles.price}>
                  {money(p.monthlyPrice)}<Text style={styles.per}> /month</Text>
                </Text>
                <Text style={styles.yearly}>{money(p.yearlyPrice)} billed yearly</Text>

                <View style={styles.limits}>
                  <Limit label="Members" value={p.maxMembers} />
                  <Limit label="Trainers" value={p.maxTrainers} />
                  <Limit label="Staff" value={p.maxStaff} />
                  <Limit label="Branches" value={p.maxBranches} />
                </View>

                <Text style={styles.commission}>
                  {p.commissionPct > 0
                    ? `${p.commissionPct}% commission on what the gym collects`
                    : 'No commission on gym collections'}
                </Text>
              </Card>
            </Enter>
          );
        })
      )}
    </Screen>
  );
}

function Limit({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.limit}>
      <Text style={styles.limitValue}>{value}</Text>
      <Text style={styles.limitLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: colors.text, ...typography.h2, flex: 1 },
  offChip: { backgroundColor: tint(colors.warning, '1F'), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  offText: { color: colors.warning, ...typography.micro, fontWeight: '800' },

  price: { color: colors.text, ...typography.title, ...typography.number },
  per: { color: colors.textMuted, ...typography.caption },
  yearly: { color: colors.textMuted, ...typography.caption, marginTop: 2 },

  limits: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  limit: { alignItems: 'flex-start' },
  limitValue: { color: colors.text, ...typography.body, fontWeight: '700', ...typography.number },
  limitLabel: { color: colors.textMuted, ...typography.micro },

  commission: { color: colors.textMuted, ...typography.caption, marginTop: spacing.lg },
});
