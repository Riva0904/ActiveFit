import React from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>Notifications</Text>
          {items.some((n) => !n.isRead) && (
            <TouchableOpacity onPress={() => markAllRead.mutate()}>
              <Text style={styles.markAll}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF4D00" />}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.isRead && styles.unread]}>
              {!item.isRead && <View style={styles.dot} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifBody}>{item.message}</Text>
                <Text style={styles.notifDate}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : ''}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { marginBottom: 12 },
  backText: { color: '#FF4D00', fontSize: 16 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  markAll: { color: '#FF4D00', fontSize: 13 },
  emptyCard: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#9CA3AF', fontSize: 16 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  unread: { borderColor: '#FF4D00' },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4D00',
    marginRight: 10, marginTop: 5,
  },
  notifTitle: { color: '#F9FAFB', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  notifBody: { color: '#9CA3AF', fontSize: 13, marginBottom: 6 },
  notifDate: { color: '#4B5563', fontSize: 11 },
});
