import React, { useState } from 'react';
import { Alert, FlatList, Linking, Modal, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { can } from '../../lib/roles';
import {
  Avatar, Button, Card, EmptyState, Enter, Header, Icon, ListRow, Loading, PressScale, Screen, SectionTitle, StatRow, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface TrainerOption {
  id: string;
  specializations?: string[];
  user: { id: string; firstName: string; lastName: string; avatar?: string | null };
}

export default function PersonDetailScreen({ route, navigation }: any) {
  const person = route.params?.person ?? {};
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const canAssign = can(me, 'canManageMembers');
  const [picking, setPicking] = useState(false);
  const [trainerSearch, setTrainerSearch] = useState('');

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin-person', person.id],
    queryFn: () => api.get(`/users/${person.id}`) as any,
    enabled: !!person.id,
  });

  const toggleActive = useMutation({
    mutationFn: () => api.patch(`/users/${person.id}/${person.isActive ? 'deactivate' : 'activate'}`) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-people'] });
      queryClient.invalidateQueries({ queryKey: ['admin-person', person.id] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Could not update', e?.message ?? 'Try again'),
  });

  const u = { ...person, ...(detail ?? {}) };
  const membership = u.memberships?.[0] ?? detail?.memberships?.[0];
  const isMember = u.role === 'MEMBER';
  const isTrainer = u.role === 'TRAINER';

  // ── Trainer ↔ member assignment ──
  // `POST /trainers/:id/assign` has always existed; the app had no way to call it.

  const { data: assignedTrainer, isLoading: loadingTrainer } = useQuery({
    queryKey: ['member-trainer', person.id],
    queryFn: () => api.get(`/trainers/of-member/${person.id}`) as any,
    enabled: !!person.id && isMember && canAssign,
  });

  const { data: trainerList } = useQuery({
    queryKey: ['trainers', 'pickable'],
    queryFn: () => api.get('/trainers', { params: { limit: 100 } }) as any,
    enabled: picking,
    staleTime: 60_000,
  });

  // A trainer's own roster, when the person being viewed is a trainer.
  const { data: roster } = useQuery({
    queryKey: ['trainer-assignments', u.trainerId ?? person.id],
    queryFn: () => api.get(`/trainers/${u.trainerId ?? person.id}/assignments`) as any,
    enabled: !!(isTrainer && canAssign && (u.trainerId ?? person.id)),
  });

  const refreshAssignment = () => {
    queryClient.invalidateQueries({ queryKey: ['member-trainer', person.id] });
    queryClient.invalidateQueries({ queryKey: ['trainer-assignments'] });
  };

  const assign = useMutation({
    mutationFn: (trainerId: string) => api.post(`/trainers/${trainerId}/assign`, { memberId: person.id }) as any,
    onSuccess: () => { setPicking(false); refreshAssignment(); },
    onError: (e: any) => Alert.alert('Could not assign', e?.message ?? 'Try again'),
  });

  const unassign = useMutation({
    mutationFn: (trainerId: string) => api.delete(`/trainers/${trainerId}/assign/${person.id}`) as any,
    onSuccess: refreshAssignment,
    onError: (e: any) => Alert.alert('Could not unassign', e?.message ?? 'Try again'),
  });

  const trainers: TrainerOption[] = (() => {
    const raw = (trainerList as any)?.data ?? trainerList ?? [];
    const list: TrainerOption[] = Array.isArray(raw) ? raw : [];
    const q = trainerSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.toLowerCase().includes(q));
  })();

  const current: any = assignedTrainer ?? null;

  const confirmUnassign = () => {
    if (!current) return;
    Alert.alert('Remove trainer?', `${u.firstName} will no longer be assigned to ${current.firstName}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => unassign.mutate(current.trainerId) },
    ]);
  };

  const confirmToggle = () => {
    const off = u.isActive;
    Alert.alert(
      off ? 'Deactivate account?' : 'Activate account?',
      off ? `${u.firstName} will not be able to log in or check in.` : `${u.firstName} will regain access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: off ? 'Deactivate' : 'Activate', style: off ? 'destructive' : 'default', onPress: () => toggleActive.mutate() },
      ],
    );
  };

  if (isLoading && !person.id) return <Loading fullScreen />;

  return (
    <Screen scroll>
      <Header title={`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()} subtitle={u.role} onBack={() => navigation.goBack()} />

      <Enter index={0}>
        <Card style={styles.hero}>
          <Avatar uri={u.avatar} firstName={u.firstName} lastName={u.lastName} size={72} ring />
          <Text style={styles.name}>{u.firstName} {u.lastName}</Text>
          {u.memberCode ? <Text style={styles.code}>{u.memberCode}</Text> : null}
          <View style={[styles.statusPill, { backgroundColor: u.isActive ? colors.success + '22' : colors.danger + '22' }]}>
            <Text style={[styles.statusText, { color: u.isActive ? colors.success : colors.danger }]}>
              {u.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </Card>
      </Enter>

      {membership && (
        <Enter index={1}>
          <SectionTitle title="Membership" />
          <Card>
            <StatRow items={[
              { label: 'Plan', value: membership.plan?.name ?? '—' },
              { label: 'Status', value: membership.status ?? '—', color: membership.status === 'ACTIVE' ? colors.success : colors.warning },
              { label: 'Ends', value: membership.endDate ? new Date(membership.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—' },
            ]} />
          </Card>
        </Enter>
      )}

      {isMember && canAssign && (
        <Enter index={2}>
          <SectionTitle title="Trainer" />
          {loadingTrainer ? (
            <Loading />
          ) : current ? (
            <Card padding="md">
              <View style={styles.trainerRow}>
                <Avatar uri={current.avatar} firstName={current.firstName} lastName={current.lastName} size={44} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.trainerName} numberOfLines={1}>
                    {current.firstName} {current.lastName}
                  </Text>
                  <Text style={styles.trainerMeta} numberOfLines={1}>
                    {current.specializations?.length ? current.specializations.join(', ') : 'Assigned trainer'}
                  </Text>
                </View>
              </View>
              <View style={styles.trainerBtns}>
                <Button title="Change" variant="secondary" style={{ flex: 1 }} onPress={() => setPicking(true)} />
                <Button title="Remove" variant="ghost" style={{ flex: 1 }} onPress={confirmUnassign} loading={unassign.isPending} />
              </View>
            </Card>
          ) : (
            <Card padding="md">
              <Text style={styles.noTrainer}>No trainer assigned yet.</Text>
              <Button title="Assign a trainer" icon="user-plus" onPress={() => setPicking(true)} />
            </Card>
          )}
        </Enter>
      )}

      {isTrainer && canAssign && Array.isArray(roster) && (
        <Enter index={2}>
          <SectionTitle title={`Assigned members · ${roster.length}`} />
          {roster.length === 0 ? (
            <Card padding="md">
              <Text style={styles.noTrainer}>
                No members assigned yet. Assign from a member's own page.
              </Text>
            </Card>
          ) : (
            <Card padding="none">
              {roster.map((m: any, i: number) => (
                <ListRow
                  key={m.memberId}
                  icon="user"
                  iconColor={colors.primary}
                  label={`${m.firstName} ${m.lastName}`}
                  subtitle={m.memberCode ?? undefined}
                  last={i === roster.length - 1}
                />
              ))}
            </Card>
          )}
        </Enter>
      )}

      <Enter index={3}>
        <SectionTitle title="Contact" />
        <Card padding="none">
          <ListRow
            icon="mail"
            iconColor={colors.info}
            label="Email"
            subtitle={u.email}
            onPress={u.email ? () => Linking.openURL(`mailto:${u.email}`) : undefined}
          />
          <ListRow
            icon="smartphone"
            iconColor={colors.success}
            label="Phone"
            subtitle={u.phone ?? 'Not provided'}
            onPress={u.phone ? () => Linking.openURL(`tel:${u.phone}`) : undefined}
            last
          />
        </Card>
      </Enter>

      <Enter index={4}>
        <Button
          title={u.isActive ? 'Deactivate account' : 'Activate account'}
          variant={u.isActive ? 'danger' : 'primary'}
          icon={u.isActive ? 'user-x' : 'user-check'}
          onPress={confirmToggle}
          loading={toggleActive.isPending}
          style={{ marginTop: spacing.md }}
        />
        <Text style={styles.hint}>Editing details and adding people is done from the web dashboard.</Text>
      </Enter>

      {/* ── Trainer picker ── */}
      <Modal visible={picking} animationType="slide" transparent onRequestClose={() => setPicking(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Assign a trainer</Text>
            <Text style={styles.sheetSub}>{u.firstName} {u.lastName}</Text>
            <TextField
              value={trainerSearch}
              onChangeText={setTrainerSearch}
              placeholder="Search trainers"
              style={{ marginBottom: spacing.md }}
            />
            <FlatList
              data={trainers}
              keyExtractor={(t) => t.id}
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ gap: spacing.sm }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <EmptyState
                  icon="whistle-outline"
                  title={trainerSearch ? 'No matches' : 'No trainers yet'}
                  subtitle={trainerSearch ? 'Try a different name' : 'Add a trainer before assigning one.'}
                />
              }
              renderItem={({ item }) => {
                const isCurrent = current?.trainerId === item.id;
                return (
                  <PressScale
                    style={[styles.pickRow, isCurrent && styles.pickRowOn]}
                    scaleTo={0.98}
                    onPress={() => (isCurrent ? setPicking(false) : assign.mutate(item.id))}
                  >
                    <Avatar uri={item.user?.avatar} firstName={item.user?.firstName} lastName={item.user?.lastName} size={38} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.trainerName} numberOfLines={1}>
                        {item.user?.firstName} {item.user?.lastName}
                      </Text>
                      {item.specializations?.length ? (
                        <Text style={styles.trainerMeta} numberOfLines={1}>{item.specializations.join(', ')}</Text>
                      ) : null}
                    </View>
                    {isCurrent ? <Icon name="check" size={18} color={colors.primary} /> : null}
                  </PressScale>
                );
              }}
            />
            <Button
              title="Cancel"
              variant="secondary"
              style={{ marginTop: spacing.lg }}
              onPress={() => setPicking(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  name: { color: colors.text, ...typography.title, marginTop: spacing.sm },
  code: { color: colors.primary, ...typography.label, fontWeight: '700', letterSpacing: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: spacing.xs },
  statusText: { ...typography.caption, fontWeight: '700' },
  hint: { color: colors.textFaint, ...typography.caption, textAlign: 'center', marginTop: spacing.md },

  trainerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  trainerName: { color: colors.text, ...typography.h2 },
  trainerMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  trainerBtns: { flexDirection: 'row', gap: spacing.sm },
  noTrainer: { color: colors.textMuted, ...typography.caption, marginBottom: spacing.md },

  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  pickRowOn: { borderColor: colors.primary, backgroundColor: tint(colors.primary, '12') },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.xl + 4, borderTopRightRadius: radius.xl + 4,
    padding: spacing.xxl, paddingBottom: 40, borderTopWidth: 1, borderColor: colors.border,
  },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.xl },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sheetSub: { color: colors.textMuted, ...typography.label, marginBottom: spacing.lg },
});
