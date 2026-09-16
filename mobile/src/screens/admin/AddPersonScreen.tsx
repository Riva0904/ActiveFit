import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/Text';
import { api } from '../../lib/api';
import { can } from '../../lib/roles';
import { useAuthStore } from '../../store/authStore';
import { useGymScope } from '../../hooks/useGymScope';
import { Button, Chip, ChipRow, Field, Header, Screen, SectionTitle, TextField } from '../../components';
import { colors, spacing, typography } from '../../theme';

type NewRole = 'MEMBER' | 'TRAINER' | 'STAFF';

const LABEL: Record<NewRole, string> = { MEMBER: 'Member', TRAINER: 'Trainer', STAFF: 'Staff' };

/**
 * Sign someone up at the desk. Staff may add members and trainers; only the
 * gym admin may add another staff account — the same rule the backend enforces,
 * so a hidden option is never a 403 waiting to happen.
 */
export default function AddPersonScreen({ route, navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const scope = useGymScope();

  const allowed: NewRole[] = user?.role === 'GYM_ADMIN' ? ['MEMBER', 'TRAINER', 'STAFF'] : ['MEMBER', 'TRAINER'];
  const [role, setRole] = useState<NewRole>(route.params?.role ?? 'MEMBER');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.post('/users', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        role,
      }) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-people'] });
      queryClient.invalidateQueries({ queryKey: scope.key(['gym-stats']) });
      Alert.alert(
        `${LABEL[role]} added`,
        `${firstName} can sign in with ${email.trim().toLowerCase()} and the password you set.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    },
    onError: (e: any) => Alert.alert('Could not add', e?.message ?? 'Try again'),
  });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready = firstName.trim().length > 1 && lastName.trim().length > 0 && emailOk && password.length >= 8;

  if (!can(user, 'canAddPeople')) {
    return (
      <Screen scroll>
        <Header title="Add person" onBack={() => navigation.goBack()} />
        <Text style={styles.note}>Your role cannot create accounts.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title="Add person" subtitle="They can sign in straight away" onBack={() => navigation.goBack()} />

      <SectionTitle title="Role" />
      <ChipRow>
        {allowed.map((r) => (
          <Chip key={r} label={LABEL[r]} selected={role === r} onPress={() => setRole(r)} />
        ))}
      </ChipRow>

      <SectionTitle title="Details" />
      <Field label="First name">
        <TextField value={firstName} onChangeText={setFirstName} placeholder="Ravi" autoCapitalize="words" />
      </Field>
      <Field label="Last name">
        <TextField value={lastName} onChangeText={setLastName} placeholder="Kumar" autoCapitalize="words" />
      </Field>
      <Field label="Email">
        <TextField
          value={email}
          onChangeText={setEmail}
          placeholder="ravi@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Phone (optional)">
        <TextField value={phone} onChangeText={setPhone} placeholder="+91…" keyboardType="phone-pad" />
      </Field>
      <Field label="Temporary password">
        <TextField
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
        />
      </Field>
      <Text style={styles.hint}>Share this password with them and ask them to change it after signing in.</Text>

      <View style={styles.footer}>
        <Button
          title={`Add ${LABEL[role].toLowerCase()}`}
          size="lg"
          icon="user-plus"
          disabled={!ready}
          loading={create.isPending}
          onPress={() => create.mutate()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, ...typography.caption, marginTop: spacing.xs },
  note: { color: colors.textMuted, ...typography.body, marginTop: spacing.lg },
  footer: { marginTop: spacing.xl, marginBottom: spacing.xxl },
});
