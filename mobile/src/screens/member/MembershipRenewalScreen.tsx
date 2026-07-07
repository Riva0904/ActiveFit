import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function MembershipRenewalScreen({ navigation }: any) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['membership-plans'],
    queryFn: () => api.get('/memberships/plans') as any,
  });

  const plans: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  const renewMutation = useMutation({
    mutationFn: (planId: string) =>
      api.post('/payments/create-order', { planId, paymentMethod: 'UPI' }) as any,
    onSuccess: (res: any) => {
      const upiId = res?.gymUpiId ?? res?.upiId ?? 'gym@upi';
      const amount = selectedPlan?.price ?? res?.amount ?? 0;
      Alert.alert(
        'UPI Payment',
        `Pay ₹${amount} to UPI ID:\n\n${upiId}\n\nReference: ${res?.orderId ?? ''}\n\nAfter payment, tap Confirm.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm Payment',
            onPress: () => markPaid(res?.paymentId ?? res?.id),
          },
        ],
      );
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Try again'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (paymentId: string) =>
      api.patch(`/payments/${paymentId}/mark-paid`, { paymentMethod: 'UPI' }) as any,
    onSuccess: () => {
      Alert.alert('Done!', 'Membership renewal submitted. Admin will confirm shortly.');
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Error', e?.message),
  });

  function markPaid(paymentId: string) {
    if (!paymentId) {
      Alert.alert('Done', 'Payment recorded. Your membership will be updated shortly.');
      navigation.goBack();
      return;
    }
    markPaidMutation.mutate(paymentId);
  }

  function purchase() {
    if (!selectedPlan) return Alert.alert('Select a plan', 'Choose a membership plan to continue');
    renewMutation.mutate(selectedPlan.id);
  }

  const DURATION_LABELS: Record<number, string> = {
    1: '1 Month', 3: '3 Months', 6: '6 Months', 12: '1 Year',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Renew Membership</Text>
        <Text style={styles.sub}>Choose a plan to continue your fitness journey</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}>
          {plans.length === 0 && (
            <Text style={{ color: '#6B7280', textAlign: 'center', marginTop: 40 }}>
              No membership plans available
            </Text>
          )}
          {plans.map((plan: any) => {
            const isSelected = selectedPlan?.id === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelectedPlan(plan)}
                activeOpacity={0.8}
              >
                {plan.isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>POPULAR</Text>
                  </View>
                )}
                <View style={styles.planTop}>
                  <View>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planDur}>
                      {DURATION_LABELS[plan.durationMonths] ?? `${plan.durationMonths} Months`}
                    </Text>
                  </View>
                  <View style={styles.priceWrap}>
                    <Text style={styles.planPrice}>₹{plan.price?.toLocaleString('en-IN')}</Text>
                    {plan.originalPrice && plan.originalPrice > plan.price && (
                      <Text style={styles.planOrigPrice}>₹{plan.originalPrice?.toLocaleString('en-IN')}</Text>
                    )}
                  </View>
                </View>
                {plan.features?.length > 0 && (
                  <View style={styles.features}>
                    {plan.features.map((f: string, i: number) => (
                      <View key={i} style={styles.featureRow}>
                        <Text style={styles.featureDot}>✓</Text>
                        <Text style={styles.featureText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {isSelected && <View style={styles.selectedIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {selectedPlan && (
          <View style={styles.selectedSummary}>
            <Text style={styles.summaryLabel}>{selectedPlan.name}</Text>
            <Text style={styles.summaryPrice}>₹{selectedPlan.price?.toLocaleString('en-IN')}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.buyBtn, !selectedPlan && styles.buyBtnDisabled]}
          onPress={purchase}
          disabled={!selectedPlan || renewMutation.isPending || markPaidMutation.isPending}
        >
          {renewMutation.isPending || markPaidMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buyBtnText}>Pay via UPI</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  sub: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  planCard: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20,
    marginBottom: 14, borderWidth: 2, borderColor: '#2A2A2A',
    position: 'relative', overflow: 'hidden',
  },
  planCardSelected: { borderColor: '#FF4D00' },
  popularBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#FF4D00', paddingHorizontal: 12, paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planName: { color: '#F9FAFB', fontSize: 17, fontWeight: '700' },
  planDur: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  priceWrap: { alignItems: 'flex-end' },
  planPrice: { color: '#FF4D00', fontSize: 22, fontWeight: '800' },
  planOrigPrice: { color: '#4B5563', fontSize: 13, textDecorationLine: 'line-through' },
  features: { gap: 6 },
  featureRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  featureDot: { color: '#FF4D00', fontSize: 13, fontWeight: '700' },
  featureText: { color: '#9CA3AF', fontSize: 13, flex: 1 },
  selectedIndicator: {
    position: 'absolute', top: 0, left: 0,
    width: 4, height: '100%', backgroundColor: '#FF4D00',
  },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#141414', padding: 20, borderTopWidth: 1, borderTopColor: '#2A2A2A',
  },
  selectedSummary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { color: '#9CA3AF', fontSize: 14 },
  summaryPrice: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
  buyBtn: { backgroundColor: '#FF4D00', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buyBtnDisabled: { opacity: 0.4 },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
