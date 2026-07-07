import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const BADGE_ICONS: Record<string, string> = {
  STREAK_7: '🔥', STREAK_30: '🔥', STREAK_100: '🔥',
  FIRST_CHECKIN: '✅', CHECKINS_50: '🏅', CHECKINS_100: '🏆',
  WEIGHT_LOSS: '⚡', MUSCLE_GAIN: '💪',
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

  const badgeList: any[] = Array.isArray(badges) ? badges : (badges as any)?.badges ?? [];
  const points: number = (pts as any)?.points ?? (pts as any)?.totalPoints ?? 0;
  const rank: string = (pts as any)?.rank ?? '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Achievements</Text>
      </View>

      {ptsLoading ? <ActivityIndicator color="#FF4D00" /> : (
        <View style={styles.pointsCard}>
          <Text style={styles.pointsNum}>{points}</Text>
          <Text style={styles.pointsLabel}>Total Points</Text>
          {rank ? <Text style={styles.rank}>Rank: {rank}</Text> : null}
        </View>
      )}

      <Text style={styles.sectionTitle}>🏅 Badges Earned</Text>
      {badgesLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 20 }} /> : (
        badgeList.length === 0 ? (
          <Text style={styles.empty}>Complete goals to earn badges!</Text>
        ) : (
          <View style={styles.badgeGrid}>
            {badgeList.map((b: any, i: number) => (
              <View key={i} style={styles.badge}>
                <Text style={styles.badgeIcon}>{BADGE_ICONS[b.type] ?? '🏅'}</Text>
                <Text style={styles.badgeName}>{b.name ?? b.type?.replace(/_/g, ' ')}</Text>
                <Text style={styles.badgeDate}>
                  {b.earnedAt ? new Date(b.earnedAt).toLocaleDateString('en-IN') : ''}
                </Text>
              </View>
            ))}
          </View>
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  pointsCard: {
    margin: 20, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: '#FF4D00',
  },
  pointsNum: { color: '#FF4D00', fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pointsLabel: { color: '#9CA3AF', fontSize: 14, marginTop: 4 },
  rank: { color: '#F59E0B', fontSize: 13, marginTop: 8, fontWeight: '600' },
  sectionTitle: { color: '#E5E7EB', fontSize: 15, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
  badge: {
    width: '47%', backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  badgeIcon: { fontSize: 36, marginBottom: 8 },
  badgeName: { color: '#F9FAFB', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  badgeDate: { color: '#4B5563', fontSize: 10, textAlign: 'center' },
  empty: { color: '#4B5563', fontSize: 13, paddingHorizontal: 20, textAlign: 'center', marginTop: 12 },
});
