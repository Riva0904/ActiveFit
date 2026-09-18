import React, { useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Avatar, Button, Card, Checkbox, EmptyState, Enter, Field, Header,
  Icon, Loading, PressScale, Screen, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface Supplement {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  stock: number;
  isActive: boolean;
  isPrivate: boolean;
}

interface Assignee {
  id: string;         // user id
  memberId: string;
  memberCode?: string | null;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  notes?: string | null;
}

const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const EMPTY = { name: '', category: '', brand: '', description: '', price: '', discountPrice: '', stock: '0', isActive: true, isPrivate: false };

/**
 * The gym's supplement catalogue, and who each private item is for.
 *
 * A private supplement is hidden from the gym-wide store and shown only to the
 * members it was assigned to — the server applies that rule to the list, to a
 * direct id fetch and to checkout, so this screen is convenience, not the guard.
 */
export default function AdminSupplementsScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const scope = useGymScope();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [assigningTo, setAssigningTo] = useState<Supplement | null>(null);
  const [memberSearch, setMemberSearch] = useState('');

  const listQ = useQuery({
    queryKey: scope.key(['admin-supplements']),
    queryFn: () => api.get('/supplements', { params: { limit: 100, ...scope.params() } }) as any,
    staleTime: 30_000,
  });

  const assigneesQ = useQuery<Assignee[]>({
    queryKey: ['supplement-assignees', assigningTo?.id],
    queryFn: () => api.get(`/supplements/${assigningTo!.id}/assignees`) as any,
    enabled: !!assigningTo,
  });

  const membersQ = useQuery({
    queryKey: scope.key(['admin-people', 'MEMBER', memberSearch.trim()]),
    queryFn: () =>
      api.get('/users', {
        params: { role: 'MEMBER', limit: 50, ...(memberSearch.trim() ? { search: memberSearch.trim() } : {}), ...scope.params() },
      }) as any,
    enabled: !!assigningTo,
    staleTime: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: scope.key(['admin-supplements']) });
  const refreshAssignees = () => queryClient.invalidateQueries({ queryKey: ['supplement-assignees', assigningTo?.id] });

  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      (editing ? api.patch(`/supplements/${editing.id}`, body) : api.post('/supplements', body)) as any,
    onSuccess: () => { setShowForm(false); setEditing(null); refresh(); },
    onError: (e: any) => Alert.alert('Could not save', e?.message ?? 'Try again'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/supplements/${id}`) as any,
    onSuccess: refresh,
    onError: (e: any) => Alert.alert('Could not delete', e?.message ?? 'Try again'),
  });

  const assignMutation = useMutation({
    mutationFn: (memberId: string) => api.post(`/supplements/${assigningTo!.id}/assign`, { memberId }) as any,
    onSuccess: refreshAssignees,
    onError: (e: any) => Alert.alert('Could not assign', e?.message ?? 'Try again'),
  });

  const unassignMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/supplements/${assigningTo!.id}/assign/${memberId}`) as any,
    onSuccess: refreshAssignees,
    onError: (e: any) => Alert.alert('Could not remove', e?.message ?? 'Try again'),
  });

  function openNew() {
    setEditing(null);
    setDraft({ ...EMPTY });
    setShowForm(true);
  }

  function openEdit(s: Supplement) {
    setEditing(s);
    setDraft({
      name: s.name,
      category: s.category ?? '',
      brand: s.brand ?? '',
      description: s.description ?? '',
      price: String(s.price ?? 0),
      discountPrice: s.discountPrice != null ? String(s.discountPrice) : '',
      stock: String(s.stock ?? 0),
      isActive: s.isActive,
      isPrivate: s.isPrivate ?? false,
    });
    setShowForm(true);
  }

  function save() {
    const price = Number(draft.price);
    const stock = Number(draft.stock);
    const discountPrice = draft.discountPrice.trim() ? Number(draft.discountPrice) : null;

    if (!draft.name.trim()) return Alert.alert('Name required', 'Give the supplement a name.');
    if (!draft.category.trim()) return Alert.alert('Category required', 'e.g. Protein, Vitamins.');
    if (!Number.isFinite(price) || price < 0) return Alert.alert('Check the price', 'Price must be zero or more.');
    if (!Number.isInteger(stock) || stock < 0) return Alert.alert('Check the stock', 'Stock must be zero or more.');
    if (discountPrice !== null && (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice > price)) {
      return Alert.alert('Check the discount price', 'It must be between zero and the full price.');
    }

    saveMutation.mutate({
      name: draft.name.trim(),
      category: draft.category.trim(),
      brand: draft.brand.trim() || null,
      description: draft.description.trim() || null,
      price,
      discountPrice,
      // Stock is set directly on create; on edit it is a plain field too
      // (`PATCH /supplements/:id/stock` applies a *delta*, which is a different job).
      stock,
      isActive: draft.isActive,
      isPrivate: draft.isPrivate,
    });
  }

  function confirmDelete(s: Supplement) {
    Alert.alert('Delete supplement?', `"${s.name}" will be removed from the store.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(s.id) },
    ]);
  }

  const raw: any = listQ.data;
  const supplements: Supplement[] = Array.isArray(raw) ? raw : raw?.data ?? [];

  const assignees = Array.isArray(assigneesQ.data) ? assigneesQ.data : [];
  const assignedUserIds = new Set(assignees.map((a) => a.id));
  const memberRaw: any = membersQ.data;
  const members: any[] = Array.isArray(memberRaw) ? memberRaw : memberRaw?.data ?? [];

  if (listQ.isLoading) return <Loading fullScreen />;

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={listQ.isRefetching} onRefresh={listQ.refetch} tintColor={colors.primary} />}
    >
      <Header
        title="Supplements"
        subtitle="Your store, and who sees what"
        onBack={() => navigation.goBack()}
        right={<Button title="New" icon="plus" onPress={openNew} />}
      />

      {supplements.length === 0 ? (
        <EmptyState
          icon="pill"
          title="No supplements yet"
          subtitle="Add your first product so members can buy it."
          action={{ label: 'Add a supplement', onPress: openNew }}
        />
      ) : (
        supplements.map((s, i) => (
          <Enter key={s.id} index={i}>
            <Card onPress={() => openEdit(s)}>
              <View style={styles.top}>
                <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                {s.isPrivate ? (
                  <View style={styles.privateChip}>
                    <Icon name="lock" size={11} color={colors.purple} />
                    <Text style={styles.privateText}>Private</Text>
                  </View>
                ) : null}
                {!s.isActive ? (
                  <View style={styles.offChip}><Text style={styles.offText}>Hidden</Text></View>
                ) : null}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.price}>{money(s.discountPrice ?? s.price)}</Text>
                {s.discountPrice != null ? <Text style={styles.strike}>{money(s.price)}</Text> : null}
                <Text style={styles.meta}>{s.category}{s.brand ? ` · ${s.brand}` : ''}</Text>
              </View>
              <Text style={[styles.meta, s.stock === 0 && { color: colors.danger }]}>
                {s.stock === 0 ? 'Out of stock' : `${s.stock} in stock`}
              </Text>

              <View style={styles.actions}>
                <Button title="Edit" variant="secondary" style={{ flex: 1 }} onPress={() => openEdit(s)} />
                <Button
                  title={s.isPrivate ? 'Who sees it' : 'Recommend'}
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => { setAssigningTo(s); setMemberSearch(''); }}
                />
                <Button title="Delete" variant="ghost" onPress={() => confirmDelete(s)} />
              </View>
            </Card>
          </Enter>
        ))
      )}

      {/* ── Create / edit ── */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{editing ? 'Edit supplement' : 'New supplement'}</Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }}>
              <Field label="Name" style={styles.field}>
                <TextField value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} placeholder="Whey Protein" />
              </Field>
              <Field label="Category" style={styles.field}>
                <TextField value={draft.category} onChangeText={(category) => setDraft((d) => ({ ...d, category }))} placeholder="Protein" />
              </Field>
              <Field label="Brand" style={styles.field}>
                <TextField value={draft.brand} onChangeText={(brand) => setDraft((d) => ({ ...d, brand }))} placeholder="Optional" />
              </Field>
              <Field label="Price (₹)" style={styles.field}>
                <TextField value={draft.price} onChangeText={(price) => setDraft((d) => ({ ...d, price }))} keyboardType="number-pad" />
              </Field>
              <Field label="Discounted price (₹)" style={styles.field}>
                <TextField
                  value={draft.discountPrice}
                  onChangeText={(discountPrice) => setDraft((d) => ({ ...d, discountPrice }))}
                  keyboardType="number-pad"
                  placeholder="Leave blank for none"
                />
              </Field>
              <Field label="Stock" style={styles.field}>
                <TextField value={draft.stock} onChangeText={(stock) => setDraft((d) => ({ ...d, stock }))} keyboardType="number-pad" />
              </Field>
              <Field label="Description" style={styles.field}>
                <TextField
                  value={draft.description}
                  onChangeText={(description) => setDraft((d) => ({ ...d, description }))}
                  multiline
                  placeholder="Optional"
                />
              </Field>

              <PressScale style={styles.toggleRow} onPress={() => setDraft((d) => ({ ...d, isActive: !d.isActive }))}>
                <Checkbox checked={draft.isActive} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>In the store</Text>
                  <Text style={styles.hint}>Turn off to hide it without deleting it.</Text>
                </View>
              </PressScale>

              <PressScale style={styles.toggleRow} onPress={() => setDraft((d) => ({ ...d, isPrivate: !d.isPrivate }))}>
                <Checkbox checked={draft.isPrivate} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Only for specific members</Text>
                  <Text style={styles.hint}>
                    Hidden from everyone else's store. Pick the members with "Who sees it" after saving.
                  </Text>
                </View>
              </PressScale>
            </ScrollView>

            <View style={styles.btnRow}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setShowForm(false)} />
              <Button title={editing ? 'Save' : 'Create'} style={{ flex: 2 }} onPress={save} loading={saveMutation.isPending} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Who sees it ── */}
      <Modal visible={!!assigningTo} animationType="slide" transparent onRequestClose={() => setAssigningTo(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{assigningTo?.name}</Text>
            <Text style={styles.sheetSub}>
              {assigningTo?.isPrivate
                ? `Only these ${assignees.length} ${assignees.length === 1 ? 'member sees' : 'members see'} it.`
                : 'This item is in the public store. Recommending it also puts it on the member\'s "for you" shelf.'}
            </Text>

            <TextField
              value={memberSearch}
              onChangeText={setMemberSearch}
              placeholder="Search members"
              style={{ marginBottom: spacing.md }}
            />

            {membersQ.isLoading || assigneesQ.isLoading ? (
              <Loading />
            ) : (
              <FlatList
                data={members}
                keyExtractor={(m) => m.id}
                style={{ maxHeight: 340 }}
                contentContainerStyle={{ gap: spacing.sm }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <EmptyState
                    icon="users"
                    title={memberSearch ? 'No matches' : 'No members yet'}
                    subtitle={memberSearch ? 'Try a different name' : 'Add members before recommending anything.'}
                  />
                }
                renderItem={({ item }) => {
                  const on = assignedUserIds.has(item.id);
                  const busy = assignMutation.isPending || unassignMutation.isPending;
                  return (
                    <PressScale
                      style={[styles.pickRow, on && styles.pickRowOn]}
                      scaleTo={0.98}
                      onPress={() => (busy ? undefined : on ? unassignMutation.mutate(item.id) : assignMutation.mutate(item.id))}
                    >
                      <Checkbox checked={on} />
                      <Avatar uri={item.avatar} firstName={item.firstName} lastName={item.lastName} size={36} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.name} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
                        {item.member?.memberCode ? <Text style={styles.meta}>{item.member.memberCode}</Text> : null}
                      </View>
                    </PressScale>
                  );
                }}
              />
            )}

            <Button title="Done" style={{ marginTop: spacing.lg }} onPress={() => { setAssigningTo(null); refresh(); }} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  name: { color: colors.text, ...typography.h2, flex: 1 },
  privateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: tint(colors.purple, '1F'), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2,
  },
  privateText: { color: colors.purple, ...typography.micro, fontWeight: '800' },
  offChip: { backgroundColor: tint(colors.warning, '1F'), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  offText: { color: colors.warning, ...typography.micro, fontWeight: '800' },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  price: { color: colors.text, ...typography.title, ...typography.number },
  strike: { color: colors.textMuted, ...typography.caption, textDecorationLine: 'line-through' },
  meta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  field: { marginBottom: spacing.md },
  hint: { color: colors.textMuted, ...typography.caption },
  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.md },
  toggleLabel: { color: colors.text, ...typography.body, fontWeight: '700', marginBottom: 2 },

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
  btnRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
