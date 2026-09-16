import React from 'react';
import { Alert, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymContextStore } from '../../store/gymContextStore';
import {
  Button, Card, Chip, ChipRow, Enter, GlowOrb, Header, Icon, ListRow, Loading, Screen, SectionTitle, StatRow,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const PLANS = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

export default function GymDetailScreen({ route, navigation }: any) {
  const gymId: string = route.params?.gymId;
  const queryClient = useQueryClient();
  const setSelectedGym = useGymContextStore((s) => s.setSelectedGym);

  const gymQ = useQuery({
    queryKey: ['platform-gym', gymId],
    queryFn: () => api.get(`/gyms/${gymId}`) as any,
    enabled: !!gymId,
  });

  const statsQ = useQuery({
    queryKey: ['platform-gym-stats', gymId],
    queryFn: () => api.get(`/gyms/${gymId}/stats`) as any,
    enabled: !!gymId,
  });

  const setPlan = useMutation({
    mutationFn: (plan: string) => api.patch(`/gyms/${gymId}/subscription-plan`, { plan, reason: 'Changed from the platform app' }) as any,
    onSuccess: () => {
      Alert.alert('Plan updated');
      queryClient.invalidateQueries({ queryKey: ['platform-gym', gymId] });
      queryClient.invalidateQueries({ queryKey: ['platform-gyms'] });
    },
    onError: (e: any) => Alert.alert('Could not change the plan', e?.message ?? 'Try again'),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/gyms/${gymId}/status`, { status }) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-gym', gymId] });
      queryClient.invalidateQueries({ queryKey: ['platform-gyms'] });
    },
    onError: (e: any) => Alert.alert('Could not change the status', e?.message ?? 'Try again'),
  });

  if (gymQ.isLoading) return <Loading fullScreen />;

  const gym: any = gymQ.data ?? {};
  const stats: any = statsQ.data ?? {};
  const suspended = gym.status === 'SUSPENDED';

  const openAsAdmin = () => {
    setSelectedGym({ id: gymId, name: gym.name, logo: gym.logo });
    navigation.navigate('GymScope');
  };

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={gymQ.isRefetching} onRefresh={() => { gymQ.refetch(); statsQ.refetch(); }} tintColor={colors.primary} />}
    >
      <Header title={gym.name ?? 'Gym'} subtitle={[gym.city, gym.state].filter(Boolean).join(', ')} onBack={() => navigation.goBack()} />

      <Enter index={0}>
        <Card glow>
          <GlowOrb size={200} intensity={0.3} style={styles.cardGlow} />
          <StatRow items={[
            { label: 'Members', value: stats.totalMembers ?? 0 },
            { label: 'Active', value: stats.activeMembers ?? 0, color: colors.success },
            { label: 'In today', value: stats.todayAttendance ?? 0, color: colors.primary },
          ]} />
          <View style={styles.revenueRow}>
            <View style={styles.revenue}>
              <Text style={styles.revenueValue}>{money(stats.monthlyRevenue)}</Text>
              <Text style={styles.revenueLabel}>Revenue this month</Text>
            </View>
            <View style={styles.revenue}>
              <Text style={styles.revenueValue}>{stats.pendingPayments ?? 0}</Text>
              <Text style={styles.revenueLabel}>Pending payments</Text>
            </View>
          </View>
        </Card>
      </Enter>

      {/* The whole point of the screen: act as this gym. */}
      <Enter index={1}>
        <Button title={`Open ${gym.name ?? 'this gym'} as admin`} size="lg" icon="bank-outline" onPress={openAsAdmin} />
        <Text style={styles.hint}>You will see their dashboard, people, attendance and books. Read-only.</Text>
      </Enter>

      <Enter index={2}>
        <SectionTitle title="Subscription" />
        <Card>
          <Text style={styles.label}>Current plan</Text>
          <ChipRow>
            {PLANS.map((p) => (
              <Chip
                key={p}
                label={p}
                selected={gym.saasPlan === p}
                onPress={() =>
                  gym.saasPlan !== p &&
                  Alert.alert('Change plan?', `Move ${gym.name} to ${p}. Use this for comps and corrections, not for normal payments.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: `Set ${p}`, onPress: () => setPlan.mutate(p) },
                  ])
                }
              />
            ))}
          </ChipRow>
          <Text style={styles.meta}>
            {gym.saasStatus}
            {gym.saasExpiresAt ? ` · ends ${new Date(gym.saasExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
          </Text>
        </Card>
      </Enter>

      <Enter index={3}>
        <SectionTitle title="Contact" />
        <Card padding="none">
          <ListRow icon="mail" iconColor={colors.info} label="Email" subtitle={gym.email}
            onPress={gym.email ? () => Linking.openURL(`mailto:${gym.email}`) : undefined} />
          <ListRow icon="smartphone" iconColor={colors.success} label="Phone" subtitle={gym.phone}
            onPress={gym.phone ? () => Linking.openURL(`tel:${gym.phone}`) : undefined} />
          <ListRow icon="map-pin" iconColor={colors.purple} label="Address" subtitle={gym.address} last />
        </Card>
      </Enter>

      <Enter index={4}>
        <Button
          title={suspended ? 'Reactivate this gym' : 'Suspend this gym'}
          variant={suspended ? 'primary' : 'danger'}
          icon={suspended ? 'check' : 'slash'}
          loading={setStatus.isPending}
          onPress={() =>
            Alert.alert(
              suspended ? 'Reactivate?' : 'Suspend this gym?',
              suspended ? `${gym.name} regains access.` : `${gym.name} and all its members lose access until you reactivate it.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: suspended ? 'Reactivate' : 'Suspend',
                  style: suspended ? 'default' : 'destructive',
                  onPress: () => setStatus.mutate(suspended ? 'ACTIVE' : 'SUSPENDED'),
                },
              ],
            )
          }
        />
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardGlow: { top: -80, right: -60 },
  revenueRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  revenue: { flex: 1 },
  revenueValue: { color: colors.text, ...typography.h2, ...typography.number },
  revenueLabel: { color: colors.textMuted, ...typography.micro, marginTop: 2 },
  hint: { color: colors.textMuted, ...typography.caption, textAlign: 'center', marginTop: spacing.sm },
  label: { color: colors.textMuted, ...typography.micro, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  meta: { color: colors.textSecondary, ...typography.caption, marginTop: spacing.md },
});
