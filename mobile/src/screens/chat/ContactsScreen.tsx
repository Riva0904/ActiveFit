import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text } from '../../components/Text';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Avatar, EmptyState, Header, Loading, PressScale, Screen, TextField } from '../../components';
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
 * Who the signed-in person may message. The list comes from the server, which
 * applies the rule (a member reaches trainers, front desk and the admin, never
 * another member) — the UI only renders what it is given.
 */
export default function ContactsScreen({ navigation }: any) {
  const role = useAuthStore((s) => s.user?.role);
  const [search, setSearch] = useState('');

  const contactsQ = useQuery<Contact[]>({
    queryKey: ['chat-contacts'],
    queryFn: () => api.get('/chat/contacts') as any,
    staleTime: 5 * 60_000,
  });

  const sections = useMemo(() => {
    const all = Array.isArray(contactsQ.data) ? contactsQ.data : [];
    const q = search.trim().toLowerCase();
    const matched = q
      ? all.filter((c) => `${c.firstName} ${c.lastName} ${c.memberCode ?? ''}`.toLowerCase().includes(q))
      : all;

    // One flat list with group headers: a SectionList would add a second
    // scrolling contract for no gain at this size.
    const rows: ({ type: 'header'; key: string; label: string } | { type: 'person'; key: string; person: Contact })[] = [];
    for (const group of ORDER) {
      const people = matched.filter((c) => c.role === group);
      if (people.length === 0) continue;
      rows.push({ type: 'header', key: `h-${group}`, label: GROUP_LABEL[group] ?? group });
      people.forEach((p) => rows.push({ type: 'person', key: p.id, person: p }));
    }
    return rows;
  }, [contactsQ.data, search]);

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="New message"
          subtitle={role === 'MEMBER' ? 'Your trainers, the front desk and your gym admin' : 'Anyone at your gym'}
          onBack={() => navigation.goBack()}
        />
        <TextField value={search} onChangeText={setSearch} placeholder="Search people" />
      </View>

      {contactsQ.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title={search ? 'No matches' : 'Nobody to message yet'}
              subtitle={search ? 'Try a different name' : 'Your gym has not added anyone you can message.'}
            />
          }
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <Text style={styles.group}>{item.label}</Text>
            ) : (
              <PressScale
                style={styles.row}
                scaleTo={0.98}
                onPress={() => navigation.replace('DirectChat', { peer: item.person })}
              >
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
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
  body: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.h2 },
  meta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  roleChip: { backgroundColor: tint(colors.primary, '18'), borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  roleText: { color: colors.primary, ...typography.micro, fontWeight: '700' },
});
