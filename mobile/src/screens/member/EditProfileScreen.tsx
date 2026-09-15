import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Avatar, Button, Card, Field, Header, Icon, Loading, Screen, TextField } from '../../components';
import { colors, spacing, typography } from '../../theme';

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
    const opts: ImagePicker.ImagePickerOptions = { allowsEditing: true, aspect: [1, 1], quality: 0.8 };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'profile.jpg' } as any);
      // Do NOT set Content-Type by hand: axios must generate the multipart boundary
      // itself, otherwise the server sees a boundary-less header and fails to parse (500).
      const res: any = await api.post('/chat/upload', formData);
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
      updateUser({ firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone, avatar: updated.avatar });
      queryClient.invalidateQueries({ queryKey: ['mobile-home'] });
      Alert.alert('Saved', 'Profile updated', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Could not update profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll keyboard>
      <Header title="Edit Profile" onBack={() => navigation.goBack()} />

      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatarWrap} onPress={showPicker} disabled={uploading} activeOpacity={0.8}>
          <Avatar uri={avatar || null} firstName={user?.firstName} lastName={user?.lastName} size={100} ring />
          <View style={styles.cameraOverlay}>
            {uploading ? <Loading /> : <Icon name="camera" size={15} color={colors.text} />}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarName}>{firstName || user?.firstName} {lastName || user?.lastName}</Text>
        <Text style={styles.avatarHint}>Tap photo to change</Text>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Personal info</Text>
        <Field label="First name" style={styles.field}>
          <TextField value={firstName} onChangeText={setFirstName} placeholder="John" />
        </Field>
        <Field label="Last name" style={styles.field}>
          <TextField value={lastName} onChangeText={setLastName} placeholder="Doe" />
        </Field>
        <Field label="Phone" style={styles.field}>
          <TextField value={phone} onChangeText={setPhone} placeholder="+91 9876543210" keyboardType="phone-pad" />
        </Field>
        <Field label="Email" style={{ marginBottom: 0 }}>
          <TextField value={user?.email ?? ''} editable={false} style={{ opacity: 0.45 }} />
          <Text style={styles.hint}>Email cannot be changed</Text>
        </Field>
      </Card>

      <Button title="Save changes" size="lg" onPress={save} loading={loading} disabled={uploading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarSection: { alignItems: 'center', paddingBottom: spacing.xxl },
  avatarWrap: { position: 'relative', marginBottom: spacing.md },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceRaised, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarName: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  avatarHint: { color: colors.textMuted, ...typography.label },
  cardTitle: { color: colors.textSecondary, ...typography.section, marginBottom: spacing.lg },
  field: { marginBottom: spacing.lg },
  hint: { color: colors.textFaint, ...typography.micro, marginTop: 4 },
});
