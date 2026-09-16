import React, { useState } from 'react';
import { Alert, Clipboard, Linking, Modal, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGymScope } from '../../hooks/useGymScope';
import {
  Button, Card, Chip, ChipRow, Enter, Field, GlowOrb, Header, Icon, Loading, PressScale, Screen, SectionTitle, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface Plan {
  id: string; plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'; name: string;
  monthlyPrice: number; yearlyPrice: number;
  maxMembers: number; maxTrainers: number; maxStaff: number; maxBranches: number;
  features: string[];
}

interface Mine {
  plan: string; status: string; isActive: boolean; inGrace: boolean;
  expiresAt?: string; daysLeft?: number | null;
  limits: { maxMembers: number; maxTrainers: number; maxStaff: number };
  usage: { members: number; trainers: number; staff: number };
  features: string[];
  pendingRequest?: any;
}

const TIER_COLOR: Record<string, string> = {
  STARTER: colors.textMuted,
  PROFESSIONAL: colors.primary,
  ENTERPRISE: colors.purple,
};

export default function SubscriptionScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [payment, setPayment] = useState<any | null>(null);
  const [utr, setUtr] = useState('');

  const scope = useGymScope();
  const plansQ = useQuery<Plan[]>({ queryKey: ['sub-plans'], queryFn: () => api.get('/gym-subscriptions/plans') as any });
  const mineQ = useQuery<Mine>({
    queryKey: scope.key(['gym-subscription-me']),
    queryFn: () => api.get('/gym-subscriptions/me', { params: scope.params() }) as any,
  });

  const request = useMutation({
    mutationFn: (planId: string) => api.post('/gym-subscriptions/request', { planId, billingPeriod: period }) as any,
    onSuccess: (res: any) => setPayment(res),
    onError: (e: any) => Alert.alert('Could not start', e?.message ?? 'Try again'),
  });

  const markPaid = useMutation({
    mutationFn: () => api.post(`/gym-subscriptions/requests/${payment.requestId}/mark-paid`, { upiReference: utr.trim() || undefined }) as any,
    onSuccess: () => {
      setPayment(null); setUtr('');
      Alert.alert('Sent for confirmation', 'Your plan activates as soon as we verify the transfer.');
      queryClient.invalidateQueries({ queryKey: scope.key(['gym-subscription-me']) });
    },
    onError: (e: any) => Alert.alert('Could not submit', e?.message ?? 'Try again'),
  });

  const cancelRequest = useMutation({
    mutationFn: (id: string) => api.post(`/gym-subscriptions/requests/${id}/cancel`) as any,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scope.key(['gym-subscription-me']) }),
  });

  if (plansQ.isLoading || mineQ.isLoading) return <Loading fullScreen />;

  const mine = mineQ.data;
  const pending = mine?.pendingRequest;

  const openUpi = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('No UPI app found', 'Install a UPI app, or pay from another device using the ID shown.'),
    );
  };

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={mineQ.isRefetching} onRefresh={() => { mineQ.refetch(); plansQ.refetch(); }} tintColor={colors.primary} />}
    >
      <Header title="Subscription" subtitle="Pay by UPI, we activate once verified" onBack={() => navigation.goBack()} />

      {/* Current */}
      {mine && (
        <Enter index={0}>
          <Card glow={mine.isActive && mine.plan !== 'STARTER'} accent={mine.isActive ? undefined : 'danger'}>
            <GlowOrb size={200} intensity={0.3} color={TIER_COLOR[mine.plan] ?? colors.primary} style={styles.cardGlow} />
            <Text style={styles.currentLabel}>Current plan</Text>
            <Text style={styles.currentPlan}>{mine.plan}</Text>
            <Text style={styles.currentMeta}>
              {mine.inGrace ? 'In grace period' : mine.isActive ? 'Active' : 'Expired'}
              {mine.expiresAt ? ` · ${mine.isActive ? 'renews' : 'ended'} ${new Date(mine.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              {typeof mine.daysLeft === 'number' && mine.daysLeft > 0 ? ` · ${mine.daysLeft} days left` : ''}
            </Text>

            <View style={styles.usageRow}>
              <Usage label="Members" used={mine.usage.members} max={mine.limits.maxMembers} />
              <Usage label="Trainers" used={mine.usage.trainers} max={mine.limits.maxTrainers} />
              <Usage label="Staff" used={mine.usage.staff} max={mine.limits.maxStaff} />
            </View>
          </Card>
        </Enter>
      )}

      {/* Pending */}
      {pending && (
        <Enter index={1}>
          <Card accent="warning">
            <View style={styles.pendingTop}>
              <Icon name="clock" size={18} color={colors.warning} />
              <Text style={styles.pendingTitle}>
                {pending.status === 'SUBMITTED' ? 'Waiting for confirmation' : 'Payment pending'}
              </Text>
            </View>
            <Text style={styles.pendingBody}>
              {pending.plan?.name ?? ''} · {money(pending.amount)} · ref {pending.referenceCode}
            </Text>
            <Text style={styles.pendingHint}>
              {pending.status === 'SUBMITTED'
                ? 'We are checking your transfer. This usually takes a few hours.'
                : 'Finish the UPI transfer, then tell us you have paid.'}
            </Text>
            <Button
              title="Cancel request"
              variant="ghost"
              onPress={() =>
                Alert.alert('Cancel this request?', 'You can start a new one afterwards.', [
                  { text: 'Keep', style: 'cancel' },
                  { text: 'Cancel request', style: 'destructive', onPress: () => cancelRequest.mutate(pending.id) },
                ])
              }
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </Enter>
      )}

      {/* Period toggle */}
      <Enter index={2}>
        <SectionTitle title="Choose a pack" />
        <ChipRow>
          <Chip label="Monthly" selected={period === 'MONTHLY'} onPress={() => setPeriod('MONTHLY')} />
          <Chip label="Yearly" selected={period === 'YEARLY'} onPress={() => setPeriod('YEARLY')} />
        </ChipRow>
      </Enter>

      {/* Packs */}
      {(plansQ.data ?? []).map((plan, i) => {
        const isCurrent = mine?.plan === plan.plan && mine?.isActive;
        const price = period === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
        const color = TIER_COLOR[plan.plan] ?? colors.primary;
        return (
          <Enter key={plan.id} index={3 + i}>
            <Card glow={plan.plan === 'PROFESSIONAL'} style={styles.planCard}>
              <View style={styles.planTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planName, { color }]}>{plan.name}</Text>
                  <Text style={styles.planPrice}>
                    {money(price)}
                    <Text style={styles.planPer}> / {period === 'YEARLY' ? 'year' : 'month'}</Text>
                  </Text>
                </View>
                <Icon name="crown-outline" size={24} color={color} />
              </View>

              <View style={styles.limitList}>
                <LimitRow value={plan.maxMembers} label="members" />
                <LimitRow value={plan.maxTrainers} label="trainers" />
                <LimitRow value={plan.maxStaff} label="staff accounts" />
                <LimitRow value={plan.maxBranches} label="branches" />
              </View>

              {isCurrent ? (
                <View style={styles.currentPill}>
                  <Icon name="check" size={14} color={colors.success} />
                  <Text style={styles.currentPillText}>Your current plan</Text>
                </View>
              ) : (
                <Button
                  title={mine?.plan === plan.plan ? 'Renew' : 'Subscribe'}
                  icon="crown-outline"
                  onPress={() => request.mutate(plan.id)}
                  loading={request.isPending}
                  disabled={!!pending}
                  style={{ marginTop: spacing.md }}
                />
              )}
              {pending && !isCurrent ? (
                <Text style={styles.blockedHint}>Finish or cancel your pending request first.</Text>
              ) : null}
            </Card>
          </Enter>
        );
      })}

      {/* UPI sheet */}
      <Modal visible={!!payment} animationType="slide" transparent onRequestClose={() => setPayment(null)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Pay {payment ? money(payment.amount) : ''}</Text>
            <Text style={styles.sheetSub}>{payment?.planName} · {payment?.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly'}</Text>

            <CopyRow label="UPI ID" value={payment?.vpa ?? ''} />
            <CopyRow label="Reference (add to the note)" value={payment?.referenceCode ?? ''} />

            <Button title="Open UPI app" icon="smartphone" size="lg" onPress={() => payment && openUpi(payment.upiIntentUrl)} />

            <Field label="Transaction reference (UTR)">
              <TextField value={utr} onChangeText={setUtr} placeholder="e.g. 412345678901" keyboardType="numeric" />
            </Field>
            <Text style={styles.sheetHint}>Adding the UTR helps us match your transfer faster.</Text>

            <View style={styles.sheetBtns}>
              <Button title="Later" variant="secondary" style={{ flex: 1 }} onPress={() => setPayment(null)} />
              <Button title="I have paid" style={{ flex: 2 }} icon="check" onPress={() => markPaid.mutate()} loading={markPaid.isPending} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <PressScale
      style={styles.copyRow}
      onPress={() => { Clipboard.setString(value); Alert.alert('Copied', value); }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.copyLabel}>{label}</Text>
        <Text style={styles.copyValue} numberOfLines={1}>{value}</Text>
      </View>
      <Icon name="copy" size={16} color={colors.textMuted} />
    </PressScale>
  );
}

function Usage({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(1, used / max) : 0;
  return (
    <View style={styles.usage}>
      <Text style={styles.usageLabel}>{label}</Text>
      <Text style={styles.usageValue}>{used}<Text style={styles.usageMax}>/{max}</Text></Text>
      <View style={styles.usageTrack}>
        <View style={[styles.usageFill, { width: `${pct * 100}%`, backgroundColor: pct >= 0.85 ? colors.danger : colors.success }]} />
      </View>
    </View>
  );
}

function LimitRow({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.limitRow}>
      <Icon name="check" size={14} color={colors.success} />
      <Text style={styles.limitText}>
        <Text style={styles.limitValue}>{value.toLocaleString('en-IN')}</Text> {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardGlow: { top: -80, right: -60 },
  currentLabel: { color: colors.textMuted, ...typography.micro, textTransform: 'uppercase', letterSpacing: 1 },
  currentPlan: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
  currentMeta: { color: colors.textSecondary, ...typography.caption, marginTop: 4 },
  usageRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  usage: { flex: 1 },
  usageLabel: { color: colors.textMuted, ...typography.micro, textTransform: 'uppercase', letterSpacing: 0.5 },
  usageValue: { color: colors.text, ...typography.h2, ...typography.number, marginTop: 2 },
  usageMax: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  usageTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  usageFill: { height: 4, borderRadius: 2 },

  pendingTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pendingTitle: { color: colors.text, ...typography.h2 },
  pendingBody: { color: colors.textSecondary, ...typography.body, marginTop: spacing.xs },
  pendingHint: { color: colors.textMuted, ...typography.caption, marginTop: 2 },

  planCard: { gap: 0 },
  planTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  planName: { ...typography.h2 },
  planPrice: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2, ...typography.number },
  planPer: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  limitList: { marginTop: spacing.md, gap: 6 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  limitText: { color: colors.textSecondary, ...typography.body },
  limitValue: { color: colors.text, fontWeight: '700' },
  currentPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: tint(colors.success, '18'), borderRadius: radius.md, paddingVertical: 12, marginTop: spacing.md,
  },
  currentPillText: { color: colors.success, ...typography.body, fontWeight: '700' },
  blockedHint: { color: colors.textMuted, ...typography.caption, textAlign: 'center', marginTop: spacing.sm },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md, maxHeight: '92%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
  sheetTitle: { color: colors.text, ...typography.title },
  sheetSub: { color: colors.textSecondary, ...typography.caption, marginTop: -8 },
  sheetHint: { color: colors.textMuted, ...typography.caption },
  sheetBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },

  copyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  copyLabel: { color: colors.textMuted, ...typography.micro },
  copyValue: { color: colors.text, ...typography.body, fontWeight: '700', marginTop: 2 },
});
