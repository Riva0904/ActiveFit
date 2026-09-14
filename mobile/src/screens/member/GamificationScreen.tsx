import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, EmptyState, Header, HeroStat, Icon, Loading, Screen, SectionTitle, type IconName } from '../../components';
import { colors, spacing, tint, typography } from '../../theme';

const BADGE_ICONS: Record<string, IconName> = {
  STREAK_7: 'fire', STREAK_30: 'fire', STREAK_100: 'fire',
  FIRST_CHECKIN: 'check', CHECKINS_50: 'medal-outline', CHECKINS_100: 'trophy-outline',
  WEIGHT_LOSS: 'zap', MUSCLE_GAIN: 'dumbbell',
};

export default function GamificationScreen({ navigation }: any) {
  const { data: pts, isLoading: ptsLoading } = useQuery({
    queryKey: ['my-points'],
    queryFn: () => api.get('/gamification/my/points') as any,
  });
  const { data: badges, isLoading: badgesLoading } = useQuery({
    queryKey: ['my-badges'],
    queryFn: () => api.get('/gamification/my/badges') as any,
  });

  const allBadges: any[] = Array.isArray(badges) ? badges : (badges as any)?.badges ?? [];
  const badgeList = allBadges.filter((b: any) => b.earnedAt != null || b.isEarned === true);
  const points: number = (pts as any)?.points ?? (pts as any)?.totalPoints ?? 0;
  const rank: string = (pts as any)?.rank ?? '';

  return (
    <Screen scroll>
      <Header title="Achievements" onBack={() => navigation.goBack()} />

      {ptsLoading ? (
        <Loading />
      ) : (
        <Card accent="primary" style={styles.pointsCard}>
          <HeroStat value={points} label="Total points" />
          {rank ? <Text style={styles.rank}>Rank {rank}</Text> : null}
        </Card>
      )}

      <SectionTitle title="Badges earned" />
      {badgesLoading ? (
        <Loading />
      ) : badgeList.length === 0 ? (
        <EmptyState icon="award" title="No badges yet" subtitle="Complete goals to earn badges" />
      ) : (
        <View style={styles.grid}>
          {badgeList.map((b: any, i: number) => (
            <Card key={i} style={styles.badge}>
              <View style={styles.badgeIcon}><Icon name={BADGE_ICONS[b.type] ?? 'award'} size={24} color={colors.warning} /></View>
              <Text style={styles.badgeName} numberOfLines={2}>{b.name ?? String(b.type ?? '').replace(/_/g, ' ')}</Text>
              <Text style={styles.badgeDate}>{b.earnedAt ? new Date(b.earnedAt).toLocaleDateString('en-IN') : ''}</Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pointsCard: { alignItems: 'center', paddingVertical: spacing.xxl + spacing.sm },
  rank: { color: colors.warning, ...typography.label, fontWeight: '600', marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  badge: { width: '47.5%', alignItems: 'center', marginBottom: 0 },
  badgeIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: tint(colors.warning), alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  badgeName: { color: colors.text, ...typography.caption, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  badgeDate: { color: colors.textFaint, fontSize: 10, textAlign: 'center' },
});
