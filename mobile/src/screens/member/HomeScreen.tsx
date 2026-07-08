import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { MobileHomeData } from '../../types';
import { usePushToken } from '../../hooks/usePushToken';

const ORANGE = '#FF4D00';

function StatPill({ label, value, color = ORANGE }: { label: string; value: string; color?: string }) {
  return (
    <View style={[styles.statPill, { borderColor: color + '40' }]}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <View>
        <Text style={[styles.statVal, { color }]}>{value}</Text>
        <Text style={styles.statLbl}>{label}</Text>
      </View>
    </View>
  );
}

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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ORANGE} size="large" />
        <Text style={styles.loadingText}>Connecting…{'\n'}First load may take 60s</Text>
      </View>
    );
  }

  const isCheckedIn = data?.isCheckedInToday ?? false;
  const end = data?.membership ? new Date(data.membership.endDate) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)) : null;
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  const quickActions = [
    { label: 'QR Code', icon: '📱', tab: 'Attendance' },
    { label: 'Workout', icon: '🏋️', tab: 'Plans' },
    { label: 'Diet', icon: '🥗', tab: 'Plans' },
    { label: 'Progress', icon: '📊', tab: 'Plans' },
    { label: 'Store', icon: '🛒', tab: 'Store' },
    { label: 'Profile', icon: '👤', tab: 'Profile' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ORANGE} />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good {getGreeting()} 👋</Text>
            <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill label="Status" value={isCheckedIn ? 'Active' : 'Not In'} color={isCheckedIn ? '#22C55E' : '#6B7280'} />
          {data?.activeWorkout && <StatPill label="Workout" value={data.activeWorkout.name} color="#7C3AED" />}
          {data?.activeDiet && <StatPill label="Diet" value={data.activeDiet.name} color="#059669" />}
        </View>
      </View>

      {/* ── Check-in button ── */}
      <TouchableOpacity
        style={[styles.checkBtn, isCheckedIn && styles.checkBtnOut]}
        onPress={() => isCheckedIn ? checkOutMutation.mutate() : checkInMutation.mutate()}
        disabled={checkInMutation.isPending || checkOutMutation.isPending}
        activeOpacity={0.9}
      >
        {(checkInMutation.isPending || checkOutMutation.isPending) ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <View style={styles.checkBtnInner}>
            <Text style={styles.checkBtnIcon}>{isCheckedIn ? '🚪' : '✅'}</Text>
            <View>
              <Text style={styles.checkBtnLabel}>{isCheckedIn ? 'Check Out' : 'Check In'}</Text>
              {data?.checkedInAt && isCheckedIn && (
                <Text style={styles.checkBtnSub}>
                  Since {new Date(data.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Membership card ── */}
      {data?.membership ? (
        <View style={[styles.memberCard, daysLeft !== null && daysLeft < 7 && styles.memberCardWarn]}>
          <View style={styles.memberCardTop}>
            <View>
              <Text style={styles.planName}>{data.membership.plan.name}</Text>
              <Text style={styles.planType}>{data.membership.plan.type}</Text>
            </View>
            <View style={[styles.daysBadge, { backgroundColor: (daysLeft ?? 99) < 7 ? '#EF4444' : '#22C55E' }]}>
              <Text style={styles.daysBadgeText}>{daysLeft}d</Text>
            </View>
          </View>
          <View style={styles.memberCardBar}>
            <View style={[styles.barFill, {
              width: `${Math.min(100, Math.max(0, ((daysLeft ?? 0) / (data.membership.plan.durationMonths * 30)) * 100))}%`,
              backgroundColor: (daysLeft ?? 99) < 7 ? '#EF4444' : ORANGE,
            }]} />
          </View>
          <Text style={styles.expiry}>
            Expires {end?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      ) : (
        <View style={[styles.memberCard, { borderColor: '#374151' }]}>
          <Text style={styles.planName}>No Active Membership</Text>
          <Text style={[styles.expiry, { marginTop: 4 }]}>Tap Profile → Renew Membership</Text>
        </View>
      )}

      {/* ── Quick Actions ── */}
      <Text style={styles.sectionHeading}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        {quickActions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={styles.quickCard}
            onPress={() => navigation.navigate(a.tab)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickIcon}>{a.icon}</Text>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A', gap: 16 },
  loadingText: { color: '#4B5563', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20, overflow: 'hidden' },
  headerGlow: {
    position: 'absolute', top: -60, right: -40, width: 200, height: 200,
    borderRadius: 100, backgroundColor: ORANGE, opacity: 0.06,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting: { color: '#6B7280', fontSize: 13 },
  name: { color: '#F9FAFB', fontSize: 24, fontWeight: '800', marginTop: 2 },

  avatarBtn: { marginLeft: 8 },
  avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: ORANGE },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#141414', borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statVal: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  statLbl: { color: '#6B7280', fontSize: 10 },

  checkBtn: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: ORANGE,
    borderRadius: 20, paddingVertical: 22, paddingHorizontal: 24,
    shadowColor: ORANGE, shadowOpacity: 0.45, shadowRadius: 16, elevation: 8,
  },
  checkBtnOut: { backgroundColor: '#1F2937', shadowColor: 'transparent', shadowOpacity: 0 },
  checkBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  checkBtnIcon: { fontSize: 32 },
  checkBtnLabel: { color: '#fff', fontSize: 20, fontWeight: '800' },
  checkBtnSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },

  memberCard: {
    marginHorizontal: 20, marginBottom: 20, backgroundColor: '#141414',
    borderRadius: 18, padding: 18, borderWidth: 1, borderColor: ORANGE + '50',
  },
  memberCardWarn: { borderColor: '#EF444480' },
  memberCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planName: { color: '#F9FAFB', fontSize: 17, fontWeight: '700' },
  planType: { color: '#9CA3AF', fontSize: 12, marginTop: 3 },
  daysBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  daysBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  memberCardBar: { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2 },
  expiry: { color: '#6B7280', fontSize: 12 },

  sectionHeading: {
    color: '#9CA3AF', fontSize: 13, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, paddingHorizontal: 20, marginBottom: 12,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
  quickCard: {
    width: '30%', backgroundColor: '#141414', borderRadius: 16,
    padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#1F1F1F',
  },
  quickIcon: { fontSize: 26, marginBottom: 8 },
  quickLabel: { color: '#9CA3AF', fontSize: 12, textAlign: 'center', fontWeight: '500' },
});
