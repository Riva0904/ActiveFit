import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button, Card, Enter, Field, Header, Icon, Loading, Screen, SectionTitle, TextField } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

/**
 * The platform's own settings — chiefly the UPI address gyms pay subscriptions
 * to. Getting this wrong means money goes nowhere, so the screen says so.
 */
export default function PlatformSettingsScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => api.get('/platform-settings') as any,
  });

  const [upiVpa, setUpiVpa] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [graceDays, setGraceDays] = useState('0');
  const [supportEmail, setSupportEmail] = useState('');

  useEffect(() => {
    if (!data) return;
    setUpiVpa(data.upiVpa ?? '');
    setPayeeName(data.upiPayeeName ?? '');
    setTrialDays(String(data.trialDays ?? 14));
    setGraceDays(String(data.graceDays ?? 0));
    setSupportEmail(data.supportEmail ?? '');
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.patch('/platform-settings', {
        upiVpa: upiVpa.trim() || undefined,
        upiPayeeName: payeeName.trim() || undefined,
        trialDays: Number(trialDays) || 0,
        graceDays: Number(graceDays) || 0,
        supportEmail: supportEmail.trim() || undefined,
      }) as any,
    onSuccess: () => {
      Alert.alert('Saved', 'New subscriptions will use these settings.');
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: (e: any) => Alert.alert('Could not save', e?.message ?? 'Check the UPI address format'),
  });

  if (isLoading) return <Loading fullScreen />;

  const vpaLooksWrong = upiVpa.trim().length > 0 && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(upiVpa.trim());

  return (
    <Screen scroll>
      <Header title="Platform settings" subtitle="How gyms pay you" onBack={() => navigation.goBack()} />

      {!data?.upiVpa && (
        <Enter index={0}>
          <Card accent="danger">
            <View style={styles.warnTop}>
              <Icon name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.warnTitle}>No UPI address set</Text>
            </View>
            <Text style={styles.warnBody}>
              Gyms cannot start a subscription until you add one. Add the account you actually want the money in.
            </Text>
          </Card>
        </Enter>
      )}

      <Enter index={1}>
        <SectionTitle title="Subscription payments" />
        <Card>
          <Field label="Your UPI address">
            <TextField value={upiVpa} onChangeText={setUpiVpa} placeholder="name@bank" autoCapitalize="none" />
          </Field>
          {vpaLooksWrong ? <Text style={styles.error}>That does not look like a UPI address — it should read like name@bank.</Text> : null}

          <Field label="Payee name">
            <TextField value={payeeName} onChangeText={setPayeeName} placeholder="ActiveBoost" />
          </Field>
          <Text style={styles.hint}>This is the name gyms see in their UPI app when they pay.</Text>
        </Card>
      </Enter>

      <Enter index={2}>
        <SectionTitle title="Terms" />
        <Card>
          <Field label="Free trial (days)">
            <TextField value={trialDays} onChangeText={setTrialDays} keyboardType="numeric" />
          </Field>
          <Field label="Grace after expiry (days)">
            <TextField value={graceDays} onChangeText={setGraceDays} keyboardType="numeric" />
          </Field>
          <Text style={styles.hint}>
            Zero means a plan goes inactive the day it expires. The gym's own members keep checking in either way.
          </Text>

          <Field label="Support email">
            <TextField value={supportEmail} onChangeText={setSupportEmail} placeholder="support@…" autoCapitalize="none" keyboardType="email-address" />
          </Field>
        </Card>
      </Enter>

      <Enter index={3}>
        <Button title="Save settings" size="lg" icon="check" onPress={() => save.mutate()} loading={save.isPending} />
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warnTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warnTitle: { color: colors.text, ...typography.h2 },
  warnBody: { color: colors.textSecondary, ...typography.caption, marginTop: spacing.xs },
  hint: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xs },
  error: { color: colors.danger, ...typography.caption, marginTop: -spacing.sm },
});
