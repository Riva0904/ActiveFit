import React, { useEffect, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Avatar, Card, Chip, ChipRow, EmptyState, Header, Icon, Loading, PressScale, Screen, StatRow, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

type DueStatus = 'PAID' | 'PENDING' | 'OVERDUE';

interface DueRow {
  memberId: string;
  memberCode: string;
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  planName: string | null;
  endDate: string | null;
  amount: number;
  paid: number;
  due: number;
  status: DueStatus;
}

const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

const STATUS_STYLE: Record<DueStatus, { label: string; color: string }> = {
  PAID: { label: 'Paid', color: colors.success },
  PENDING: { label: 'Pending', color: colors.warning },
  OVERDUE: { label: 'Overdue', color: colors.danger },
};

const FILTERS: { value: '' | DueStatus; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
];

/**
 * Who owes what, for the front desk.
 *
 * Reads `GET /payments/member-dues`, which is the only payments route staff may
 * call — the desk needs to know whether the person at the counter is paid up,
 * not what the gym earns.
 */
export default function MemberDuesScreen({ navigation }: any) {
  const scope = useGymScope();
  const [filter, setFilter] = useState<'' | DueStatus>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: scope.key(['member-dues', filter, debounced]),
    queryFn: () =>
      api.get('/payments/member-dues', {
        params: scope.params({
          ...(filter ? { status: filter } : {}),
          ...(debounced ? { search: debounced } : {}),
        }),
      }) as any,
    staleTime: 30_000,
  });

  const rows: DueRow[] = (data as any)?.data ?? [];
  const counts = (data as any)?.counts ?? { paid: 0, pending: 0, overdue: 0 };

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="Member dues"
          subtitle="Who has paid, and who has not"
          onBack={navigation.canGoBack?.() ? () => navigation.goBack() : undefined}
        />

        <Card padding="md">
          <StatRow items={[
            { label: 'Paid', value: counts.paid, color: colors.success },
            { label: 'Pending', value: counts.pending, color: colors.warning },
            { label: 'Overdue', value: counts.overdue, color: colors.danger },
          ]} />
        </Card>

        <View style={styles.filters}>
          <ChipRow>
            {FILTERS.map((f) => (
              <Chip key={f.value || 'all'} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </ChipRow>
        </View>

        <TextField value={search} onChangeText={setSearch} placeholder="Search name, code or phone" />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.memberId}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="credit-card"
              title={debounced || filter ? 'No matches' : 'No members yet'}
              subtitle={debounced || filter ? 'Try a different search or filter' : 'Members appear here once they sign up.'}
            />
          }
          renderItem={({ item }) => {
            const s = STATUS_STYLE[item.status];
            return (
              <Card padding="md">
                <View style={styles.row}>
                  <Avatar uri={item.avatar} firstName={item.firstName} lastName={item.lastName} size={44} />
                  <View style={styles.body}>
                    <Text style={styles.name} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.memberCode}{item.planName ? ` · ${item.planName}` : ' · no plan'}
                    </Text>
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: tint(s.color, '1F') }]}>
                    <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                  </View>
                </View>

                <View style={styles.amounts}>
                  <Text style={styles.due}>
                    {item.due > 0 ? `${money(item.due)} due` : 'Nothing due'}
                  </Text>
                  {item.endDate ? (
                    <Text style={styles.meta}>
                      {item.status === 'OVERDUE' ? 'Expired' : 'Until'}{' '}
                      {new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  ) : null}
                  {item.phone ? (
                    <PressScale style={styles.callBtn} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                      <Icon name="phone" size={14} color={colors.primary} />
                      <Text style={styles.callText}>Call</Text>
                    </PressScale>
                  ) : null}
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  filters: { marginVertical: spacing.md },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.h2 },
  meta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  statusChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { ...typography.micro, fontWeight: '800' },
  amounts: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' },
  due: { color: colors.text, ...typography.body, fontWeight: '700', ...typography.number },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto',
    backgroundColor: tint(colors.primary, '18'), borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: tint(colors.primary, '38'),
  },
  callText: { color: colors.primary, ...typography.micro, fontWeight: '800' },
});
