import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Card, Enter, GlowOrb, Header, HeroStat, Icon, Loading, PressScale, Screen, SectionTitle, StatRow, type IconName } from '../../components';
import { colors, radius, shadow, spacing, tint, typography } from '../../theme';

interface PlatformStats {
  totalGyms: number;
  activeGyms: number;
  totalUsers: number;
  usersByRole: { members: number; trainers: number; staff: number; gymAdmins: number };
  subscriptions: { active: number; trial: number; expired: number };
}

const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const count = (n: number) => (n ?? 0).toLocaleString('en-IN');

/**
 * How big the platform is, counted in the database.
 *
 * The Gyms screen used to derive these numbers client-side from the first page
 * of gyms, which silently under-reported once the platform passed 100 gyms.
 */
export default function PlatformDashboardScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);

  const statsQ = useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: () => api.get('/analytics/platform/stats') as any,
    staleTime: 60_000,
  });

  const revenueQ = useQuery({
    queryKey: ['platform-revenue'],
    queryFn: () => api.get('/saas-plans/revenue') as any,
    staleTime: 5 * 60_000,
  });

  if (statsQ.isLoading) return <Loading fullScreen />;

  const s = statsQ.data;
  const r: any = revenueQ.data ?? {};
  const pendingTrial = s?.subscriptions.trial ?? 0;

  const quickActions: { label: string; icon: IconName; onPress: () => void }[] = [
    { label: 'Gyms', icon: 'bank-outline', onPress: () => navigation.navigate('Gyms') },
    { label: 'Approvals', icon: 'inbox', onPress: () => navigation.navigate('Approvals') },
    { label: 'Packs', icon: 'crown-outline', onPress: () => navigation.navigate('Revenue', { screen: 'SaaSPlans' }) },
    { label: 'Support', icon: 'headphones', onPress: () => navigation.navigate('Support') },
  ];

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={statsQ.isRefetching}
          onRefresh={() => { statsQ.refetch(); revenueQ.refetch(); }}
          tintColor={colors.primary}
        />
      }
    >
      <Header title="Platform" subtitle={`Signed in as ${user?.firstName ?? 'operator'}`} />

      <Enter index={0}>
        <Card glow>
          <GlowOrb size={220} intensity={0.35} breathe style={styles.glow} />
          <HeroStat value={count(s?.totalGyms ?? 0)} label="Gyms on ActiveBoost" />
          <StatRow style={styles.stats} items={[
            { label: 'Active', value: count(s?.activeGyms ?? 0), color: colors.success },
            { label: 'On trial', value: count(pendingTrial), color: pendingTrial > 0 ? colors.warning : undefined },
            { label: 'Expired', value: count(s?.subscriptions.expired ?? 0) },
          ]} />
        </Card>
      </Enter>

      <Enter index={1}>
        <Card accent="primary">
          <HeroStat value={count(s?.totalUsers ?? 0)} label="People using the app" />
          <StatRow style={styles.stats} items={[
            { label: 'Members', value: count(s?.usersByRole.members ?? 0) },
            { label: 'Trainers', value: count(s?.usersByRole.trainers ?? 0) },
            { label: 'Front desk', value: count(s?.usersByRole.staff ?? 0) },
            { label: 'Admins', value: count(s?.usersByRole.gymAdmins ?? 0) },
          ]} />
        </Card>
      </Enter>

      <Enter index={2}>
        <SectionTitle title="Revenue" action={{ label: 'Details', onPress: () => navigation.navigate('Revenue') }} />
        <Card>
          <View style={styles.revenueTop}>
            <Icon name="cash-multiple" size={18} color={colors.success} />
            <Text style={styles.revenueValue}>{money(r.thisMonth ?? 0)}</Text>
            <Text style={styles.revenueLabel}>this month</Text>
          </View>
          <Text style={styles.revenueHint}>All time {money(r.allTime ?? 0)}</Text>
        </Card>
      </Enter>

      <Enter index={3}>
        <SectionTitle title="Quick actions" />
        <View style={styles.quickGrid}>
          {quickActions.map((a, i) => (
            <Enter key={a.label} index={3 + i} style={styles.quickCell}>
              <PressScale style={styles.quickCard} onPress={a.onPress} scaleTo={0.93}>
                <View style={styles.quickIcon}><Icon name={a.icon} size={22} color={colors.primary} /></View>
                <Text style={styles.quickLabel}>{a.label}</Text>
              </PressScale>
            </Enter>
          ))}
        </View>
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glow: { top: -90, right: -70 },
  stats: { marginTop: spacing.lg },

  revenueTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  revenueValue: { color: colors.text, ...typography.title, ...typography.number },
  revenueLabel: { color: colors.textMuted, ...typography.caption },
  revenueHint: { color: colors.textMuted, ...typography.caption, marginTop: spacing.sm },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCell: { width: '31%' },
  quickCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.surfaceRaised, ...shadow.card,
  },
  quickIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: colors.textSecondary, ...typography.caption, fontWeight: '600', textAlign: 'center' },
});
