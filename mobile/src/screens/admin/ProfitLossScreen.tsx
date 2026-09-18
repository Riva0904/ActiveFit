import React, { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Card, Chip, ChipRow, EmptyState, Enter, Header, Icon, Loading, Screen, SectionTitle, StatRow, type IconName,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface AuditReport {
  month: number;
  year: number;
  revenue: { membership: number; pt: number; supplement: number; total: number };
  expenses: { byCategory: { category: string; _sum: { amount: number | null } }[]; total: number };
  profit: number;
  profitMargin: number;
  trend: { label: string; revenue: number; expenses: number; profit: number }[];
}

const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

const CATEGORY_META: Record<string, { label: string; icon: IconName; color: string }> = {
  TRAINER_SALARY: { label: 'Trainer salary', icon: 'dumbbell', color: colors.info },
  STAFF_SALARY: { label: 'Staff salary', icon: 'users', color: colors.cyan },
  ELECTRICITY: { label: 'Electricity', icon: 'zap', color: colors.warning },
  WATER: { label: 'Water', icon: 'activity', color: colors.cyan },
  RENT: { label: 'Rent', icon: 'home', color: colors.primary },
  EQUIPMENT_MAINTENANCE: { label: 'Equipment', icon: 'settings', color: colors.purple },
  INTERNET: { label: 'Internet', icon: 'smartphone', color: colors.info },
  MARKETING: { label: 'Marketing', icon: 'trending-up', color: colors.pink },
  OTHER: { label: 'Other', icon: 'more-horizontal', color: colors.textMuted },
};

/**
 * What the gym earned against what it spent.
 *
 * The figures come straight from `GET /expenses/audit`, which has computed them
 * since the web dashboard shipped — the app only ever listed raw expense rows,
 * so an admin could see costs but never the profit they add up to.
 */
export default function ProfitLossScreen({ navigation }: any) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const year = now.getFullYear();
  const scope = useGymScope();

  const { data, isLoading, isRefetching, refetch, error } = useQuery<AuditReport>({
    queryKey: scope.key(['expense-audit', month, year]),
    queryFn: () => api.get('/expenses/audit', { params: scope.params({ month, year }) }) as any,
  });

  // The entitlement guard answers 403 when the gym's plan does not include it.
  const locked = (error as any)?.statusCode === 403;
  if (locked) {
    return (
      <Screen scroll>
        <Header title="Earnings & expenses" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="lock"
          title="Not on your plan"
          subtitle="The profit report is included from the Professional plan upward."
          action={{ label: 'See plans', onPress: () => navigation.navigate('Subscription') }}
        />
      </Screen>
    );
  }

  if (isLoading) return <Loading fullScreen />;

  const r = data;
  const profit = r?.profit ?? 0;
  const inProfit = profit >= 0;
  const trend = r?.trend ?? [];
  const peak = Math.max(1, ...trend.flatMap((t) => [t.revenue, t.expenses]));

  const categories = (r?.expenses.byCategory ?? [])
    .map((c) => ({ category: c.category, amount: c._sum.amount ?? 0 }))
    .sort((a, b) => b.amount - a.amount);
  const expenseTotal = r?.expenses.total ?? 0;

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Header
        title="Earnings & expenses"
        subtitle={new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
        onBack={() => navigation.goBack()}
      />

      <ChipRow>
        {Array.from({ length: 6 }, (_, i) => {
          const d = new Date(year, now.getMonth() - i, 1);
          return (
            <Chip
              key={i}
              label={d.toLocaleString('en-IN', { month: 'short' })}
              selected={month === d.getMonth() + 1}
              onPress={() => setMonth(d.getMonth() + 1)}
            />
          );
        })}
      </ChipRow>

      <Enter index={0}>
        <Card accent={inProfit ? 'primary' : 'danger'} glow={inProfit} style={styles.heroCard}>
          <Text style={styles.heroLabel}>{inProfit ? 'Profit' : 'Loss'}</Text>
          <Text style={[styles.hero, { color: inProfit ? colors.success : colors.danger }]}>
            {money(Math.abs(profit))}
          </Text>
          <Text style={styles.margin}>
            {r?.profitMargin ?? 0}% margin on {money(r?.revenue.total ?? 0)} earned
          </Text>
          <StatRow style={styles.stats} items={[
            { label: 'Total earning', value: money(r?.revenue.total ?? 0), color: colors.success },
            { label: 'Total expense', value: money(expenseTotal), color: colors.danger },
          ]} />
        </Card>
      </Enter>

      <Enter index={1}>
        <SectionTitle title="Where the money came from" />
        <Card padding="md">
          <Source label="Memberships" value={r?.revenue.membership ?? 0} total={r?.revenue.total ?? 0} color={colors.primary} icon="credit-card" />
          <Source label="PT sessions" value={r?.revenue.pt ?? 0} total={r?.revenue.total ?? 0} color={colors.info} icon="dumbbell" />
          <Source label="Supplements" value={r?.revenue.supplement ?? 0} total={r?.revenue.total ?? 0} color={colors.purple} icon="pill" />
        </Card>
      </Enter>

      <Enter index={2}>
        <SectionTitle title="Where it went" />
        {categories.length === 0 ? (
          <Card padding="md">
            <Text style={styles.empty}>No expenses recorded this month.</Text>
          </Card>
        ) : (
          <Card padding="md">
            {categories.map((c) => {
              const meta = CATEGORY_META[c.category] ?? CATEGORY_META.OTHER;
              return (
                <Source
                  key={c.category}
                  label={meta.label}
                  value={c.amount}
                  total={expenseTotal}
                  color={meta.color}
                  icon={meta.icon}
                />
              );
            })}
          </Card>
        )}
      </Enter>

      {trend.length > 0 && (
        <Enter index={3}>
          <SectionTitle title="Last 6 months" />
          <Card padding="md">
            <View style={styles.chart}>
              {trend.map((t) => (
                <View key={t.label} style={styles.chartCol}>
                  <View style={styles.bars}>
                    <View style={[styles.bar, { height: `${(t.revenue / peak) * 100}%`, backgroundColor: colors.success }]} />
                    <View style={[styles.bar, { height: `${(t.expenses / peak) * 100}%`, backgroundColor: colors.danger }]} />
                  </View>
                  <Text style={styles.chartLabel} numberOfLines={1}>{t.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <LegendDot color={colors.success} label="Earned" />
              <LegendDot color={colors.danger} label="Spent" />
            </View>
          </Card>
        </Enter>
      )}
    </Screen>
  );
}

function Source({ label, value, total, color, icon }: { label: string; value: number; total: number; color: string; icon: IconName }) {
  const pct = total > 0 ? value / total : 0;
  return (
    <View style={styles.sourceRow}>
      <Icon name={icon} size={14} color={color} />
      <Text style={styles.sourceLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, pct * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.sourceAmount}>{money(value)}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: { marginTop: spacing.md },
  heroLabel: { color: colors.textMuted, ...typography.micro, textTransform: 'uppercase', letterSpacing: 1 },
  hero: { ...typography.hero, marginTop: 2 },
  margin: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xs },
  stats: { marginTop: spacing.lg },

  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  sourceLabel: { color: colors.textSecondary, ...typography.caption, width: 96 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  sourceAmount: { color: colors.text, ...typography.caption, ...typography.number, width: 84, textAlign: 'right' },

  empty: { color: colors.textMuted, ...typography.caption },

  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: spacing.sm },
  chartCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 96 },
  bar: { width: 9, borderRadius: radius.sm, minHeight: 2 },
  chartLabel: { color: colors.textMuted, ...typography.micro },

  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textMuted, ...typography.micro },
});
