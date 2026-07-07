import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { api } from '../../lib/api';

export default function ChangePasswordScreen({ navigation }: any) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!current || !next || !confirm) return Alert.alert('Error', 'Fill all fields');
    if (next !== confirm) return Alert.alert('Error', 'Passwords do not match');
    if (next.length < 6) return Alert.alert('Error', 'Min 6 characters');
    setLoading(true);
    try {
      await api.patch('/auth/change-password', { currentPassword: current, newPassword: next });
      Alert.alert('Success', 'Password changed', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Wrong current password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Change Password</Text>
      </View>

      {[
        { label: 'Current Password', value: current, set: setCurrent },
        { label: 'New Password', value: next, set: setNext },
        { label: 'Confirm New Password', value: confirm, set: setConfirm },
      ].map(({ label, value, set }) => (
        <View key={label} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={set}
            secureTextEntry
            placeholderTextColor="#4B5563"
            placeholder="••••••••"
          />
        </View>
      ))}

      <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update Password</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 32 },
  back: { marginBottom: 12 },
  backText: { color: '#FF4D00', fontSize: 16 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  field: { marginHorizontal: 20, marginBottom: 16 },
  label: { color: '#9CA3AF', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1,
    borderColor: '#2A2A2A', color: '#F9FAFB', fontSize: 15,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  btn: {
    marginHorizontal: 20, marginTop: 8, backgroundColor: '#FF4D00',
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
