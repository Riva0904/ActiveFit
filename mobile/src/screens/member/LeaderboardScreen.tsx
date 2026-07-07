import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/attendance/leaderboard') as any,
  });

  const items: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Leaderboard 🏆</Text>
        <Text style={styles.sub}>Top members this month by visits</Text>
      </View>

      {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item, index }) => (
            <View style={[styles.card, index === 0 && styles.cardFirst]}>
              <Text style={styles.rank}>{MEDALS[index] ?? `#${index + 1}`}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.firstName} {item.lastName}</Text>
                <Text style={styles.code}>{item.memberCode}</Text>
              </View>
              <View style={styles.visitsWrap}>
                <Text style={styles.visitsNum}>{item.visitCount ?? item.count ?? 0}</Text>
                <Text style={styles.visitsSub}>visits</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No data yet this month</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  sub: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardFirst: { borderColor: '#FF4D00', backgroundColor: '#1F1208' },
  rank: { fontSize: 24, width: 36, textAlign: 'center' },
  name: { color: '#F9FAFB', fontSize: 15, fontWeight: '600' },
  code: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  visitsWrap: { alignItems: 'center' },
  visitsNum: { color: '#FF4D00', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  visitsSub: { color: '#6B7280', fontSize: 11 },
  empty: { color: '#4B5563', textAlign: 'center', marginTop: 40 },
});
