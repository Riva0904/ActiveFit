import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Image, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function EditProfileScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function pickImage(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow access in Settings to continue');
      return;
    }

    const opts: ImagePicker.ImagePickerOptions = {
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);
      const res: any = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatar(res.url);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Try again');
    } finally {
      setUploading(false);
    }
  }

  function showPicker() {
    Alert.alert('Change Photo', 'Choose a source', [
      { text: 'Camera', onPress: () => pickImage('camera') },
      { text: 'Gallery', onPress: () => pickImage('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function save() {
    if (!firstName.trim()) return Alert.alert('Error', 'First name required');
    setLoading(true);
    try {
      const updated = await api.patch('/users/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        avatar: avatar || undefined,
      }) as any;
      updateUser({
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        avatar: updated.avatar,
      });
      queryClient.invalidateQueries({ queryKey: ['mobile-home'] });
      Alert.alert('Saved', 'Profile updated', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not update profile');
    } finally {
      setLoading(false);
    }
  }

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar section */}
      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatarWrap} onPress={showPicker} disabled={uploading} activeOpacity={0.8}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          <View style={styles.cameraOverlay}>
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontSize: 16 }}>📷</Text>}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarName}>{firstName || user?.firstName} {lastName || user?.lastName}</Text>
        <Text style={styles.avatarHint}>Tap photo to change</Text>
      </View>

      {/* Fields */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Personal Info</Text>

        {[
          { label: 'First Name', value: firstName, set: setFirstName, placeholder: 'John' },
          { label: 'Last Name', value: lastName, set: setLastName, placeholder: 'Doe' },
          { label: 'Phone', value: phone, set: setPhone, placeholder: '+91 9876543210', keyboard: 'phone-pad' as const },
        ].map(({ label, value, set, placeholder, keyboard }) => (
          <View key={label} style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={set}
              keyboardType={keyboard ?? 'default'}
              placeholderTextColor="#4B5563"
              placeholder={placeholder}
            />
          </View>
        ))}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={user?.email ?? ''}
            editable={false}
          />
          <Text style={styles.hint}>Email cannot be changed</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, (loading || uploading) && styles.saveBtnDisabled]}
        onPress={save}
        disabled={loading || uploading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>Save Changes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  topBar: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: '#FF4D00', fontSize: 16, fontWeight: '600' },

  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatarImg: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#FF4D00' },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#FF4D00',
    alignItems: 'center', justifyContent: 'center',
  },
  initials: { color: '#fff', fontSize: 34, fontWeight: '800' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1F1F1F', borderWidth: 2, borderColor: '#0A0A0A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarName: { color: '#F9FAFB', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  avatarHint: { color: '#6B7280', fontSize: 13 },

  card: {
    marginHorizontal: 20, backgroundColor: '#141414',
    borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: '#1F1F1F', marginBottom: 20,
  },
  cardTitle: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 16 },

  field: { marginBottom: 14 },
  fieldLabel: { color: '#6B7280', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
    color: '#F9FAFB', fontSize: 15, paddingHorizontal: 16, paddingVertical: 13,
  },
  inputDisabled: { opacity: 0.45 },
  hint: { color: '#374151', fontSize: 11, marginTop: 4 },

  saveBtn: {
    marginHorizontal: 20, backgroundColor: '#FF4D00',
    borderRadius: 16, paddingVertical: 17, alignItems: 'center',
    shadowColor: '#FF4D00', shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
