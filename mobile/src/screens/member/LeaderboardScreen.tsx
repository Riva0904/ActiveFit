import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, EmptyState, Header, Icon, Loading, Screen } from '../../components';
import { colors, spacing, tint, typography } from '../../theme';

const MEDAL_COLORS = [colors.gold, colors.silver, colors.bronze];

export default function LeaderboardScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/attendance/leaderboard') as any,
  });

  const items: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <Screen>
      <Header title="Leaderboard" subtitle="Top members this month by visits" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const medal = MEDAL_COLORS[index];
            return (
              <Card padding="md" style={styles.row} accent={index === 0 ? 'primary' : undefined}>
                <View style={[styles.rank, medal ? { backgroundColor: tint(medal, '28') } : null]}>
                  {medal ? <Icon name="medal-outline" size={20} color={medal} /> : <Text style={styles.rankText}>#{item.rank ?? index + 1}</Text>}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.memberName ?? `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim()}
                </Text>
                <View style={styles.visitsWrap}>
                  <Text style={styles.visitsNum}>{item.visits ?? item.visitCount ?? 0}</Text>
                  <Text style={styles.visitsSub}>visits</Text>
                </View>
              </Card>
            );
          }}
          ListEmptyComponent={<EmptyState icon="award" title="No data yet this month" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  rank: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
  rankText: { color: colors.textSecondary, ...typography.caption, fontWeight: '700', ...typography.number },
  name: { flex: 1, color: colors.text, ...typography.body, fontWeight: '600' },
  visitsWrap: { alignItems: 'center' },
  visitsNum: { color: colors.primary, fontSize: 22, fontWeight: '800', ...typography.number },
  visitsSub: { color: colors.textMuted, ...typography.micro },
});
