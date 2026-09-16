import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Avatar, Card, Chip, ChipRow, EmptyState, Header, Icon, Loading, PressScale, Screen, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

type Role = 'MEMBER' | 'TRAINER' | 'STAFF';

const TABS: { role: Role; label: string }[] = [
  { role: 'MEMBER', label: 'Members' },
  { role: 'TRAINER', label: 'Trainers' },
  { role: 'STAFF', label: 'Staff' },
];

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: Role;
  isActive: boolean;
  memberCode?: string;
  memberId?: string;
}

export default function PeopleScreen({ navigation }: any) {
  const [role, setRole] = useState<Role>('MEMBER');
  const [search, setSearch] = useState('');
  const scope = useGymScope();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: scope.key(['admin-people', role]),
    queryFn: () => api.get('/users', { params: scope.params({ role, limit: 200 }) }) as any,
    staleTime: 60_000,
  });

  const people: Person[] = Array.isArray(data) ? data : (data?.data ?? []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) =>
      `${p.firstName} ${p.lastName} ${p.email} ${p.phone ?? ''} ${p.memberCode ?? ''}`.toLowerCase().includes(q),
    );
  }, [people, search]);

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header title="People" subtitle={`${filtered.length} ${role.toLowerCase()}${filtered.length === 1 ? '' : 's'}`} />

        <ChipRow>
          {TABS.map((t) => (
            <Chip key={t.role} label={t.label} selected={role === t.role} onPress={() => setRole(t.role)} />
          ))}
        </ChipRow>

        <View style={styles.searchWrap}>
          <TextField value={search} onChangeText={setSearch} placeholder="Search by name, phone or code" />
        </View>
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={search ? 'No matches' : `No ${role.toLowerCase()}s yet`}
              subtitle={search ? 'Try a different search' : 'Add people from the web dashboard'}
            />
          }
          renderItem={({ item }) => (
            <PressScale
              style={styles.row}
              scaleTo={0.98}
              onPress={() => navigation.navigate('PersonDetail', { person: item })}
            >
              <Avatar uri={item.avatar} firstName={item.firstName} lastName={item.lastName} size={44} />
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.memberCode ? `${item.memberCode} · ` : ''}{item.phone ?? item.email}
                </Text>
              </View>
              {!item.isActive && (
                <View style={styles.inactivePill}><Text style={styles.inactiveText}>Inactive</Text></View>
              )}
              <Icon name="chevron-right" size={18} color={colors.textFaint} />
            </PressScale>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  searchWrap: { marginTop: spacing.md, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.h2 },
  rowMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  inactivePill: { backgroundColor: tint(colors.danger, '22'), borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveText: { color: colors.danger, ...typography.micro, fontWeight: '700' },
});
