import React from 'react';
import { Alert, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { MobileHomeData } from '../../types';
import { usePushToken } from '../../hooks/usePushToken';
import { Avatar, Card, Icon, Loading, Screen, SectionTitle, StatPill, type IconName } from '../../components';
import { colors, radius, shadow, spacing, tint, typography } from '../../theme';

export default function HomeScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  usePushToken();

  const { data, isLoading, refetch, isRefetching } = useQuery<MobileHomeData>({
    queryKey: ['mobile-home'],
    queryFn: () => api.get('/mobile/home') as any,
    enabled: !!user,
  });

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/mobile/checkin', {}) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
    onError: (err: any) => Alert.alert('Check-in failed', err?.message ?? 'Try again'),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-out') as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-home'] }),
    onError: (err: any) => Alert.alert('Check-out failed', err?.message ?? 'Try again'),
  });

  if (isLoading) return <Loading fullScreen text={'Connecting…\nFirst load may take 60s'} />;

  const isCheckedIn = data?.isCheckedInToday ?? false;
  const end = data?.membership ? new Date(data.membership.endDate) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)) : null;
  const busy = checkInMutation.isPending || checkOutMutation.isPending;

  // This screen also serves STAFF / GYM_ADMIN / SUPER_ADMIN (they use the app for
  // chat + notifications). Membership, plans and the store need a Member row, and
  // self check-in is allowed only for MEMBER/TRAINER/STAFF on the backend.
  const role = user?.role ?? 'MEMBER';
  const isMember = role === 'MEMBER';
  const canCheckIn = isMember || role === 'STAFF';

  const quickActions: { label: string; icon: IconName; tab: string }[] = isMember
    ? [
        { label: 'QR Code', icon: 'qrcode', tab: 'Attendance' },
        { label: 'Workout', icon: 'dumbbell', tab: 'Plans' },
        { label: 'Diet', icon: 'food-apple-outline', tab: 'Plans' },
        { label: 'Progress', icon: 'trending-up', tab: 'Plans' },
        { label: 'Store', icon: 'shopping-cart', tab: 'Store' },
        { label: 'Profile', icon: 'user', tab: 'Profile' },
      ]
    : [
        ...(canCheckIn ? [{ label: 'Attendance', icon: 'calendar' as IconName, tab: 'Attendance' }] : []),
        { label: 'Profile', icon: 'user', tab: 'Profile' },
      ];

  const expiring = daysLeft !== null && daysLeft < 7;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerGlow} pointerEvents="none" />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good {getGreeting()} 👋</Text>
            <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Avatar uri={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} ring />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <StatPill label="Status" value={isCheckedIn ? 'Active' : 'Not In'} color={isCheckedIn ? colors.success : colors.textMuted} />
          {data?.activeWorkout && <StatPill label="Workout" value={data.activeWorkout.name} color={colors.purple} />}
          {data?.activeDiet && <StatPill label="Diet" value={data.activeDiet.name} color={colors.success} />}
        </View>
      </View>

      {/* ── Check-in ── */}
      {canCheckIn && (
        <TouchableOpacity
          style={[styles.checkBtn, isCheckedIn ? styles.checkBtnOut : shadow.glow]}
          onPress={() => (isCheckedIn ? checkOutMutation.mutate() : checkInMutation.mutate())}
          disabled={busy}
          activeOpacity={0.9}
        >
          {busy ? (
            <Loading />
          ) : (
            <View style={styles.checkBtnInner}>
              <View style={[styles.checkIcon, isCheckedIn && { backgroundColor: tint(colors.white, '18') }]}>
                <Icon name={isCheckedIn ? 'log-out' : 'check'} size={26} color={colors.white} />
              </View>
              <View>
                <Text style={styles.checkBtnLabel}>{isCheckedIn ? 'Check Out' : 'Check In'}</Text>
                {data?.checkedInAt && isCheckedIn ? (
                  <Text style={styles.checkBtnSub}>
                    Since {new Date(data.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                ) : (
                  <Text style={styles.checkBtnSub}>{isCheckedIn ? '' : 'Tap when you arrive'}</Text>
                )}
              </View>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* ── Membership ── */}
      {!isMember ? (
        <Card accent="muted">
          <Text style={styles.planName}>{role.replace(/_/g, ' ')} account</Text>
          <Text style={styles.expiry}>Chat and notifications are under Profile</Text>
        </Card>
      ) : data?.membership ? (
        <Card accent={expiring ? 'danger' : 'primary'}>
          <View style={styles.memberCardTop}>
            <View>
              <Text style={styles.planName}>{data.membership.plan.name}</Text>
              <Text style={styles.planType}>{data.membership.plan.type}</Text>
            </View>
            <View style={[styles.daysBadge, { backgroundColor: expiring ? colors.danger : colors.success }]}>
              <Text style={styles.daysBadgeText}>{daysLeft}d</Text>
            </View>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, {
              width: `${Math.min(100, Math.max(0, ((daysLeft ?? 0) / (data.membership.plan.durationMonths * 30)) * 100))}%`,
              backgroundColor: expiring ? colors.danger : colors.primary,
            }]} />
          </View>
          <Text style={styles.expiry}>
            Expires {end?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </Card>
      ) : (
        <Card accent="muted" onPress={() => navigation.navigate('Profile', { screen: 'MembershipRenewal' })}>
          <Text style={styles.planName}>No Active Membership</Text>
          <Text style={styles.expiry}>Tap to choose a plan</Text>
        </Card>
      )}

      {/* ── Quick Actions ── */}
      <SectionTitle title="Quick Actions" />
      <View style={styles.quickGrid}>
        {quickActions.map((a) => (
          <TouchableOpacity key={a.label} style={styles.quickCard} onPress={() => navigation.navigate(a.tab)} activeOpacity={0.7}>
            <View style={styles.quickIcon}><Icon name={a.icon} size={22} color={colors.primary} /></View>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Screen>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  header: { paddingBottom: spacing.xl, marginHorizontal: -spacing.screen, paddingHorizontal: spacing.screen, overflow: 'hidden' },
  headerGlow: {
    position: 'absolute', top: -80, right: -40, width: 220, height: 220,
    borderRadius: 110, backgroundColor: colors.primary, opacity: 0.07,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { color: colors.textMuted, ...typography.label },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },

  checkBtn: {
    marginBottom: spacing.lg, backgroundColor: colors.primary,
    borderRadius: radius.xl, paddingVertical: spacing.xl, paddingHorizontal: spacing.xxl,
  },
  checkBtnOut: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  checkBtnInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  checkIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: tint(colors.white, '30'), alignItems: 'center', justifyContent: 'center' },
  checkBtnLabel: { color: colors.white, fontSize: 20, fontWeight: '800' },
  checkBtnSub: { color: 'rgba(255,255,255,0.65)', ...typography.caption, marginTop: 2 },

  memberCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  planName: { color: colors.text, ...typography.h2 },
  planType: { color: colors.textSecondary, ...typography.caption, marginTop: 3 },
  daysBadge: { borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 },
  daysBadgeText: { color: colors.white, ...typography.label, ...typography.number },
  bar: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  expiry: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xs },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '31%', backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: colors.surfaceRaised, ...shadow.card,
  },
  quickIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: colors.textSecondary, ...typography.caption, fontWeight: '600', textAlign: 'center' },
});
