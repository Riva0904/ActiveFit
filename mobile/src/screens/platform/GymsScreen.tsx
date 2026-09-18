import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymContextStore } from '../../store/gymContextStore';
import {
  Card, Chip, ChipRow, EmptyState, Header, Icon, Loading, PressScale, Screen, SectionTitle, StatRow, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface Gym {
  id: string; name: string; city?: string; email?: string;
  status: string; saasPlan: string; saasStatus: string; saasExpiresAt?: string;
  _count?: { members: number; trainers: number };
}

const PLAN_COLOR: Record<string, string> = {
  STARTER: colors.textMuted,
  PROFESSIONAL: colors.primary,
  ENTERPRISE: colors.purple,
};
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

export default function GymsScreen({ navigation }: any) {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const setSelectedGym = useGymContextStore((s) => s.setSelectedGym);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['platform-gyms', status, search],
    queryFn: () => api.get('/gyms', { params: { limit: 100, ...(status ? { status } : {}), ...(search ? { search } : {}) } }) as any,
  });

  const gyms: Gym[] = Array.isArray(data) ? data : (data?.data ?? []);

  // Platform totals come from the server, not from this page of gyms: summing
  // `gyms.length` and each gym's member count only ever counted the first 100,
  // and the filters above narrow the list further.
  const { data: stats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.get('/analytics/platform/stats') as any,
    staleTime: 60_000,
  });

  const openGym = (gym: Gym) => {
    setSelectedGym({ id: gym.id, name: gym.name });
    navigation.navigate('GymDetail', { gymId: gym.id, name: gym.name });
  };

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header title="Gyms" subtitle="Every gym on the platform" />

        <Card padding="md">
          <StatRow items={[
            { label: 'Gyms', value: (stats as any)?.totalGyms ?? '—' },
            { label: 'Members', value: (stats as any)?.usersByRole?.members ?? '—', color: colors.primary },
            { label: 'Active', value: (stats as any)?.activeGyms ?? '—', color: colors.success },
          ]} />
        </Card>

        <View style={styles.filters}>
          <ChipRow>
            {FILTERS.map((f) => (
              <Chip key={f.value || 'all'} label={f.label} selected={status === f.value} onPress={() => setStatus(f.value)} />
            ))}
          </ChipRow>
        </View>

        <View style={styles.searchWrap}>
          <TextField value={search} onChangeText={setSearch} placeholder="Search by name or city" />
        </View>

        <SectionTitle title={`${gyms.length} gym${gyms.length === 1 ? '' : 's'}`} />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={gyms}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="bank-outline" title="No gyms" subtitle="Gyms you onboard appear here." />}
          renderItem={({ item }) => {
            const planColor = PLAN_COLOR[item.saasPlan] ?? colors.textMuted;
            const lapsed = item.saasStatus === 'EXPIRED';
            return (
              <PressScale style={styles.row} scaleTo={0.98} onPress={() => openGym(item)}>
                <View style={[styles.logo, { backgroundColor: tint(planColor, '22') }]}>
                  <Icon name="bank-outline" size={18} color={planColor} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.city ?? item.email} · {item._count?.members ?? 0} members
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <View style={[styles.pill, { backgroundColor: tint(planColor, '22') }]}>
                    <Text style={[styles.pillText, { color: planColor }]}>{item.saasPlan}</Text>
                  </View>
                  {lapsed ? <Text style={styles.lapsed}>expired</Text> : null}
                </View>
                <Icon name="chevron-right" size={18} color={colors.textFaint} />
              </PressScale>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  filters: { marginTop: spacing.md },
  searchWrap: { marginTop: spacing.sm },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  logo: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.h2 },
  rowMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  pill: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { ...typography.micro, fontWeight: '800' },
  lapsed: { color: colors.danger, ...typography.micro, fontWeight: '700' },
});
