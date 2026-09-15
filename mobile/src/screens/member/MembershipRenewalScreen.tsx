import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { presentUpiCheckout } from '../../lib/upiPrompt';
import { Button, EmptyState, Header, Icon, Loading, Screen } from '../../components';
import { colors, radius, shadow, spacing, typography } from '../../theme';

const DURATION_LABELS: Record<number, string> = { 1: '1 Month', 3: '3 Months', 6: '6 Months', 12: '1 Year' };

export default function MembershipRenewalScreen({ navigation }: any) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ['membership-plans'],
    queryFn: () => api.get('/memberships/plans') as any,
  });

  const plans: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  // POST /payments/create-order only accepts type MEMBERSHIP and re-prices from
  // membershipPlanId server-side; `amount` here is just the client's expectation.
  const renewMutation = useMutation({
    mutationFn: (plan: any) =>
      api.post('/payments/create-order', { amount: plan.price, type: 'MEMBERSHIP', membershipPlanId: plan.id, useUpi: true }) as any,
    onSuccess: (res: any) => {
      presentUpiCheckout(res, {
        note: `Membership ${selectedPlan?.name ?? ''}`.trim(),
        onPaid: () => {
          queryClient.invalidateQueries({ queryKey: ['mobile-home'] });
          Alert.alert('Submitted', 'Your payment is awaiting gym confirmation. Membership activates once confirmed.');
          navigation.goBack();
        },
      });
    },
    onError: (e: any) => Alert.alert('Could not start payment', e?.message ?? 'Try again'),
  });

  function purchase() {
    if (!selectedPlan) return Alert.alert('Select a plan', 'Choose a membership plan to continue');
    renewMutation.mutate(selectedPlan);
  }

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: 160 }}>
      <Header title="Renew Membership" subtitle="Choose a plan to continue your fitness journey" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : plans.length === 0 ? (
        <EmptyState icon="award" title="No membership plans available" />
      ) : (
        plans.map((plan: any) => {
          const isSelected = selectedPlan?.id === plan.id;
          return (
            <TouchableOpacity key={plan.id} style={[styles.planCard, isSelected && styles.planCardSelected]} onPress={() => setSelectedPlan(plan)} activeOpacity={0.8}>
              {plan.isPopular ? <View style={styles.popularBadge}><Text style={styles.popularText}>POPULAR</Text></View> : null}
              <View style={styles.planTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDur}>{DURATION_LABELS[plan.durationMonths] ?? `${plan.durationMonths} Months`}</Text>
                </View>
                <View style={styles.priceWrap}>
                  <Text style={styles.planPrice}>₹{plan.price?.toLocaleString('en-IN')}</Text>
                  {plan.originalPrice && plan.originalPrice > plan.price ? (
                    <Text style={styles.planOrigPrice}>₹{plan.originalPrice?.toLocaleString('en-IN')}</Text>
                  ) : null}
                </View>
              </View>
              {plan.features?.length > 0 ? (
                <View style={styles.features}>
                  {plan.features.map((f: string, i: number) => (
                    <View key={i} style={styles.featureRow}>
                      <Icon name="check" size={14} color={colors.primary} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {isSelected ? <View style={styles.selectedIndicator} /> : null}
            </TouchableOpacity>
          );
        })
      )}

      <View style={[styles.footer, { paddingBottom: spacing.xl + insets.bottom }]}>
        {selectedPlan ? (
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>{selectedPlan.name}</Text>
            <Text style={styles.summaryPrice}>₹{selectedPlan.price?.toLocaleString('en-IN')}</Text>
          </View>
        ) : null}
        <Button title="Pay via UPI" size="lg" icon="smartphone" onPress={purchase} disabled={!selectedPlan} loading={renewMutation.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, marginBottom: 14,
    borderWidth: 2, borderColor: colors.surfaceRaised, overflow: 'hidden', ...shadow.card,
  },
  planCardSelected: { borderColor: colors.primary },
  popularBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: radius.sm },
  popularText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  planName: { color: colors.text, ...typography.h2 },
  planDur: { color: colors.textSecondary, ...typography.label, marginTop: 2 },
  priceWrap: { alignItems: 'flex-end' },
  planPrice: { color: colors.primary, ...typography.title, fontWeight: '800', ...typography.number },
  planOrigPrice: { color: colors.textFaint, ...typography.label, textDecorationLine: 'line-through' },
  features: { gap: 6 },
  featureRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  featureText: { color: colors.textSecondary, ...typography.label, flex: 1 },
  selectedIndicator: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%', backgroundColor: colors.primary },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface,
    padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border,
  },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  summaryLabel: { color: colors.textSecondary, ...typography.body },
  summaryPrice: { color: colors.text, ...typography.h2, ...typography.number },
});
