import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Avatar, Button, Card, Chip, ChipRow, EmptyState, Field, Header, Icon, Loading, PressScale, Screen, SectionTitle, StatRow, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface Payout {
  id: string; amount: number; periodLabel: string; status: 'PENDING' | 'PAID';
  notes?: string; paidAt?: string; createdAt: string;
  user?: { firstName: string; lastName: string; role: string; payoutUpiVpa?: string | null };
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
];

export default function PayrollScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [showPay, setShowPay] = useState(false);

  const scope = useGymScope();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: scope.key(['payouts', status]),
    queryFn: () => api.get('/salary-payouts', { params: scope.params({ limit: 100, ...(status ? { status } : {}) }) }) as any,
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => api.patch(`/salary-payouts/${id}/mark-paid`) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payouts'] }),
    onError: (e: any) => Alert.alert('Could not update', e?.message ?? 'Try again'),
  });

  const payouts: Payout[] = Array.isArray(data) ? data : (data?.data ?? []);

  const totals = useMemo(() => {
    const pending = payouts.filter((p) => p.status === 'PENDING');
    return {
      pending: pending.length,
      pendingAmount: pending.reduce((s, p) => s + p.amount, 0),
      paidAmount: payouts.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0),
    };
  }, [payouts]);

  const locked = (error as any)?.statusCode === 403;
  if (locked) {
    return (
      <Screen scroll>
        <Header title="Payroll" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="lock"
          title="Not on your plan"
          subtitle="Payroll is included from the Professional plan upward."
          action={{ label: 'See plans', onPress: () => navigation.navigate('Subscription') }}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="Payroll"
          subtitle="You transfer the money, this keeps the record"
          onBack={() => navigation.goBack()}
          right={<PressScale onPress={() => setShowPay(true)} style={styles.addBtn}><Icon name="plus" size={20} color={colors.white} /></PressScale>}
        />

        <Card padding="md">
          <StatRow items={[
            { label: 'Pending', value: totals.pending, color: totals.pending > 0 ? colors.warning : undefined },
            { label: 'To pay', value: money(totals.pendingAmount) },
            { label: 'Paid', value: money(totals.paidAmount), color: colors.success },
          ]} />
        </Card>

        <View style={styles.filters}>
          <ChipRow>
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={status === f.value} onPress={() => setStatus(f.value)} />
            ))}
          </ChipRow>
        </View>

        <SectionTitle title="Payout history" />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={payouts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="cash-multiple"
              title="No payouts yet"
              subtitle="Record a salary payment to start building history."
              action={{ label: 'Pay salary', onPress: () => setShowPay(true) }}
            />
          }
          renderItem={({ item }) => {
            const paid = item.status === 'PAID';
            return (
              <View style={styles.row}>
                <Avatar firstName={item.user?.firstName} lastName={item.user?.lastName} size={40} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.user?.firstName} {item.user?.lastName}</Text>
                  <Text style={styles.rowMeta}>{item.periodLabel} · {item.user?.role === 'TRAINER' ? 'Trainer' : 'Staff'}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowAmount}>{money(item.amount)}</Text>
                  {paid ? (
                    <View style={[styles.pill, { backgroundColor: tint(colors.success, '22') }]}>
                      <Text style={[styles.pillText, { color: colors.success }]}>Paid</Text>
                    </View>
                  ) : (
                    <PressScale
                      style={styles.markBtn}
                      onPress={() =>
                        Alert.alert('Mark as paid?', `Confirm you have transferred ${money(item.amount)} to ${item.user?.firstName}.`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Mark paid', onPress: () => markPaid.mutate(item.id) },
                        ])
                      }
                    >
                      <Icon name="check" size={13} color={colors.white} />
                      <Text style={styles.markText}>Mark paid</Text>
                    </PressScale>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      <PayModal
        visible={showPay}
        onClose={() => setShowPay(false)}
        onSaved={() => { setShowPay(false); queryClient.invalidateQueries({ queryKey: ['payouts'] }); }}
      />
    </Screen>
  );
}

function PayModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [periodLabel, setPeriodLabel] = useState(() => new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
  const [notes, setNotes] = useState('');
  // Amount per person, keyed by user id. A row is in the run when it has an
  // amount — that is what "edit each amount separately" means here: one run,
  // one submit, but every figure is typed on its own line.
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const scope = useGymScope();
  const { data: trainers } = useQuery({
    queryKey: scope.key(['payable', 'TRAINER']),
    queryFn: () => api.get('/users', { params: scope.params({ role: 'TRAINER', limit: 100 }) }) as any,
    enabled: visible,
  });
  const { data: staff } = useQuery({
    queryKey: scope.key(['payable', 'STAFF']),
    queryFn: () => api.get('/users', { params: scope.params({ role: 'STAFF', limit: 100 }) }) as any,
    enabled: visible,
  });

  const people: any[] = [
    ...(Array.isArray(trainers) ? trainers : trainers?.data ?? []),
    ...(Array.isArray(staff) ? staff : staff?.data ?? []),
  ];

  const items = useMemo(
    () =>
      Object.entries(amounts)
        .map(([userId, raw]) => ({ userId, amount: Number(raw) }))
        .filter((i) => i.amount > 0),
    [amounts],
  );
  const runTotal = items.reduce((sum, i) => sum + i.amount, 0);

  const save = useMutation({
    mutationFn: () =>
      api.post('/salary-payouts/batch', {
        periodLabel: periodLabel.trim(),
        notes: notes.trim() || undefined,
        items,
      }) as any,
    onSuccess: (res: any) => {
      setAmounts({});
      setNotes('');
      Alert.alert('Payroll run created', `${res?.created ?? items.length} payouts totalling ${money(res?.total ?? runTotal)}.`);
      onSaved();
    },
    onError: (e: any) => Alert.alert('Could not create the run', e?.message ?? 'Try again'),
  });

  const setAmount = (userId: string, value: string) =>
    setAmounts((prev) => ({ ...prev, [userId]: value.replace(/[^0-9.]/g, '') }));

  const submit = () => {
    if (!periodLabel.trim()) return Alert.alert('Name the pay period');
    if (items.length === 0) return Alert.alert('Enter an amount for at least one person');
    save.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Pay salaries</Text>

          <Field label="Pay period">
            <TextField value={periodLabel} onChangeText={setPeriodLabel} placeholder="e.g. October 2026" />
          </Field>

          <Text style={styles.runHint}>Type an amount next to everyone you are paying. Leave a row blank to skip it.</Text>

          <FlatList
            data={people}
            keyExtractor={(p: any) => p.id}
            style={styles.runList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.rowMeta}>No trainers or staff yet</Text>}
            renderItem={({ item }: any) => {
              const value = amounts[item.id] ?? '';
              const active = Number(value) > 0;
              return (
                <View style={[styles.runRow, active && styles.runRowActive]}>
                  <Avatar firstName={item.firstName} lastName={item.lastName} size={34} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
                    <Text style={styles.rowMeta}>{item.role === 'TRAINER' ? 'Trainer' : 'Staff'}</Text>
                  </View>
                  <TextInput
                    style={[styles.amountInput, active && styles.amountInputActive]}
                    value={value}
                    onChangeText={(t) => setAmount(item.id, t)}
                    placeholder="₹0"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="numeric"
                  />
                </View>
              );
            }}
          />

          <Field label="Notes">
            <TextField value={notes} onChangeText={setNotes} placeholder="Optional — applies to the whole run" />
          </Field>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{items.length} {items.length === 1 ? 'person' : 'people'}</Text>
            <Text style={styles.totalValue}>{money(runTotal)}</Text>
          </View>

          <Text style={styles.note}>
            This only records the payments. Transfer the money with your own UPI or bank app, then mark them paid.
          </Text>

          <View style={styles.sheetBtns}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
            <Button
              title={items.length > 1 ? `Create ${items.length} payouts` : 'Create payout'}
              style={{ flex: 2 }}
              onPress={submit}
              loading={save.isPending}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  filters: { marginTop: spacing.md },

  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.h2 },
  rowMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowAmount: { color: colors.text, ...typography.h2, ...typography.number },
  pill: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { ...typography.micro, fontWeight: '700' },

  runHint: { color: colors.textMuted, ...typography.caption, marginBottom: spacing.sm },
  runList: { maxHeight: 260 },
  runRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent',
  },
  runRowActive: { borderColor: tint(colors.primary, '55'), backgroundColor: tint(colors.primary, '10') },
  amountInput: {
    width: 96, textAlign: 'right', color: colors.text, ...typography.body,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  amountInputActive: { borderColor: colors.primary },
  totalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.surfaceRaised,
  },
  totalLabel: { color: colors.textMuted, ...typography.caption },
  totalValue: { color: colors.text, ...typography.title, ...typography.number },
  markBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success,
    borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4,
  },
  markText: { color: colors.white, ...typography.micro, fontWeight: '700' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md, maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
  sheetTitle: { color: colors.text, ...typography.title },
  sheetBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  note: { color: colors.textMuted, ...typography.caption },

  personChip: { alignItems: 'center', gap: 4, width: 64 },
  personName: { color: colors.textSecondary, ...typography.micro },
  selected: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  selectedName: { color: colors.text, ...typography.body, fontWeight: '700', flex: 1 },
});
