import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, Enter, GlowOrb, Header, Icon, Loading, Screen, SectionTitle, StatRow } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

const TIER_COLOR: Record<string, string> = {
  STARTER: colors.textMuted,
  PROFESSIONAL: colors.primary,
  ENTERPRISE: colors.purple,
};

export default function RevenueScreen({ navigation }: any) {
  const revenue = useQuery({
    queryKey: ['platform-revenue'],
    queryFn: () => api.get('/saas-plans/revenue') as any,
    staleTime: 5 * 60_000,
  });

  const commission = useQuery({
    queryKey: ['platform-commission'],
    queryFn: () => api.get('/analytics/platform/revenue') as any,
    staleTime: 5 * 60_000,
  });

  if (revenue.isLoading) return <Loading fullScreen />;

  const r: any = revenue.data ?? {};
  const c: any = commission.data ?? {};
  const tiers: any[] = r.tierBreakdown ?? r.byTier ?? [];

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={revenue.isRefetching}
          onRefresh={() => { revenue.refetch(); commission.refetch(); }}
          tintColor={colors.primary}
        />
      }
    >
      <Header title="Revenue" subtitle="What the platform earns" />

      <Enter index={0}>
        <Card glow>
          <GlowOrb size={220} intensity={0.35} breathe style={styles.glow} />
          <Text style={styles.heroLabel}>This month</Text>
          <Text style={styles.hero}>{money(r.thisMonth ?? 0)}</Text>
          <StatRow style={styles.stats} items={[
            { label: 'This year', value: money(r.thisYear ?? 0) },
            { label: 'All time', value: money(r.allTime ?? 0), color: colors.success },
          ]} />
        </Card>
      </Enter>

      <Enter index={1}>
        <Card onPress={() => navigation.navigate('SaaSPlans')} padding="md">
          <View style={styles.packsRow}>
            <Icon name="crown-outline" size={20} color={colors.purple} />
            <View style={{ flex: 1 }}>
              <Text style={styles.packsTitle}>Subscription packs</Text>
              <Text style={styles.packsHint}>Edit prices, limits and commission</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </View>
        </Card>
      </Enter>

      {tiers.length > 0 && (
        <Enter index={2}>
          <SectionTitle title="By pack" />
          <Card>
            {tiers.map((t: any, i: number) => {
              const name = t.plan ?? t.name ?? 'Plan';
              const color = TIER_COLOR[name] ?? colors.primary;
              return (
                <View key={name} style={[styles.tierRow, i > 0 && styles.tierDivider]}>
                  <View style={[styles.tierDot, { backgroundColor: color }]} />
                  <Text style={styles.tierName}>{name}</Text>
                  <Text style={styles.tierGyms}>{t.gymCount ?? t.gyms ?? 0} gyms</Text>
                  <Text style={styles.tierRevenue}>{money(t.revenue ?? 0)}</Text>
                </View>
              );
            })}
          </Card>
        </Enter>
      )}

      <Enter index={3}>
        <SectionTitle title="Commission from gyms" />
        <Card>
          <View style={styles.commissionTop}>
            <Icon name="percent" size={18} color={colors.cyan} />
            <Text style={styles.commissionValue}>{money(c.thisMonth ?? c.total ?? 0)}</Text>
          </View>
          <Text style={styles.commissionHint}>
            A share of what gyms collect from their members, set per pack. It stays at zero until you give a pack a
            commission rate.
          </Text>
        </Card>
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glow: { top: -90, right: -70 },
  heroLabel: { color: colors.textMuted, ...typography.micro, textTransform: 'uppercase', letterSpacing: 1 },
  hero: { color: colors.text, ...typography.hero, marginTop: 2 },
  stats: { marginTop: spacing.lg },

  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  tierDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierName: { color: colors.text, ...typography.body, fontWeight: '700', flex: 1 },
  tierGyms: { color: colors.textMuted, ...typography.caption, width: 64, textAlign: 'right' },
  tierRevenue: { color: colors.text, ...typography.body, ...typography.number, width: 96, textAlign: 'right' },

  packsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  packsTitle: { color: colors.text, ...typography.body, fontWeight: '700' },
  packsHint: { color: colors.textMuted, ...typography.caption, marginTop: 2 },

  commissionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commissionValue: { color: colors.text, ...typography.title, ...typography.number },
  commissionHint: { color: colors.textMuted, ...typography.caption, marginTop: spacing.sm },
});
