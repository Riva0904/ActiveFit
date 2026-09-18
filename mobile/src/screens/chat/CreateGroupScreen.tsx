import React, { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/Text';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Avatar, Button, Checkbox, EmptyState, Field, Header, Loading, PressScale, Screen, TextField } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface Contact {
  id: string; firstName: string; lastName: string; role: string;
  avatar?: string | null; memberCode?: string | null;
}

const ORDER = ['GYM_ADMIN', 'TRAINER', 'STAFF', 'MEMBER'];
const GROUP_LABEL: Record<string, string> = {
  GYM_ADMIN: 'Gym admin', TRAINER: 'Trainers', STAFF: 'Front desk', MEMBER: 'Members',
};

/**
 * Gym admin only — creating a group is the one chat action that is not open to
 * everyone. Once it exists, every person in it can post.
 */
export default function CreateGroupScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const contactsQ = useQuery<Contact[]>({
    queryKey: ['chat-contacts', search.trim()],
    queryFn: () => api.get('/chat/contacts', { params: search.trim() ? { search: search.trim() } : undefined }) as any,
    staleTime: 60_000,
  });

  const rows = useMemo(() => {
    const all = Array.isArray(contactsQ.data) ? contactsQ.data : [];
    const out: ({ type: 'header'; key: string; label: string } | { type: 'person'; key: string; person: Contact })[] = [];
    for (const group of ORDER) {
      const people = all.filter((c) => c.role === group);
      if (people.length === 0) continue;
      out.push({ type: 'header', key: `h-${group}`, label: GROUP_LABEL[group] ?? group });
      people.forEach((p) => out.push({ type: 'person', key: p.id, person: p }));
    }
    return out;
  }, [contactsQ.data]);

  const chosen = Object.keys(selected).filter((id) => selected[id]);

  const createMutation = useMutation({
    mutationFn: () => api.post('/chat/groups', { name: name.trim(), memberIds: chosen }) as any,
    onSuccess: (group: any) => {
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      // Tell the server to put everyone's socket in the new room now, rather
      // than at their next reconnect.
      try {
        getSocket().emit('chat:group-sync', { conversationId: group.id, userIds: chosen });
      } catch { /* offline: the room is joined on next connect */ }
      navigation.replace('GroupChat', { groupId: group.id, group });
    },
    onError: (e: any) => Alert.alert('Could not create group', e?.message ?? 'Try again'),
  });

  function create() {
    if (!name.trim()) return Alert.alert('Name required', 'Give the group a name.');
    if (chosen.length === 0) return Alert.alert('Nobody selected', 'Pick at least one person to add.');
    createMutation.mutate();
  }

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="New group"
          subtitle="Everyone you add can post in it"
          onBack={() => navigation.goBack()}
        />
        <Field label="Group name" style={styles.field}>
          <TextField value={name} onChangeText={setName} placeholder="Morning batch" maxLength={80} />
        </Field>
        <TextField value={search} onChangeText={setSearch} placeholder="Search people" />
        <Text style={styles.count}>
          {chosen.length === 0 ? 'Nobody selected yet' : `${chosen.length} selected`}
        </Text>
      </View>

      {contactsQ.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={search ? 'No matches' : 'Nobody to add yet'}
              subtitle={search ? 'Try a different name' : 'Your gym has not added anyone else.'}
            />
          }
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <Text style={styles.group}>{item.label}</Text>
            ) : (
              <PressScale
                style={[styles.row, selected[item.person.id] && styles.rowOn]}
                scaleTo={0.98}
                onPress={() => setSelected((s) => ({ ...s, [item.person.id]: !s[item.person.id] }))}
              >
                <Checkbox checked={!!selected[item.person.id]} />
                <Avatar uri={item.person.avatar} firstName={item.person.firstName} lastName={item.person.lastName} size={40} />
                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.person.firstName} {item.person.lastName}
                  </Text>
                  {item.person.memberCode ? <Text style={styles.meta}>{item.person.memberCode}</Text> : null}
                </View>
                <View style={styles.roleChip}>
                  <Text style={styles.roleText}>{GROUP_LABEL[item.person.role] ?? item.person.role}</Text>
                </View>
              </PressScale>
            )
          }
        />
      )}

      <View style={styles.footer}>
        <Button
          title={chosen.length > 0 ? `Create group · ${chosen.length}` : 'Create group'}
          size="lg"
          icon="check"
          onPress={create}
          loading={createMutation.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  field: { marginBottom: spacing.md },
  count: { color: colors.textMuted, ...typography.caption, marginTop: spacing.sm },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  group: {
    color: colors.textMuted, ...typography.micro, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  rowOn: { borderColor: colors.primary, backgroundColor: tint(colors.primary, '12') },
  body: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.h2 },
  meta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  roleChip: { backgroundColor: tint(colors.primary, '18'), borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  roleText: { color: colors.primary, ...typography.micro, fontWeight: '700' },
  footer: { padding: spacing.screen, borderTopWidth: 1, borderTopColor: colors.surface },
});
