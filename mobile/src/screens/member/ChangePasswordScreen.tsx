import React, { useState } from 'react';
import { Alert } from 'react-native';
import { api } from '../../lib/api';
import { Button, Field, Header, Screen, TextField } from '../../components';

export default function ChangePasswordScreen({ navigation }: any) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!current || !next || !confirm) return Alert.alert('Error', 'Fill all fields');
    if (next !== confirm) return Alert.alert('Error', 'Passwords do not match');
    if (next.length < 8 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next)) {
      return Alert.alert('Weak password', 'Use at least 8 characters with an uppercase letter, a lowercase letter and a number');
    }
    setLoading(true);
    try {
      await api.patch('/auth/change-password', { currentPassword: current, newPassword: next });
      Alert.alert('Success', 'Password changed — please sign in again', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Wrong current password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll keyboard>
      <Header title="Change Password" onBack={() => navigation.goBack()} />
      <Field label="Current password">
        <TextField value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" />
      </Field>
      <Field label="New password">
        <TextField value={next} onChangeText={setNext} secureTextEntry placeholder="••••••••" />
      </Field>
      <Field label="Confirm new password">
        <TextField value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="••••••••" />
      </Field>
      <Button title="Update password" size="lg" icon="lock" onPress={submit} loading={loading} />
    </Screen>
  );
}
