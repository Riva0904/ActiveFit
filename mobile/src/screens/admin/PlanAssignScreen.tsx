import React, { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import { can } from '../../lib/roles';
import { useAuthStore } from '../../store/authStore';
import {
  Avatar, Button, Card, Checkbox, EmptyState, Header, Icon, Loading, PressScale, Screen, SectionTitle, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

export default function PlanAssignScreen({ route, navigation }: any) {
  const { kind, plan } = route.params as { kind: 'workout' | 'diet'; plan: any };
  const queryClient = useQueryClient();
  const user = useAuthStore((st) => st.user);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // A trainer cannot read /users — that would expose every staff and trainer row
  // gym-wide. They get their own assigned members instead, which is the list
  // they should be assigning plans from anyway.
  const canListAll = can(user, 'canListAllMembers');
  const scope = useGymScope();
  const membersQ = useQuery({
    queryKey: canListAll ? scope.key(['admin-people', 'MEMBER']) : ['trainer-assigned-members'],
    queryFn: () =>
      (canListAll
        ? api.get('/users', { params: scope.params({ role: 'MEMBER', limit: 200 }) })
        : api.get('/pt-sessions/assigned-members')) as any,
    staleTime: 60_000,
  });

  const assignmentsQ = useQuery({
    queryKey: ['plan-assignments', kind, plan.id],
    queryFn: () => api.get(`/${kind}-plans/${plan.id}/assignments`) as any,
  });

  const assign = useMutation({
    mutationFn: (memberIds: string[]) => api.post(`/${kind}-plans/${plan.id}/assign`, { memberIds }) as any,
    onSuccess: (res: any) => {
      setSelected(new Set());
      Alert.alert('Assigned', `${res?.assigned ?? 0} member${res?.assigned === 1 ? '' : 's'} added to this plan.`);
      assignmentsQ.refetch();
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: (e: any) => Alert.alert('Could not assign', e?.message ?? 'Try again'),
  });

  const unassign = useMutation({
    mutationFn: (assignmentId: string) => api.delete(`/${kind}-plans/assignments/${assignmentId}`) as any,
    onSuccess: () => {
      assignmentsQ.refetch();
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
    },
    onError: (e: any) => Alert.alert('Could not remove', e?.message ?? 'Try again'),
  });

  // The two sources have different shapes: /users returns User rows carrying a
  // memberId, /pt-sessions/assigned-members returns Member rows. Normalise both
  // to { memberId, firstName, lastName, memberCode } so the list below is one path.
  const rawMembers: any[] = Array.isArray(membersQ.data) ? membersQ.data : (membersQ.data?.data ?? []);
  const members: any[] = rawMembers.map((m: any) => ({
    id: m.id,
    memberId: m.memberId ?? (canListAll ? undefined : m.id),
    firstName: m.firstName ?? m.user?.firstName,
    lastName: m.lastName ?? m.user?.lastName,
    memberCode: m.memberCode,
    email: m.email ?? m.user?.email,
  }));
  const assignments: any[] = Array.isArray(assignmentsQ.data) ? assignmentsQ.data : (assignmentsQ.data?.data ?? []);
  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.member?.id).filter(Boolean)), [assignments]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (!m.memberId) return false;
      if (assignedIds.has(m.memberId)) return false;
      if (!q) return true;
      return `${m.firstName} ${m.lastName} ${m.memberCode ?? ''}`.toLowerCase().includes(q);
    });
  }, [members, search, assignedIds]);

  const toggle = (memberId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });

  if (membersQ.isLoading) return <Loading fullScreen />;

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title={plan.name}
          subtitle={kind === 'workout' ? 'Workout plan' : 'Diet plan'}
          onBack={() => navigation.goBack()}
        />

        {assignments.length > 0 && (
          <>
            <SectionTitle title={`On this plan (${assignments.length})`} />
            {assignments.map((a) => (
              <View key={a.id} style={[styles.row, styles.assignedRow]}>
                <Avatar firstName={a.member?.user?.firstName} lastName={a.member?.user?.lastName} size={36} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {a.member?.user?.firstName} {a.member?.user?.lastName}
                  </Text>
                  <Text style={styles.rowMeta}>{a.member?.memberCode}</Text>
                </View>
                <PressScale
                  style={styles.removeBtn}
                  onPress={() =>
                    Alert.alert('Remove from plan?', `${a.member?.user?.firstName} will lose access to it.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => unassign.mutate(a.id) },
                    ])
                  }
                >
                  <Icon name="trash-2" size={15} color={colors.danger} />
                </PressScale>
              </View>
            ))}
          </>
        )}

        <SectionTitle title="Add members" />
        <TextField value={search} onChangeText={setSearch} placeholder="Search members" />
      </View>

      <FlatList
        data={candidates}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={membersQ.isRefetching} onRefresh={membersQ.refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="users"
            title={search ? 'No matches' : 'Everyone is on this plan'}
            subtitle={search ? 'Try a different search' : undefined}
          />
        }
        renderItem={({ item }) => {
          const picked = selected.has(item.memberId);
          return (
            <PressScale style={[styles.row, picked && styles.pickedRow]} scaleTo={0.98} onPress={() => toggle(item.memberId)}>
              <Checkbox checked={picked} onToggle={() => toggle(item.memberId)} />
              <Avatar firstName={item.firstName} lastName={item.lastName} size={36} />
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
                <Text style={styles.rowMeta}>{item.memberCode ?? item.email}</Text>
              </View>
            </PressScale>
          );
        }}
      />

      {selected.size > 0 && (
        <View style={styles.footer}>
          <Button
            title={`Assign to ${selected.size} member${selected.size === 1 ? '' : 's'}`}
            size="lg"
            icon="user-plus"
            onPress={() => assign.mutate([...selected])}
            loading={assign.isPending}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  assignedRow: { marginBottom: spacing.sm, borderColor: tint(colors.success, '44') },
  pickedRow: { borderColor: colors.primary },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.h2 },
  rowMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  removeBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tint(colors.danger, '18'),
  },
  footer: {
    padding: spacing.screen, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.surfaceRaised,
  },
});
