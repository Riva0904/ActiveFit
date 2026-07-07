import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function EditProfileScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!firstName.trim()) return Alert.alert('Error', 'First name required');
    setLoading(true);
    try {
      const updated = await api.patch('/users/me', { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() }) as any;
      updateUser({ firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone });
      queryClient.invalidateQueries({ queryKey: ['mobile-home'] });
      Alert.alert('Saved', 'Profile updated', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not update profile');
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
        <Text style={styles.title}>Edit Profile</Text>
      </View>

      {[
        { label: 'First Name', value: firstName, set: setFirstName },
        { label: 'Last Name', value: lastName, set: setLastName },
        { label: 'Phone', value: phone, set: setPhone, keyboard: 'phone-pad' as any },
      ].map(({ label, value, set, keyboard }) => (
        <View key={label} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={set}
            keyboardType={keyboard ?? 'default'}
            placeholderTextColor="#4B5563"
            placeholder={label}
          />
        </View>
      ))}

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={[styles.input, styles.disabled]} value={user?.email ?? ''} editable={false} />
        <Text style={styles.hint}>Email cannot be changed</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={save} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Changes</Text>}
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
  disabled: { opacity: 0.5 },
  hint: { color: '#4B5563', fontSize: 11, marginTop: 4 },
  btn: {
    marginHorizontal: 20, marginTop: 8, backgroundColor: '#FF4D00',
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
