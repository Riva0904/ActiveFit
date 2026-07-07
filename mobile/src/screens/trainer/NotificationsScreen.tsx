import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function TrainerNotificationsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['trainer-notifications'],
    queryFn: () => api.get('/notifications') as any,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trainer-notifications'] }),
    onError: (e: any) => Alert.alert('Error', e?.message),
  });

  const notifications: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const unread = notifications.filter((n: any) => !n.isRead).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Notifications</Text>
          {unread > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllMutation.mutate()}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
        {unread > 0 && <Text style={styles.unreadBadge}>{unread} unread</Text>}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[styles.card, !item.isRead && styles.cardUnread]}>
              <View style={styles.cardTop}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifTime}>
                  {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <Text style={styles.notifBody}>{item.message ?? item.body}</Text>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 48 }}>🔔</Text>
              <Text style={styles.emptyText}>No notifications</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  markAllBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#1A1A1A', borderRadius: 8 },
  markAllText: { color: '#FF4D00', fontSize: 13, fontWeight: '600' },
  unreadBadge: { color: '#FF4D00', fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14,
    marginBottom: 10, marginTop: 10, borderWidth: 1, borderColor: '#2A2A2A',
    position: 'relative',
  },
  cardUnread: { borderColor: '#FF4D00', borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  notifTitle: { color: '#F9FAFB', fontSize: 14, fontWeight: '700', flex: 1 },
  notifTime: { color: '#6B7280', fontSize: 11 },
  notifBody: { color: '#9CA3AF', fontSize: 13, lineHeight: 18 },
  unreadDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4D00',
  },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
});
