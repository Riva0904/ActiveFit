import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Button, Card, Chip, ChipRow, EmptyState, Field, Header, Icon, Loading, PressScale, Screen, SectionTitle, TextField, type IconName,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const CATEGORIES: { value: string; label: string; icon: IconName; color: string }[] = [
  { value: 'TRAINER_SALARY', label: 'Trainer salary', icon: 'dumbbell', color: colors.info },
  { value: 'STAFF_SALARY', label: 'Staff salary', icon: 'users', color: colors.cyan },
  { value: 'ELECTRICITY', label: 'Electricity', icon: 'zap', color: colors.warning },
  { value: 'WATER', label: 'Water', icon: 'activity', color: colors.cyan },
  { value: 'RENT', label: 'Rent', icon: 'home', color: colors.primary },
  { value: 'EQUIPMENT_MAINTENANCE', label: 'Equipment', icon: 'settings', color: colors.purple },
  { value: 'INTERNET', label: 'Internet', icon: 'smartphone', color: colors.info },
  { value: 'MARKETING', label: 'Marketing', icon: 'trending-up', color: colors.pink },
  { value: 'OTHER', label: 'Other', icon: 'more-horizontal', color: colors.textMuted },
];

const catMeta = (v: string) => CATEGORIES.find((c) => c.value === v) ?? CATEGORIES[CATEGORIES.length - 1];
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface Expense {
  id: string; title: string; amount: number; category: string; description?: string; date: string;
}

export default function ExpensesScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const scope = useGymScope();

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: scope.key(['expenses', month, year]),
    queryFn: () => api.get('/expenses', { params: scope.params({ month, year, limit: 100 }) }) as any,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
    onError: (e: any) => Alert.alert('Could not delete', e?.message ?? 'Try again'),
  });

  const expenses: Expense[] = Array.isArray(data) ? data : (data?.data ?? []);
  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // A locked feature comes back as 403 from the entitlement guard.
  const locked = (error as any)?.statusCode === 403;

  if (locked) {
    return (
      <Screen scroll>
        <Header title="Expenses" onBack={() => navigation.goBack()} />
        <EmptyState
          icon="lock"
          title="Not on your plan"
          subtitle="Expense tracking is included from the Professional plan upward."
          action={{ label: 'See plans', onPress: () => navigation.navigate('Subscription') }}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="Expenses"
          subtitle={`${money(total)} in ${new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' })}`}
          onBack={() => navigation.goBack()}
          right={<PressScale onPress={() => { setEditing(null); setShowForm(true); }} style={styles.addBtn}><Icon name="plus" size={20} color={colors.white} /></PressScale>}
        />

        <ChipRow>
          {Array.from({ length: 6 }, (_, i) => {
            const d = new Date(year, now.getMonth() - i, 1);
            return (
              <Chip
                key={i}
                label={d.toLocaleString('en-IN', { month: 'short' })}
                selected={month === d.getMonth() + 1}
                onPress={() => setMonth(d.getMonth() + 1)}
              />
            );
          })}
        </ChipRow>

        {byCategory.length > 0 && (
          <Card style={styles.breakdown} padding="md">
            {byCategory.slice(0, 4).map(([cat, amt]) => {
              const meta = catMeta(cat);
              const pct = total > 0 ? amt / total : 0;
              return (
                <View key={cat} style={styles.breakRow}>
                  <Icon name={meta.icon} size={14} color={meta.color} />
                  <Text style={styles.breakLabel} numberOfLines={1}>{meta.label}</Text>
                  <View style={styles.breakTrack}>
                    <View style={[styles.breakFill, { width: `${pct * 100}%`, backgroundColor: meta.color }]} />
                  </View>
                  <Text style={styles.breakAmount}>{money(amt)}</Text>
                </View>
              );
            })}
          </Card>
        )}

        <SectionTitle title={`${expenses.length} entries`} />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="receipt"
              title="No expenses this month"
              subtitle="Add rent, bills, salaries and anything else you spend on."
              action={{ label: 'Add expense', onPress: () => { setEditing(null); setShowForm(true); } }}
            />
          }
          renderItem={({ item }) => {
            const meta = catMeta(item.category);
            return (
              <PressScale
                style={styles.row}
                scaleTo={0.98}
                onLongPress={() =>
                  Alert.alert(item.title, 'What would you like to do?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Edit', onPress: () => { setEditing(item); setShowForm(true); } },
                    { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(item.id) },
                  ])
                }
                onPress={() => { setEditing(item); setShowForm(true); }}
              >
                <View style={[styles.rowIcon, { backgroundColor: tint(meta.color, '22') }]}>
                  <Icon name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.rowMeta}>
                    {meta.label} · {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{money(item.amount)}</Text>
              </PressScale>
            );
          }}
        />
      )}

      <ExpenseForm
        visible={showForm}
        expense={editing}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['expenses'] }); }}
      />
    </Screen>
  );
}

function ExpenseForm({ visible, expense, onClose, onSaved }: { visible: boolean; expense: Expense | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [description, setDescription] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    setTitle(expense?.title ?? '');
    setAmount(expense?.amount ? String(expense.amount) : '');
    setCategory(expense?.category ?? 'OTHER');
    setDescription(expense?.description ?? '');
  }, [visible, expense]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim(),
        amount: Number(amount),
        category,
        description: description.trim() || undefined,
        date: expense?.date ?? new Date().toISOString(),
      };
      return (expense ? api.put(`/expenses/${expense.id}`, body) : api.post('/expenses', body)) as any;
    },
    onSuccess: onSaved,
    onError: (e: any) => Alert.alert('Could not save', e?.message ?? 'Try again'),
  });

  const submit = () => {
    if (!title.trim()) return Alert.alert('Add a title');
    if (!(Number(amount) > 0)) return Alert.alert('Enter a valid amount');
    save.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{expense ? 'Edit expense' : 'New expense'}</Text>

          <Field label="What was it for?">
            <TextField value={title} onChangeText={setTitle} placeholder="e.g. October electricity" />
          </Field>

          <Field label="Amount (₹)">
            <TextField value={amount} onChangeText={setAmount} placeholder="0" keyboardType="numeric" />
          </Field>

          <Field label="Category">
            <ChipRow>
              {CATEGORIES.map((c) => (
                <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} />
              ))}
            </ChipRow>
          </Field>

          <Field label="Notes">
            <TextField value={description} onChangeText={setDescription} placeholder="Optional" />
          </Field>

          <View style={styles.sheetBtns}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
            <Button title={expense ? 'Save' : 'Add expense'} style={{ flex: 2 }} onPress={submit} loading={save.isPending} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  breakdown: { marginTop: spacing.md, gap: spacing.sm },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakLabel: { color: colors.textSecondary, ...typography.caption, width: 84 },
  breakTrack: { flex: 1, height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  breakFill: { height: 5, borderRadius: 3 },
  breakAmount: { color: colors.text, ...typography.caption, ...typography.number, width: 68, textAlign: 'right' },

  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, ...typography.h2 },
  rowMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  rowAmount: { color: colors.text, ...typography.h2, ...typography.number },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md, maxHeight: '90%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
  sheetTitle: { color: colors.text, ...typography.title },
  sheetBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
