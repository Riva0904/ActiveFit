import React, { useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Button, Card, EmptyState, Field, Header, Icon, Loading, PressScale, Screen, SectionTitle, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const money = (n: number) => `₹${Math.round(n ?? 0).toLocaleString('en-IN')}`;
const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

interface Pending {
  id: string; amount: number; billingPeriod: string; referenceCode: string;
  upiReference?: string | null; submittedAt?: string;
  plan?: { name: string; plan: string };
  gym?: { id: string; name: string; email: string; phone: string };
}

/**
 * The one manual step in the subscribe flow: a gym says it paid by UPI, and
 * confirming here is what actually activates their plan.
 */
export default function ApprovalsScreen() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['platform-pending'],
    queryFn: () => api.get('/admin/gym-subscriptions/pending') as any,
  });

  const confirm = useMutation({
    mutationFn: (id: string) => api.post(`/admin/gym-subscriptions/requests/${id}/confirm`, {}) as any,
    onSuccess: (_r, id) => {
      const row = rows.find((p) => p.id === id);
      Alert.alert('Activated', `${row?.gym?.name ?? 'The gym'} is now on ${row?.plan?.name ?? 'their plan'}.`);
      queryClient.invalidateQueries({ queryKey: ['platform-pending'] });
      queryClient.invalidateQueries({ queryKey: ['platform-gyms'] });
    },
    onError: (e: any) => Alert.alert('Could not confirm', e?.message ?? 'Try again'),
  });

  const reject = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) =>
      api.post(`/admin/gym-subscriptions/requests/${id}/reject`, { reason: why }) as any,
    onSuccess: () => {
      setRejecting(null); setReason('');
      queryClient.invalidateQueries({ queryKey: ['platform-pending'] });
    },
    onError: (e: any) => Alert.alert('Could not reject', e?.message ?? 'Try again'),
  });

  const runExpiry = useMutation({
    mutationFn: () => api.post('/admin/gym-subscriptions/run-expiry') as any,
    onSuccess: (res: any) =>
      Alert.alert('Sweep finished', `${res?.expired ?? 0} expired, ${res?.reminded ?? 0} reminder${res?.reminded === 1 ? '' : 's'} sent.`),
    onError: (e: any) => Alert.alert('Could not run', e?.message ?? 'Try again'),
  });

  const rows: Pending[] = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="Approvals"
          subtitle="Gyms that say they have paid"
          right={
            <PressScale onPress={() => runExpiry.mutate()} style={styles.sweepBtn}>
              <Icon name="refresh-cw" size={18} color={colors.primary} />
            </PressScale>
          }
        />
        <SectionTitle title={rows.length > 0 ? `${rows.length} waiting on you` : 'Nothing waiting'} />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="check"
              title="All caught up"
              subtitle="When a gym declares a UPI transfer it appears here for you to confirm."
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gym} numberOfLines={1}>{item.gym?.name ?? 'Unknown gym'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.plan?.name} · {item.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly'} · declared {when(item.submittedAt)}
                  </Text>
                </View>
                <Text style={styles.amount}>{money(item.amount)}</Text>
              </View>

              <View style={styles.refs}>
                <RefChip label="Reference" value={item.referenceCode} />
                {item.upiReference ? <RefChip label="UTR" value={item.upiReference} /> : null}
              </View>

              <Text style={styles.warn}>Only confirm after you see the money in your account.</Text>

              <View style={styles.actions}>
                <Button title="Reject" variant="secondary" style={{ flex: 1 }} onPress={() => setRejecting(item)} />
                <Button
                  title="Confirm"
                  icon="check"
                  style={{ flex: 2 }}
                  loading={confirm.isPending}
                  onPress={() =>
                    Alert.alert('Confirm this payment?', `${item.gym?.name} activates on ${item.plan?.name} immediately.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Confirm', onPress: () => confirm.mutate(item.id) },
                    ])
                  }
                />
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={!!rejecting} animationType="slide" transparent onRequestClose={() => setRejecting(null)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Reject this payment?</Text>
            <Text style={styles.sheetSub}>{rejecting?.gym?.name} · {money(rejecting?.amount ?? 0)}</Text>

            <Field label="Reason">
              <TextField value={reason} onChangeText={setReason} placeholder="e.g. No transfer found for this reference" />
            </Field>
            <Text style={styles.sheetHint}>The gym admin sees this, so make it something they can act on.</Text>

            <View style={styles.sheetBtns}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => { setRejecting(null); setReason(''); }} />
              <Button
                title="Reject"
                variant="danger"
                style={{ flex: 2 }}
                loading={reject.isPending}
                onPress={() =>
                  reason.trim().length < 3
                    ? Alert.alert('Add a reason')
                    : rejecting && reject.mutate({ id: rejecting.id, why: reason.trim() })
                }
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function RefChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.refChip}>
      <Text style={styles.refLabel}>{label}</Text>
      <Text style={styles.refValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  sweepBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: tint(colors.primary, '1F'), borderWidth: 1, borderColor: colors.border,
  },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  gym: { color: colors.text, ...typography.h2 },
  meta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  amount: { color: colors.text, ...typography.title, ...typography.number },
  refs: { flexDirection: 'row', gap: spacing.sm },
  refChip: {
    flex: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  refLabel: { color: colors.textMuted, ...typography.micro },
  refValue: { color: colors.text, ...typography.caption, fontWeight: '700' },
  warn: { color: colors.warning, ...typography.caption },
  actions: { flexDirection: 'row', gap: spacing.md },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
  sheetTitle: { color: colors.text, ...typography.title },
  sheetSub: { color: colors.textSecondary, ...typography.caption, marginTop: -8 },
  sheetHint: { color: colors.textMuted, ...typography.caption },
  sheetBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
