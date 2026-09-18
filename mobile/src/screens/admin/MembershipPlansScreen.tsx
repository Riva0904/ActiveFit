import React, { useState } from 'react';
import { Alert, Modal, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Button, Card, Checkbox, Chip, ChipRow, EmptyState, Enter, Field, Header,
  Icon, Loading, PressScale, Screen, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface MembershipPlan {
  id: string;
  name: string;
  type: string;
  durationMonths: number;
  price: number;
  discount: number;
  features: string[];
  isActive: boolean;
}

const TYPES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM'];
const MONTHS_FOR: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;

const EMPTY = { name: '', type: 'MONTHLY', durationMonths: '1', price: '', discount: '0', features: [] as string[], isActive: true };

/**
 * The plans a gym sells its members. The endpoints have existed since the web
 * dashboard shipped (`/memberships/plans`); the app could only read them via the
 * member renewal screen, so an admin had to open a laptop to change a price.
 */
export default function MembershipPlansScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const scope = useGymScope();

  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [newFeature, setNewFeature] = useState('');

  const plansQ = useQuery<MembershipPlan[]>({
    queryKey: scope.key(['membership-plans']),
    queryFn: () => api.get('/memberships/plans', { params: scope.params() }) as any,
    staleTime: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: scope.key(['membership-plans']) });

  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      (editing
        ? api.patch(`/memberships/plans/${editing.id}`, body)
        : api.post('/memberships/plans', body)) as any,
    onSuccess: () => { closeForm(); refresh(); },
    onError: (e: any) => Alert.alert('Could not save plan', e?.message ?? 'Try again'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/memberships/plans/${id}`) as any,
    onSuccess: refresh,
    onError: (e: any) => Alert.alert('Could not delete', e?.message ?? 'Try again'),
  });

  function openNew() {
    setEditing(null);
    setDraft({ ...EMPTY });
    setNewFeature('');
    setShowForm(true);
  }

  function openEdit(plan: MembershipPlan) {
    setEditing(plan);
    setDraft({
      name: plan.name,
      type: plan.type ?? 'MONTHLY',
      durationMonths: String(plan.durationMonths ?? 1),
      price: String(plan.price ?? 0),
      discount: String(plan.discount ?? 0),
      features: plan.features ?? [],
      isActive: plan.isActive,
    });
    setNewFeature('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  /** Picking a named term sets its months; CUSTOM leaves the field to the admin. */
  function pickType(type: string) {
    setDraft((d) => ({
      ...d,
      type,
      durationMonths: MONTHS_FOR[type] ? String(MONTHS_FOR[type]) : d.durationMonths,
    }));
  }

  function addFeature() {
    const f = newFeature.trim();
    if (!f || draft.features.includes(f)) return setNewFeature('');
    setDraft((d) => ({ ...d, features: [...d.features, f] }));
    setNewFeature('');
  }

  function save() {
    const price = Number(draft.price);
    const discount = Number(draft.discount || 0);
    const durationMonths = Number(draft.durationMonths);

    if (!draft.name.trim()) return Alert.alert('Name required', 'Give the plan a name.');
    if (!Number.isFinite(price) || price < 0) return Alert.alert('Check the price', 'Price must be zero or more.');
    if (!Number.isFinite(discount) || discount < 0) return Alert.alert('Check the discount', 'Discount must be zero or more.');
    if (discount > price) return Alert.alert('Check the discount', 'Discount cannot exceed the price.');
    if (!Number.isInteger(durationMonths) || durationMonths < 1) {
      return Alert.alert('Check the duration', 'Duration must be at least one month.');
    }

    saveMutation.mutate({
      name: draft.name.trim(),
      // `type` is only writable on create; the update DTO does not accept it.
      ...(editing ? {} : { type: draft.type }),
      durationMonths,
      price,
      discount,
      features: draft.features,
      isActive: draft.isActive,
    });
  }

  function confirmDelete(plan: MembershipPlan) {
    Alert.alert('Delete plan?', `"${plan.name}" will stop being offered. Members already on it keep it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(plan.id) },
    ]);
  }

  const raw: any = plansQ.data;
  const plans: MembershipPlan[] = Array.isArray(raw) ? raw : raw?.data ?? [];

  if (plansQ.isLoading) return <Loading fullScreen />;

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={plansQ.isRefetching} onRefresh={plansQ.refetch} tintColor={colors.primary} />}
    >
      <Header
        title="Membership plans"
        subtitle="What your members can buy"
        onBack={() => navigation.goBack()}
        right={<Button title="New" icon="plus" onPress={openNew} />}
      />

      {plans.length === 0 ? (
        <EmptyState
          icon="credit-card"
          title="No plans yet"
          subtitle="Create a plan so members have something to sign up for."
          action={{ label: 'Create a plan', onPress: openNew }}
        />
      ) : (
        plans.map((p, i) => {
          const payable = Math.max(0, (p.price ?? 0) - (p.discount ?? 0));
          return (
            <Enter key={p.id} index={i}>
              <Card onPress={() => openEdit(p)}>
                <View style={styles.top}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  {!p.isActive ? (
                    <View style={styles.offChip}><Text style={styles.offText}>Hidden</Text></View>
                  ) : null}
                  <Icon name="chevron-right" size={18} color={colors.textMuted} />
                </View>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>{money(payable)}</Text>
                  {p.discount > 0 ? <Text style={styles.strike}>{money(p.price)}</Text> : null}
                  <Text style={styles.term}>
                    for {p.durationMonths} {p.durationMonths === 1 ? 'month' : 'months'}
                  </Text>
                </View>

                {p.features?.length ? (
                  <Text style={styles.features} numberOfLines={2}>{p.features.join(' · ')}</Text>
                ) : null}

                <View style={styles.actions}>
                  <Button title="Edit" variant="secondary" style={{ flex: 1 }} onPress={() => openEdit(p)} />
                  <Button title="Delete" variant="ghost" style={{ flex: 1 }} onPress={() => confirmDelete(p)} />
                </View>
              </Card>
            </Enter>
          );
        })
      )}

      {/* ── Create / edit ── */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={closeForm}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{editing ? 'Edit plan' : 'New plan'}</Text>
            <Text style={styles.sheetSub}>
              {editing ? 'Changes apply to new sign-ups; current members keep their terms.' : 'Members see this on the renewal screen.'}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }}>
              <Field label="Plan name" style={styles.field}>
                <TextField
                  value={draft.name}
                  onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
                  placeholder="Monthly Basic"
                  maxLength={60}
                />
              </Field>

              {!editing ? (
                <Field label="Term" style={styles.field}>
                  <ChipRow>
                    {TYPES.map((t) => (
                      <Chip
                        key={t}
                        label={t.replace(/_/g, ' ').toLowerCase()}
                        selected={draft.type === t}
                        onPress={() => pickType(t)}
                      />
                    ))}
                  </ChipRow>
                </Field>
              ) : null}

              <Field label="Duration (months)" style={styles.field}>
                <TextField
                  value={draft.durationMonths}
                  onChangeText={(durationMonths) => setDraft((d) => ({ ...d, durationMonths }))}
                  keyboardType="number-pad"
                />
              </Field>
              <Field label="Price (₹)" style={styles.field}>
                <TextField
                  value={draft.price}
                  onChangeText={(price) => setDraft((d) => ({ ...d, price }))}
                  keyboardType="number-pad"
                  placeholder="0"
                />
              </Field>
              <Field label="Discount (₹)" style={styles.field}>
                <TextField
                  value={draft.discount}
                  onChangeText={(discount) => setDraft((d) => ({ ...d, discount }))}
                  keyboardType="number-pad"
                  placeholder="0"
                />
              </Field>

              <Field label="What's included" style={styles.field}>
                {draft.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={styles.featureText} numberOfLines={2}>{f}</Text>
                    <PressScale
                      style={styles.removeBtn}
                      onPress={() => setDraft((d) => ({ ...d, features: d.features.filter((x) => x !== f) }))}
                    >
                      <Icon name="x" size={14} color={colors.danger} />
                    </PressScale>
                  </View>
                ))}
                <View style={styles.addRow}>
                  <TextField
                    value={newFeature}
                    onChangeText={setNewFeature}
                    placeholder="Add an inclusion"
                    style={{ flex: 1 }}
                    onSubmitEditing={addFeature}
                    returnKeyType="done"
                  />
                  <Button title="Add" variant="secondary" onPress={addFeature} />
                </View>
              </Field>

              <PressScale style={styles.toggleRow} onPress={() => setDraft((d) => ({ ...d, isActive: !d.isActive }))}>
                <Checkbox checked={draft.isActive} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Offered to members</Text>
                  <Text style={styles.hint}>Turn off to hide it without deleting it.</Text>
                </View>
              </PressScale>
            </ScrollView>

            <View style={styles.btnRow}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={closeForm} />
              <Button title={editing ? 'Save' : 'Create'} style={{ flex: 2 }} onPress={save} loading={saveMutation.isPending} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  name: { color: colors.text, ...typography.h2, flex: 1 },
  offChip: { backgroundColor: tint(colors.warning, '1F'), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  offText: { color: colors.warning, ...typography.micro, fontWeight: '800' },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  price: { color: colors.text, ...typography.title, ...typography.number },
  strike: { color: colors.textMuted, ...typography.caption, textDecorationLine: 'line-through' },
  term: { color: colors.textMuted, ...typography.caption },
  features: { color: colors.textMuted, ...typography.caption, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },

  field: { marginBottom: spacing.md },
  hint: { color: colors.textMuted, ...typography.caption },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  featureText: { color: colors.text, ...typography.caption, flex: 1 },
  removeBtn: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },

  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.md },
  toggleLabel: { color: colors.text, ...typography.body, fontWeight: '700', marginBottom: 2 },

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
