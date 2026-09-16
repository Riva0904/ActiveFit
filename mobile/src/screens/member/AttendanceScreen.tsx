import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { can } from '../../lib/roles';
import { Card, Enter, GlowOrb, Header, HeroStat, Icon, Loading, Screen, SectionTitle, type IconName } from '../../components';
import { WeeklyBarChart } from '../../components/widgets';
import { useWeeklyActivity } from '../../hooks/useWeeklyActivity';
import { colors, spacing, tint, typography } from '../../theme';

const ACTIONS: { label: string; icon: IconName; screen: string }[] = [
  { label: 'History & Calendar', icon: 'calendar', screen: 'AttendanceHistory' },
  { label: 'My Insights', icon: 'bar-chart-2', screen: 'Insights' },
  { label: 'Leaderboard', icon: 'award', screen: 'Leaderboard' },
];

export default function AttendanceScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const isMember = can(user, 'hasMemberRecord');

  const { data: homeData, isLoading } = useQuery({
    queryKey: ['mobile-home'],
    queryFn: () => api.get('/mobile/home') as any,
    enabled: !!user,
  });

  const { data: streak } = useQuery({
    queryKey: ['attendance-streak'],
    queryFn: () => api.get('/attendance/streak') as any,
    enabled: isMember,
  });

  const week = useWeeklyActivity(isMember);

  if (isLoading) return <Loading fullScreen />;

  const qrToken: string = homeData?.qrToken ?? '';

  return (
    <Screen scroll>
      <Header title="My QR Code" subtitle="Show this to the gym scanner or staff" />

      <Card style={styles.qrCard} glow={!!qrToken} enter={0}>
        {qrToken ? (
          <View style={styles.qrWrap}>
            <GlowOrb size={300} intensity={0.35} breathe style={styles.qrGlow} />
            <QRCode value={qrToken} size={200} backgroundColor={colors.surface} color={colors.text} />
          </View>
        ) : (
          <View style={styles.noQr}>
            <Icon name="qrcode" size={32} color={colors.textFaint} />
            <Text style={styles.noQrText}>{isMember ? 'No QR token available' : 'Check in from the Home tab'}</Text>
          </View>
        )}
        {homeData?.memberCode ? <Text style={styles.memberCode}>{homeData.memberCode}</Text> : null}
      </Card>

      {isMember && (
        <Enter index={1}>
          <SectionTitle title="This week" action={{ label: `${week.visits} visit${week.visits === 1 ? '' : 's'}`, onPress: () => navigation.navigate('AttendanceHistory') }} />
          <Card>
            {week.isLoading ? (
              <Loading />
            ) : (
              <WeeklyBarChart values={week.values} presence={week.presence} highlightIndex={week.highlightIndex} highlightLabel={week.highlightLabel} />
            )}
            <Text style={styles.weekSummary}>
              {week.totalMinutes > 0 ? `${week.totalMinutes} min in the gym this week` : 'No completed sessions yet this week'}
            </Text>
          </Card>
        </Enter>
      )}

      {isMember && (
        <Enter index={2} style={styles.streakRow}>
          <Card style={styles.streakCard} glow={((streak as any)?.currentStreak ?? 0) > 0}>
            <HeroStat value={(streak as any)?.currentStreak ?? 0} label="Current streak" />
            <Icon name="fire" size={18} color={colors.primary} style={styles.streakIcon} />
          </Card>
          <Card style={styles.streakCard}>
            <HeroStat value={(streak as any)?.bestStreak ?? 0} label="Best streak" color={colors.text} />
            <Icon name="trophy-outline" size={18} color={colors.warning} style={styles.streakIcon} />
          </Card>
        </Enter>
      )}

      {isMember && (
        <View style={styles.actionsGrid}>
          {ACTIONS.map((a, i) => (
            <Card key={a.screen} style={styles.actionCard} enter={3 + i} onPress={() => navigation.navigate(a.screen)}>
              <View style={styles.actionIcon}><Icon name={a.icon} size={22} color={colors.primary} /></View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrCard: { alignItems: 'center', paddingVertical: spacing.xxl + spacing.sm, marginBottom: spacing.xxl },
  qrWrap: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12 },
  qrGlow: { top: -38, left: -38 },
  noQr: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  noQrText: { color: colors.textMuted, ...typography.label },
  memberCode: { color: colors.primary, fontWeight: '700', fontSize: 18, marginTop: spacing.lg, letterSpacing: 4, ...typography.number },
  weekSummary: { color: colors.textMuted, ...typography.caption, textAlign: 'center', marginTop: spacing.sm },

  streakRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  streakCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.xl },
  streakIcon: { position: 'absolute', top: 12, right: 12 },

  actionsGrid: { flexDirection: 'row', gap: spacing.md },
  actionCard: { flex: 1, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.lg },
  actionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.textSecondary, ...typography.micro, fontWeight: '600', textAlign: 'center' },
});
