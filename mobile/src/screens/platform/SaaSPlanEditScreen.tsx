import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button, Card, Checkbox, Field, Header, Icon, PressScale, Screen, SectionTitle, TextField } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';
import type { SaaSPlan } from './SaaSPlansScreen';

/**
 * Editing a pack changes what every gym on that tier pays and is allowed. The
 * tier itself (`plan`) is enum-backed and never editable — only its terms are.
 */
export default function SaaSPlanEditScreen({ route, navigation }: any) {
  const plan: SaaSPlan = route.params?.plan;
  const queryClient = useQueryClient();

  const [name, setName] = useState(plan?.name ?? '');
  const [monthlyPrice, setMonthly] = useState(String(plan?.monthlyPrice ?? 0));
  const [yearlyPrice, setYearly] = useState(String(plan?.yearlyPrice ?? 0));
  const [maxMembers, setMaxMembers] = useState(String(plan?.maxMembers ?? 0));
  const [maxTrainers, setMaxTrainers] = useState(String(plan?.maxTrainers ?? 0));
  const [maxStaff, setMaxStaff] = useState(String(plan?.maxStaff ?? 0));
  const [maxBranches, setMaxBranches] = useState(String(plan?.maxBranches ?? 0));
  const [commissionPct, setCommission] = useState(String(plan?.commissionPct ?? 0));
  const [features, setFeatures] = useState<string[]>(plan?.features ?? []);
  const [newFeature, setNewFeature] = useState('');
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);

  const saveMutation = useMutation({
    mutationFn: (body: any) => api.patch(`/saas-plans/${plan.id}`, body) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-plans'] });
      queryClient.invalidateQueries({ queryKey: ['platform-revenue'] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Could not save', e?.message ?? 'Try again'),
  });

  const num = (s: string) => {
    const n = Number(s.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  };

  function save() {
    if (!name.trim()) return Alert.alert('Name required', 'Give the pack a name.');

    const fields = {
      monthlyPrice: num(monthlyPrice),
      yearlyPrice: num(yearlyPrice),
      maxMembers: num(maxMembers),
      maxTrainers: num(maxTrainers),
      maxStaff: num(maxStaff),
      maxBranches: num(maxBranches),
      commissionPct: num(commissionPct),
    };
    const bad = Object.entries(fields).find(([, v]) => Number.isNaN(v) || v < 0);
    if (bad) return Alert.alert('Check the numbers', `${bad[0]} must be zero or more.`);
    if (fields.commissionPct > 100) return Alert.alert('Check the numbers', 'Commission cannot exceed 100%.');

    saveMutation.mutate({ name: name.trim(), ...fields, features, isActive });
  }

  function addFeature() {
    const f = newFeature.trim();
    if (!f) return;
    if (features.includes(f)) return setNewFeature('');
    setFeatures((prev) => [...prev, f]);
    setNewFeature('');
  }

  if (!plan) {
    return (
      <Screen scroll>
        <Header title="Pack" onBack={() => navigation.goBack()} />
        <Text style={styles.missing}>This pack could not be loaded. Go back and pick it again.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboard>
      <Header
        title={`Edit ${plan.name}`}
        subtitle={`${plan.plan} tier · applies to every gym on it`}
        onBack={() => navigation.goBack()}
      />

      <SectionTitle title="Pricing" />
      <Card padding="md">
        <Field label="Display name" style={styles.field}>
          <TextField value={name} onChangeText={setName} maxLength={40} />
        </Field>
        <Field label="Monthly price (₹)" style={styles.field}>
          <TextField value={monthlyPrice} onChangeText={setMonthly} keyboardType="number-pad" />
        </Field>
        <Field label="Yearly price (₹)" style={styles.field}>
          <TextField value={yearlyPrice} onChangeText={setYearly} keyboardType="number-pad" />
        </Field>
        <Field label="Commission on gym collections (%)">
          <TextField value={commissionPct} onChangeText={setCommission} keyboardType="decimal-pad" />
        </Field>
      </Card>

      <SectionTitle title="Limits" />
      <Card padding="md">
        <Field label="Max members" style={styles.field}>
          <TextField value={maxMembers} onChangeText={setMaxMembers} keyboardType="number-pad" />
        </Field>
        <Field label="Max trainers" style={styles.field}>
          <TextField value={maxTrainers} onChangeText={setMaxTrainers} keyboardType="number-pad" />
        </Field>
        <Field label="Max staff" style={styles.field}>
          <TextField value={maxStaff} onChangeText={setMaxStaff} keyboardType="number-pad" />
        </Field>
        <Field label="Max branches">
          <TextField value={maxBranches} onChangeText={setMaxBranches} keyboardType="number-pad" />
        </Field>
      </Card>

      <SectionTitle title="Features listed on the pack" />
      <Card padding="md">
        {features.length === 0 ? (
          <Text style={styles.hint}>No features listed yet.</Text>
        ) : (
          features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.featureText} numberOfLines={2}>{f}</Text>
              <PressScale
                style={styles.removeBtn}
                onPress={() => setFeatures((prev) => prev.filter((x) => x !== f))}
              >
                <Icon name="x" size={14} color={colors.danger} />
              </PressScale>
            </View>
          ))
        )}
        <View style={styles.addRow}>
          <TextField
            value={newFeature}
            onChangeText={setNewFeature}
            placeholder="Add a feature"
            style={{ flex: 1 }}
            onSubmitEditing={addFeature}
            returnKeyType="done"
          />
          <Button title="Add" variant="secondary" onPress={addFeature} />
        </View>
      </Card>

      <Card padding="md">
        <PressScale style={styles.toggleRow} onPress={() => setIsActive((v) => !v)}>
          <Checkbox checked={isActive} />
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Offered to gyms</Text>
            <Text style={styles.hint}>
              Turn this off to hide the pack from the gym admin's subscription screen. Gyms already on it keep it.
            </Text>
          </View>
        </PressScale>
      </Card>

      <Button title="Save pack" size="lg" icon="check" style={styles.save} onPress={save} loading={saveMutation.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  hint: { color: colors.textMuted, ...typography.caption },
  missing: { color: colors.textMuted, ...typography.body, textAlign: 'center', marginTop: spacing.xxl },

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

  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  toggleLabel: { color: colors.text, ...typography.body, fontWeight: '700', marginBottom: 2 },

  save: { marginTop: spacing.xl, borderRadius: radius.lg },
});
