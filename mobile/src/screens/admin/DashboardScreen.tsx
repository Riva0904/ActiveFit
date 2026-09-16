import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Avatar, Card, EmptyState, Enter, GlowOrb, GymBadge, Icon, Loading, PressScale, Screen, SectionTitle, StatRow, type IconName,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface GymStats {
  totalMembers: number;
  activeMembers: number;
  todayAttendance: number;
  monthlyRevenue: number;
  pendingPayments: number;
  /** Walk-ins the front desk logged and nobody has closed out yet. */
  openEnquiries?: number;
  newEnquiriesToday?: number;
}

interface Subscription {
  plan: string;
  status: string;
  isActive: boolean;
  inGrace: boolean;
  daysLeft?: number | null;
  limits: { maxMembers: number; maxTrainers: number; maxStaff: number };
  usage: { members: number; trainers: number; staff: number };
}

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function AdminDashboardScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const scope = useGymScope();
  const gymId = scope.gymId;

  const stats = useQuery<GymStats>({
    queryKey: scope.key(['gym-stats']),
    queryFn: () => api.get(`/gyms/${gymId}/stats`) as any,
    enabled: !!gymId,
  });

  const subscription = useQuery<Subscription>({
    queryKey: scope.key(['gym-subscription-me']),
    queryFn: () => api.get('/gym-subscriptions/me', { params: scope.params() }) as any,
    enabled: !!gymId,
    staleTime: 5 * 60_000,
  });

  const pendingUpi = useQuery<any[]>({
    queryKey: scope.key(['pending-upi']),
    queryFn: () => api.get('/payments/manual-upi/pending', { params: scope.params() }) as any,
    enabled: !!gymId,
    staleTime: 60_000,
  });

  const refreshing = stats.isRefetching || subscription.isRefetching;
  const refetchAll = () => { stats.refetch(); subscription.refetch(); pendingUpi.refetch(); };

  // A disabled react-query is not "loading", so without this the screen used to
  // render permanent zeros for anyone without a gym instead of saying why.
  if (!gymId) {
    return (
      <Screen>
        <EmptyState icon="bank-outline" title="No gym selected" subtitle="Choose a gym to see its dashboard." />
      </Screen>
    );
  }

  if (stats.isLoading) return <Loading fullScreen text={'Loading your gym…'} />;

  const s = stats.data;
  const sub = subscription.data;
  const pendingCount = Array.isArray(pendingUpi.data) ? pendingUpi.data.length : 0;

  const actions: { label: string; icon: IconName; tab: string; screen?: string; badge?: number }[] = [
    { label: 'Members', icon: 'users', tab: 'People', screen: 'PeopleMain' },
    { label: 'Check-in', icon: 'qrcode', tab: 'Attendance', screen: 'AttendanceMain' },
    { label: 'Payments', icon: 'credit-card', tab: 'Money', screen: 'Payments', badge: pendingCount },
    { label: 'Expenses', icon: 'receipt', tab: 'Money', screen: 'Expenses' },
    { label: 'Payroll', icon: 'cash-multiple', tab: 'Money', screen: 'Payroll' },
    { label: 'Plans', icon: 'clipboard-text-outline', tab: 'Plans', screen: 'PlansMain' },
    { label: 'Enquiries', icon: 'inbox', tab: 'Home', screen: 'Enquiries', badge: s?.openEnquiries ?? 0 },
  ];

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={colors.primary} />}>
      {/* Header */}
      <View style={styles.header}>
        <GlowOrb size={320} intensity={0.45} breathe style={styles.headerGlow} />
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name} numberOfLines={1}>{user?.firstName} {user?.lastName}</Text>
            <GymBadge style={styles.gymBadge} />
          </View>
          <PressScale onPress={() => navigation.navigate('Profile')} scaleTo={0.92}>
            <Avatar uri={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} ring />
          </PressScale>
        </View>

        <Card style={styles.statCard} padding="md" enter={0}>
          <StatRow items={[
            { label: 'Members', value: s?.totalMembers ?? 0 },
            { label: 'Active', value: s?.activeMembers ?? 0, color: colors.success },
            { label: 'In today', value: s?.todayAttendance ?? 0, color: colors.primary },
          ]} />
        </Card>
      </View>

      {/* Revenue */}
      <Enter index={1}>
        <View style={styles.moneyRow}>
          <Card style={styles.moneyCard} glow>
            <Icon name="trending-up" size={18} color={colors.success} />
            <Text style={styles.moneyValue}>{money(s?.monthlyRevenue ?? 0)}</Text>
            <Text style={styles.moneyLabel}>Revenue this month</Text>
          </Card>
          <Card style={styles.moneyCard} accent={(s?.pendingPayments ?? 0) > 0 ? 'warning' : undefined}>
            <Icon name="clock" size={18} color={colors.warning} />
            <Text style={styles.moneyValue}>{s?.pendingPayments ?? 0}</Text>
            <Text style={styles.moneyLabel}>Pending payments</Text>
          </Card>
        </View>
      </Enter>

      {/* Enquiries — front desk work lands here, so a walk-in staff logged is
          visible on the admin's own home screen rather than only in their tab. */}
      <Enter index={2}>
        <Card
          accent={(s?.openEnquiries ?? 0) > 0 ? 'warning' : undefined}
          onPress={() => navigation.navigate('Enquiries')}
        >
          <View style={styles.enquiryRow}>
            <View style={styles.enquiryIcon}>
              <Icon name="inbox" size={18} color={colors.cyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.enquiryValue}>
                {s?.openEnquiries ?? 0} open {(s?.openEnquiries ?? 0) === 1 ? 'enquiry' : 'enquiries'}
              </Text>
              <Text style={styles.enquiryLabel}>
                {(s?.newEnquiriesToday ?? 0) > 0
                  ? `${s?.newEnquiriesToday} added today by you or the front desk`
                  : 'Walk-ins and calls your team logged'}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.textMuted} />
          </View>
        </Card>
      </Enter>

      {/* Subscription */}
      {sub && (
        <Enter index={2}>
          <SectionTitle title="Your plan" action={{ label: 'Manage', onPress: () => navigation.navigate('Money', { screen: 'Subscription' }) }} />
          <Card
            accent={sub.isActive ? undefined : 'danger'}
            glow={sub.isActive && sub.plan !== 'STARTER'}
            onPress={() => navigation.navigate('Money', { screen: 'Subscription' })}
          >
            <View style={styles.planTop}>
              <View>
                <Text style={styles.planName}>{sub.plan}</Text>
                <Text style={styles.planSub}>
                  {sub.inGrace ? 'In grace period' : sub.isActive ? 'Active' : 'Expired'}
                  {typeof sub.daysLeft === 'number' && sub.daysLeft > 0 ? ` · ${sub.daysLeft} days left` : ''}
                </Text>
              </View>
              <Icon name="crown-outline" size={22} color={sub.isActive ? colors.gold : colors.danger} />
            </View>
            <View style={styles.usageRow}>
              <Usage label="Members" used={sub.usage.members} max={sub.limits.maxMembers} />
              <Usage label="Trainers" used={sub.usage.trainers} max={sub.limits.maxTrainers} />
              <Usage label="Staff" used={sub.usage.staff} max={sub.limits.maxStaff} />
            </View>
          </Card>
        </Enter>
      )}

      {/* Quick actions */}
      <Enter index={3}>
        <SectionTitle title="Manage" />
        <View style={styles.grid}>
          {actions.map((a, i) => (
            <Enter key={a.label} index={3 + i} style={styles.cell}>
              <PressScale
                style={styles.tile}
                scaleTo={0.93}
                onPress={() => (a.screen ? navigation.navigate(a.tab, { screen: a.screen }) : navigation.navigate(a.tab))}
              >
                <View style={styles.tileIcon}>
                  <Icon name={a.icon} size={22} color={colors.primary} />
                </View>
                {a.badge ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{a.badge > 9 ? '9+' : a.badge}</Text></View>
                ) : null}
                <Text style={styles.tileLabel}>{a.label}</Text>
              </PressScale>
            </Enter>
          ))}
        </View>
      </Enter>
    </Screen>
  );
}

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(1, used / max) : 0;
  const tight = pct >= 0.85;
  return (
    <View style={styles.usage}>
      <Text style={styles.usageLabel}>{label}</Text>
      <Text style={styles.usageValue}>{used}<Text style={styles.usageMax}>/{max}</Text></Text>
      <View style={styles.usageTrack}>
        <View style={[styles.usageFill, { width: `${pct * 100}%`, backgroundColor: tight ? colors.danger : colors.success }]} />
      </View>
    </View>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const styles = StyleSheet.create({
  header: { paddingBottom: spacing.xl, marginHorizontal: -spacing.screen, paddingHorizontal: spacing.screen, overflow: 'hidden' },
  headerGlow: { top: -150, right: -110 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  greeting: { color: colors.textMuted, ...typography.label },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  gymBadge: { marginTop: 6 },
  enquiryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  enquiryIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: tint(colors.cyan, '1F'),
    alignItems: 'center', justifyContent: 'center',
  },
  enquiryValue: { color: colors.text, ...typography.h2 },
  enquiryLabel: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  statCard: { marginBottom: 0 },

  moneyRow: { flexDirection: 'row', gap: spacing.md },
  moneyCard: { flex: 1, gap: spacing.xs },
  moneyValue: { color: colors.text, fontSize: 22, fontWeight: '800', ...typography.number },
  moneyLabel: { color: colors.textMuted, ...typography.micro },

  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  planName: { color: colors.text, ...typography.title },
  planSub: { color: colors.textSecondary, ...typography.caption, marginTop: 2 },
  usageRow: { flexDirection: 'row', gap: spacing.md },
  usage: { flex: 1 },
  usageLabel: { color: colors.textMuted, ...typography.micro, textTransform: 'uppercase', letterSpacing: 0.5 },
  usageValue: { color: colors.text, ...typography.h2, ...typography.number, marginTop: 2 },
  usageMax: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  usageTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  usageFill: { height: 4, borderRadius: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '31%' },
  tile: {
    backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.lg,
    alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  tileIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  tileLabel: { color: colors.textSecondary, ...typography.caption, fontWeight: '600', textAlign: 'center' },
  badge: {
    position: 'absolute', top: 10, right: 14, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
