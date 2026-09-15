import React from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { colors } from '../../theme';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: colors.info, COMPLETED: colors.success, CANCELLED: colors.danger, NO_SHOW: colors.warning,
};

export default function TrainerSessionsScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['trainer-sessions'],
    queryFn: () => api.get('/pt-sessions') as any,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/pt-sessions/${id}/complete`) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainer-sessions'] }),
    onError: (e: any) => Alert.alert('Error', e?.message),
  });

  const sessions: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, marginBottom: 4 }}>
        <Text style={styles.header}>PT Sessions</Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
          onPress={() => navigation.navigate('CreateSession')}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+ Create</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title ?? 'PT Session'}</Text>
                  <Text style={styles.member}>
                    {item.member?.user?.firstName} {item.member?.user?.lastName}
                  </Text>
                  <Text style={styles.time}>
                    {new Date(item.scheduledAt).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })} · {item.duration}m
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? colors.textMuted }]}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </View>
              {item.status === 'SCHEDULED' && (
                <TouchableOpacity
                  style={styles.completeBtn}
                  onPress={() => completeMutation.mutate(item.id)}
                  disabled={completeMutation.isPending}
                >
                  <Text style={styles.completeBtnText}>Mark Complete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No sessions found</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { color: colors.text, fontSize: 22, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  member: { color: colors.textSecondary, fontSize: 13, marginBottom: 2 },
  time: { color: colors.textMuted, fontSize: 12 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  completeBtn: {
    marginTop: 12, backgroundColor: colors.success, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  completeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { color: colors.textFaint, fontSize: 14, textAlign: 'center', marginTop: 32 },
});
