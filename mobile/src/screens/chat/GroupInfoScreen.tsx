import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/Text';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';
import {
  Avatar, Button, Card, Checkbox, EmptyState, Field, Header, Loading,
  PressScale, Screen, SectionTitle, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface Participant {
  id: string; firstName: string; lastName: string; role: string;
  avatar?: string | null; groupRole: 'OWNER' | 'MEMBER';
}
interface Group {
  id: string; name: string | null; isOwner: boolean;
  participantCount: number; participants: Participant[];
}
interface Contact { id: string; firstName: string; lastName: string; role: string; avatar?: string | null }

const ROLE_LABEL: Record<string, string> = {
  GYM_ADMIN: 'Gym admin', TRAINER: 'Trainer', STAFF: 'Front desk', MEMBER: 'Member',
};

/**
 * Who is in a group, and the owner-only controls. Everything that changes the
 * room — rename, add, remove, delete — is gated on `isOwner`, which the server
 * decides; the UI only hides what the API would refuse anyway.
 */
export default function GroupInfoScreen({ route, navigation }: any) {
  const groupId: string = route.params?.groupId;
  const meId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const groupQ = useQuery<Group>({
    queryKey: ['chat-group', groupId],
    queryFn: () => api.get(`/chat/groups/${groupId}`) as any,
    enabled: !!groupId,
  });
  const group = groupQ.data;

  const contactsQ = useQuery<Contact[]>({
    queryKey: ['chat-contacts'],
    queryFn: () => api.get('/chat/contacts') as any,
    enabled: adding,
    staleTime: 60_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['chat-group', groupId] });
    queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
  };
  const syncSockets = (userIds: string[] = []) => {
    try { getSocket().emit('chat:group-sync', { conversationId: groupId, userIds }); } catch { /* offline */ }
  };

  const renameMutation = useMutation({
    mutationFn: () => api.patch(`/chat/groups/${groupId}`, { name: newName.trim() }) as any,
    onSuccess: () => { setRenaming(false); refresh(); syncSockets(); },
    onError: (e: any) => Alert.alert('Could not rename', e?.message ?? 'Try again'),
  });

  const addMutation = useMutation({
    mutationFn: (ids: string[]) => api.post(`/chat/groups/${groupId}/participants`, { memberIds: ids }) as any,
    onSuccess: (_r, ids) => { setAdding(false); setPicked({}); refresh(); syncSockets(ids); },
    onError: (e: any) => Alert.alert('Could not add', e?.message ?? 'Try again'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/chat/groups/${groupId}/participants/${userId}`) as any,
    onSuccess: (_r, userId) => { refresh(); syncSockets([userId]); },
    onError: (e: any) => Alert.alert('Could not remove', e?.message ?? 'Try again'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.post(`/chat/groups/${groupId}/leave`) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      navigation.popToTop();
    },
    onError: (e: any) => Alert.alert('Could not leave', e?.message ?? 'Try again'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/chat/groups/${groupId}`) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      navigation.popToTop();
    },
    onError: (e: any) => Alert.alert('Could not delete', e?.message ?? 'Try again'),
  });

  // Only people not already in the room can be added.
  const addable = useMemo(() => {
    const present = new Set((group?.participants ?? []).map((p) => p.id));
    return (Array.isArray(contactsQ.data) ? contactsQ.data : []).filter((c) => !present.has(c.id));
  }, [contactsQ.data, group?.participants]);

  function confirmRemove(p: Participant) {
    Alert.alert('Remove from group?', `${p.firstName} ${p.lastName} will no longer see this group.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(p.id) },
    ]);
  }

  function confirmLeave() {
    Alert.alert('Leave group?', 'You will stop receiving its messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Delete group?', 'This removes the group for everyone in it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  }

  if (groupQ.isLoading || !group) return <Loading fullScreen />;

  const chosen = Object.keys(picked).filter((id) => picked[id]);

  return (
    <Screen scroll>
      <Header
        title={group.name ?? 'Group'}
        subtitle={`${group.participantCount} ${group.participantCount === 1 ? 'person' : 'people'}`}
        onBack={() => navigation.goBack()}
        right={
          group.isOwner ? (
            <Button
              title="Rename"
              variant="secondary"
              icon="edit-2"
              onPress={() => { setNewName(group.name ?? ''); setRenaming(true); }}
            />
          ) : undefined
        }
      />

      {group.isOwner ? (
        <Button title="Add people" icon="plus" style={styles.addBtn} onPress={() => setAdding(true)} />
      ) : null}

      <SectionTitle title="People" />
      {group.participants.map((p) => (
        <Card key={p.id} padding="md">
          <View style={styles.row}>
            <Avatar uri={p.avatar} firstName={p.firstName} lastName={p.lastName} size={40} />
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {p.firstName} {p.lastName}{p.id === meId ? ' (you)' : ''}
              </Text>
              <Text style={styles.meta}>
                {ROLE_LABEL[p.role] ?? p.role}{p.groupRole === 'OWNER' ? ' · owner' : ''}
              </Text>
            </View>
            {group.isOwner && p.id !== meId ? (
              <Button title="Remove" variant="ghost" onPress={() => confirmRemove(p)} />
            ) : null}
          </View>
        </Card>
      ))}

      {group.isOwner ? (
        <Button title="Delete group" variant="danger" style={styles.dangerBtn} onPress={confirmDelete} loading={deleteMutation.isPending} />
      ) : (
        <Button title="Leave group" variant="danger" style={styles.dangerBtn} onPress={confirmLeave} loading={leaveMutation.isPending} />
      )}

      {/* ── Rename ── */}
      <Modal visible={renaming} animationType="slide" transparent onRequestClose={() => setRenaming(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Rename group</Text>
            <Field label="Group name" style={styles.field}>
              <TextField value={newName} onChangeText={setNewName} placeholder="Morning batch" maxLength={80} />
            </Field>
            <View style={styles.btnRow}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setRenaming(false)} />
              <Button
                title="Save"
                style={{ flex: 2 }}
                onPress={() => (newName.trim() ? renameMutation.mutate() : Alert.alert('Name required'))}
                loading={renameMutation.isPending}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add people ── */}
      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Add people</Text>
            <Text style={styles.sheetSub}>
              {chosen.length === 0 ? 'Nobody selected' : `${chosen.length} selected`}
            </Text>
            {contactsQ.isLoading ? (
              <Loading />
            ) : (
              <FlatList
                data={addable}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 340 }}
                contentContainerStyle={{ gap: spacing.sm }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<EmptyState icon="users" title="Everyone is already in" subtitle="No one left to add." />}
                renderItem={({ item }) => (
                  <PressScale
                    style={[styles.pickRow, picked[item.id] && styles.pickRowOn]}
                    scaleTo={0.98}
                    onPress={() => setPicked((s) => ({ ...s, [item.id]: !s[item.id] }))}
                  >
                    <Checkbox checked={!!picked[item.id]} />
                    <Avatar uri={item.avatar} firstName={item.firstName} lastName={item.lastName} size={36} />
                    <View style={styles.body}>
                      <Text style={styles.name} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
                      <Text style={styles.meta}>{ROLE_LABEL[item.role] ?? item.role}</Text>
                    </View>
                  </PressScale>
                )}
              />
            )}
            <View style={styles.btnRow}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => { setAdding(false); setPicked({}); }} />
              <Button
                title={`Add${chosen.length ? ` ${chosen.length}` : ''}`}
                style={{ flex: 2 }}
                onPress={() => (chosen.length ? addMutation.mutate(chosen) : Alert.alert('Nobody selected'))}
                loading={addMutation.isPending}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: { marginBottom: spacing.md },
  dangerBtn: { marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.h2 },
  meta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },

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
  field: { marginBottom: spacing.md },
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
