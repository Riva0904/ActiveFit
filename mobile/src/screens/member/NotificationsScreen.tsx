import React from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card, EmptyState, Header, Loading, Screen } from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function NotificationsScreen({ navigation }: any) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications') as any,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const hasUnread = items.some((n) => !n.isRead);

  return (
    <Screen>
      <Header
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={hasUnread ? (
          <TouchableOpacity onPress={() => markAllRead.mutate()} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <Card padding="md" style={styles.row} accent={item.isRead ? undefined : 'primary'}>
              {!item.isRead ? <View style={styles.dot} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.message}</Text>
                <Text style={styles.date}>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : ''}</Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={<EmptyState icon="bell" title="No notifications" subtitle="You're all caught up" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { color: colors.primary, ...typography.label, fontWeight: '600', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  title: { color: colors.text, ...typography.body, fontWeight: '700', marginBottom: 4 },
  body: { color: colors.textSecondary, ...typography.label, marginBottom: 6 },
  date: { color: colors.textFaint, ...typography.micro },
});
