import React from 'react';
import { Alert, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { MobileHomeData } from '../../types';
import { usePushToken } from '../../hooks/usePushToken';
import { AnimatedBar, Avatar, Card, Enter, GlowOrb, Icon, Loading, PressScale, PulseRing, Screen, SectionTitle, StatPill, StatRow, type IconName } from '../../components';
import { ActivityChecklist, RunSummaryCard, type ChecklistItem } from '../../components/widgets';
import type { ActivityRun } from '../../types';
import { useDailyChecklistStore } from '../../store/dailyChecklistStore';
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

  // This screen also serves STAFF / GYM_ADMIN / SUPER_ADMIN (they use the app for
  // chat + notifications). Membership, plans and the store need a Member row, and
  // self check-in is allowed only for MEMBER/TRAINER/STAFF on the backend.
  const role = user?.role ?? 'MEMBER';
  const isMember = role === 'MEMBER';
  const canCheckIn = isMember || role === 'STAFF';

  // Member-only stats for the StatRow (all three endpoints are @Roles(MEMBER)).
  const now = new Date();
  const { data: calendar } = useQuery({
    queryKey: ['attendance-calendar', now.getMonth(), now.getFullYear()],
    queryFn: () => api.get('/attendance/calendar', { params: { month: now.getMonth() + 1, year: now.getFullYear() } }) as any,
    enabled: isMember, staleTime: 5 * 60_000,
  });
  const { data: streak } = useQuery({
    queryKey: ['attendance-streak'],
    queryFn: () => api.get('/attendance/streak') as any,
    enabled: isMember, staleTime: 5 * 60_000,
  });
  const { data: insights } = useQuery({
    queryKey: ['my-insights'],
    queryFn: () => api.get('/attendance/my-insights') as any,
    enabled: isMember, staleTime: 5 * 60_000,
  });

  const { data: latestRun } = useQuery<ActivityRun | null>({
    queryKey: ['runs', 'latest'],
    queryFn: () => api.get('/activities/runs/latest') as any,
    enabled: isMember, staleTime: 60_000,
  });
  const ranToday = !!latestRun && new Date(latestRun.startedAt).toDateString() === new Date().toDateString();

  const checklistDone = useDailyChecklistStore((s) => s.isDone);
  const checklistToggle = useDailyChecklistStore((s) => s.toggle);

  if (isLoading) return <Loading fullScreen text={'Connecting…\nFirst load may take 60s'} />;

  const isCheckedIn = data?.isCheckedInToday ?? false;
  const end = data?.membership ? new Date(data.membership.endDate) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)) : null;
  const busy = checkInMutation.isPending || checkOutMutation.isPending;

  const monthVisits = ((calendar as any)?.presentDates ?? []).length;
  const currentStreak = (streak as any)?.currentStreak ?? 0;
  const avgMin = (insights as any)?.avgDuration ? Math.round((insights as any).avgDuration) : null;

  const checklist: ChecklistItem[] = isMember
    ? [
        {
          key: 'checkin', icon: 'map-pin', label: 'Check in at the gym',
          subtitle: isCheckedIn && data?.checkedInAt ? `Since ${new Date(data.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Tap when you arrive',
          done: isCheckedIn, busy,
          onPress: () => (isCheckedIn ? checkOutMutation.mutate() : checkInMutation.mutate()),
        },
        ...(data?.activeWorkout ? [{
          key: 'workout', icon: 'dumbbell' as IconName, label: data.activeWorkout.name, subtitle: 'Workout plan',
          done: checklistDone('workout'), onPress: () => checklistToggle('workout'), color: colors.purple,
        }] : []),
        ...(data?.activeDiet ? [{
          key: 'diet', icon: 'food-apple-outline' as IconName, label: data.activeDiet.name, subtitle: 'Diet plan',
          done: checklistDone('diet'), onPress: () => checklistToggle('diet'), color: colors.success,
        }] : []),
        {
          key: 'run', icon: 'run' as IconName, label: 'Go for a run',
          subtitle: ranToday && latestRun ? `${(latestRun.distanceMeters / 1000).toFixed(2)} km today` : 'GPS-tracked',
          done: ranToday, onPress: ranToday ? undefined : () => navigation.navigate('Run'), color: colors.info,
        },
      ]
    : [];

  // Each action targets a tab and optionally a screen inside that tab's stack.
  const quickActions: { label: string; icon: IconName; tab: string; screen?: string }[] = isMember
    ? [
        { label: 'QR Code', icon: 'qrcode', tab: 'Attendance', screen: 'AttendanceMain' },
        { label: 'Workout', icon: 'dumbbell', tab: 'Plans', screen: 'PlansMain' },
        { label: 'Run', icon: 'run', tab: 'Home', screen: 'Run' },
        { label: 'Progress', icon: 'trending-up', tab: 'Profile', screen: 'ProgressLog' },
        { label: 'Store', icon: 'shopping-cart', tab: 'Store', screen: 'StoreMain' },
        { label: 'Trainer', icon: 'account-heart-outline', tab: 'Profile', screen: 'MyTrainer' },
      ]
    : [
        ...(canCheckIn ? [{ label: 'Attendance', icon: 'calendar' as IconName, tab: 'Attendance' }] : []),
        { label: 'Profile', icon: 'user', tab: 'Profile' },
      ];
  const go = (a: { tab: string; screen?: string }) =>
    a.screen ? navigation.navigate(a.tab, { screen: a.screen }) : navigation.navigate(a.tab);

  const expiring = daysLeft !== null && daysLeft < 7;

  return (
    <Screen scroll refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <GlowOrb size={320} intensity={0.45} breathe style={styles.headerGlow} />
        <GlowOrb size={200} intensity={0.25} color={colors.purple} style={styles.headerGlow2} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good {getGreeting()} 👋</Text>
            <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Avatar uri={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} ring />
          </TouchableOpacity>
        </View>
        {isMember ? (
          <Card style={styles.statCard} padding="md" enter={0}>
            <StatRow items={[
              { label: 'Visits · month', value: monthVisits },
              { label: 'Streak', value: currentStreak, unit: currentStreak === 1 ? 'day' : 'days', color: currentStreak > 0 ? colors.primary : undefined },
              { label: 'Avg session', value: avgMin ?? '—', unit: avgMin ? 'min' : undefined },
            ]} />
          </Card>
        ) : (
          <View style={styles.statsRow}>
            <StatPill label="Status" value={isCheckedIn ? 'Active' : 'Not In'} color={isCheckedIn ? colors.success : colors.textMuted} />
          </View>
        )}
      </View>

      {/* ── Check-in ── */}
      {canCheckIn && (
        <Enter index={1}>
        <PressScale
          style={[styles.checkBtn, isCheckedIn ? styles.checkBtnOut : shadow.glow]}
          onPress={() => (isCheckedIn ? checkOutMutation.mutate() : checkInMutation.mutate())}
          disabled={busy}
          scaleTo={0.97}
        >
          {!isCheckedIn && !busy ? <PulseRing borderRadius={radius.xl} /> : null}
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
        </PressScale>
        </Enter>
      )}

      {/* ── Membership ── */}
      {!isMember ? (
        <Card accent="muted" enter={2}>
          <Text style={styles.planName}>{role.replace(/_/g, ' ')} account</Text>
          <Text style={styles.expiry}>Chat and notifications are under Profile</Text>
        </Card>
      ) : data?.membership ? (
        <Card accent={expiring ? 'danger' : 'primary'} glow={!expiring} enter={2}>
          <GlowOrb size={180} intensity={0.3} color={expiring ? colors.danger : colors.primary} style={styles.cardGlow} />
          <View style={styles.memberCardTop}>
            <View>
              <Text style={styles.planName}>{data.membership.plan.name}</Text>
              <Text style={styles.planType}>{data.membership.plan.type}</Text>
            </View>
            <View style={[styles.daysBadge, { backgroundColor: expiring ? colors.danger : colors.success }]}>
              <Text style={styles.daysBadgeText}>{daysLeft}d</Text>
            </View>
          </View>
          <AnimatedBar
            progress={(daysLeft ?? 0) / Math.max(1, data.membership.plan.durationMonths * 30)}
            color={expiring ? colors.danger : colors.primary}
            style={styles.bar}
          />
          <Text style={styles.expiry}>
            Expires {end?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </Card>
      ) : (
        <Card accent="muted" enter={2} onPress={() => navigation.navigate('Profile', { screen: 'MembershipRenewal' })}>
          <Text style={styles.planName}>No Active Membership</Text>
          <Text style={styles.expiry}>Tap to choose a plan</Text>
        </Card>
      )}

      {/* ── Today's checklist ── */}
      {checklist.length > 0 && (
        <Enter index={3}>
          <SectionTitle title="Today" action={{ label: `${checklist.filter((c) => c.done).length}/${checklist.length} done`, onPress: () => {} }} />
          <ActivityChecklist items={checklist} />
        </Enter>
      )}

      {/* ── Last run ── */}
      {isMember && (
        <Enter index={4}>
          <SectionTitle title="Activity" />
          <RunSummaryCard
            run={latestRun}
            onStart={() => navigation.navigate('Run')}
            onPress={latestRun ? () => navigation.navigate('RunDetail', { id: latestRun.id }) : undefined}
          />
        </Enter>
      )}

      {/* ── Quick Actions ── */}
      <Enter index={5}>
        <SectionTitle title="Quick Actions" />
        <View style={styles.quickGrid}>
          {quickActions.map((a, i) => (
            <Enter key={a.label} index={5 + i} style={styles.quickCell}>
              <PressScale style={styles.quickCard} onPress={() => go(a)} scaleTo={0.93}>
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  header: { paddingBottom: spacing.xl, marginHorizontal: -spacing.screen, paddingHorizontal: spacing.screen, overflow: 'hidden' },
  headerGlow: { top: -150, right: -110 },
  headerGlow2: { top: 30, left: -120 },
  cardGlow: { top: -90, right: -70 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { color: colors.textMuted, ...typography.label },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  statCard: { marginBottom: 0 },

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
  bar: { marginBottom: 10 },
  expiry: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xs },

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
