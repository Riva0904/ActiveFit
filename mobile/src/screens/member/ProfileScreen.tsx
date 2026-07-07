import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuthStore } from '../../store/authStore';

interface MenuItem {
  label: string;
  icon: string;
  onPress?: () => void;
  danger?: boolean;
}

export default function ProfileScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const soon = (label: string) => Alert.alert(label, 'Coming soon in the next update');

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Account',
      items: [
        { label: 'Edit Profile', icon: '✏️', onPress: () => soon('Edit Profile') },
        { label: 'Change Password', icon: '🔒', onPress: () => soon('Change Password') },
        { label: 'Notifications', icon: '🔔', onPress: () => soon('Notifications') },
      ],
    },
    {
      title: 'Gym',
      items: [
        { label: 'My Membership', icon: '🏅', onPress: () => soon('My Membership') },
        { label: 'Payment History', icon: '💳', onPress: () => soon('Payment History') },
        { label: 'Progress Log', icon: '📊', onPress: () => soon('Progress Log') },
        { label: 'Referrals', icon: '🎁', onPress: () => soon('Referrals') },
      ],
    },
    {
      title: 'Support',
      items: [
        { label: 'Chat with Admin', icon: '💬', onPress: () => soon('Chat') },
        { label: 'Gamification & Badges', icon: '🏆', onPress: () => soon('Gamification') },
      ],
    },
    {
      title: '',
      items: [
        {
          label: 'Logout',
          icon: '🚪',
          danger: true,
          onPress: () =>
            Alert.alert('Logout', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: () => logout() },
            ]),
        },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Avatar row */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </View>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.replace('_', ' ')}</Text>
        </View>
      </View>

      {sections.map((section, si) => (
        <View key={si} style={{ marginBottom: 8 }}>
          {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
          <View style={styles.sectionCard}>
            {section.items.map((item, ii) => (
              <TouchableOpacity
                key={ii}
                style={[styles.menuItem, ii < section.items.length - 1 && styles.menuItemBorder]}
                onPress={item.onPress}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={[styles.menuLabel, item.danger && { color: '#EF4444' }]}>{item.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  avatarSection: { alignItems: 'center', paddingTop: 60, paddingBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF4D00',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { color: '#F9FAFB', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  email: { color: '#9CA3AF', fontSize: 13, marginBottom: 10 },
  roleBadge: {
    backgroundColor: '#1A1A1A', borderRadius: 8, borderWidth: 1,
    borderColor: '#FF4D00', paddingHorizontal: 12, paddingVertical: 4,
  },
  roleText: { color: '#FF4D00', fontSize: 12, fontWeight: '600' },
  sectionTitle: { color: '#6B7280', fontSize: 12, fontWeight: '600', paddingHorizontal: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  sectionCard: {
    marginHorizontal: 20, backgroundColor: '#1A1A1A',
    borderRadius: 14, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, color: '#E5E7EB', fontSize: 15 },
  chevron: { color: '#4B5563', fontSize: 20 },
});
