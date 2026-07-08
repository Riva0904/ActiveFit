import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Image,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';

interface MenuItem {
  label: string;
  icon: string;
  color: string;
  onPress?: () => void;
  danger?: boolean;
}

export default function ProfileScreen({ navigation }: any) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const role = user?.role ?? 'MEMBER';
  const isTrainer = role === 'TRAINER';
  const isAdminRole = role === 'SUPER_ADMIN' || role === 'GYM_ADMIN' || role === 'STAFF';

  const gymItems: MenuItem[] = isTrainer
    ? [
        { label: 'Leave Requests', icon: '📋', color: '#7C3AED', onPress: () => navigation.navigate('Leave') },
        { label: 'Salary History', icon: '💰', color: '#059669', onPress: () => navigation.navigate('Salary') },
      ]
    : isAdminRole
    ? []
    : [
        { label: 'My Membership', icon: '🏅', color: '#FF4D00', onPress: () => navigation.navigate('MyMembership') },
        { label: 'Renew Membership', icon: '🔄', color: '#F59E0B', onPress: () => navigation.navigate('MembershipRenewal') },
        { label: 'Payment History', icon: '💳', color: '#3B82F6', onPress: () => navigation.navigate('PaymentHistory') },
        { label: 'Progress Log', icon: '📊', color: '#10B981', onPress: () => navigation.navigate('ProgressLog') },
        { label: 'My Trainer', icon: '🏋️', color: '#8B5CF6', onPress: () => navigation.navigate('MyTrainer') },
        { label: 'Referrals', icon: '🎁', color: '#EC4899', onPress: () => navigation.navigate('Referrals') },
      ];

  const chatTarget = role === 'SUPER_ADMIN'
    ? 'SuperAdminChat'
    : (role === 'GYM_ADMIN' || role === 'STAFF')
    ? 'GymAdminChat'
    : 'Chat';
  const chatLabel = role === 'SUPER_ADMIN'
    ? 'Gym Admin Chats'
    : (role === 'GYM_ADMIN' || role === 'STAFF')
    ? 'Member Messages'
    : 'Chat with Admin';

  type Section = { title: string; items: MenuItem[] };
  const sections: Section[] = [
    {
      title: 'Account',
      items: [
        { label: 'Edit Profile', icon: '✏️', color: '#6366F1', onPress: () => navigation.navigate('EditProfile') },
        { label: 'Change Password', icon: '🔒', color: '#8B5CF6', onPress: () => navigation.navigate('ChangePassword') },
        { label: 'Notifications', icon: '🔔', color: '#F59E0B', onPress: () => navigation.navigate('Notifications') },
      ],
    },
    ...(gymItems.length > 0 ? [{
      title: isTrainer ? 'Work' : 'Gym',
      items: gymItems,
    }] : []),
    {
      title: 'Support',
      items: [
        { label: chatLabel, icon: '💬', color: '#06B6D4', onPress: () => navigation.navigate(chatTarget) },
        ...(!isTrainer && !isAdminRole
          ? [{ label: 'Gamification & Badges', icon: '🏆', color: '#FBBF24', onPress: () => navigation.navigate('Gamification') }]
          : []),
      ],
    },
    {
      title: '',
      items: [
        {
          label: 'Logout',
          icon: '🚪',
          color: '#EF4444',
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

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  const roleLabel = role.replace(/_/g, ' ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Hero header */}
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.85}
        >
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarInitWrap}>
              <Text style={styles.avatarInit}>{initials}</Text>
            </View>
          )}
          <View style={styles.editBadge}>
            <Text style={{ fontSize: 10 }}>✏️</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>

        {user?.memberCode && (
          <View style={styles.memberCodeWrap}>
            <Text style={styles.memberCodeLabel}>Member Code</Text>
            <Text style={styles.memberCode}>{user.memberCode}</Text>
          </View>
        )}
      </View>

      {/* Menu sections */}
      {sections.map((section, si) => (
        <View key={si} style={styles.section}>
          {section.title ? (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          ) : null}
          <View style={styles.card}>
            {section.items.map((item, ii) => (
              <TouchableOpacity
                key={ii}
                style={[styles.row, ii < section.items.length - 1 && styles.rowBorder]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.danger ? '#FEF2F2' : `${item.color}18` }]}>
                  <Text style={styles.rowIcon}>{item.icon}</Text>
                </View>
                <Text style={[styles.rowLabel, item.danger && styles.rowDanger]}>{item.label}</Text>
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
  container: { flex: 1, backgroundColor: '#0A0A0A' },

  hero: {
    alignItems: 'center', paddingTop: 56, paddingBottom: 28,
    paddingHorizontal: 20, overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute', top: -40, width: 260, height: 260,
    borderRadius: 130, backgroundColor: '#FF4D00', opacity: 0.07,
  },

  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatarImg: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: '#FF4D00',
  },
  avatarInitWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#FF4D00', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FF6B3A',
  },
  avatarInit: { color: '#fff', fontSize: 30, fontWeight: '800' },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1A1A1A', borderWidth: 2, borderColor: '#0A0A0A',
    alignItems: 'center', justifyContent: 'center',
  },

  name: { color: '#F9FAFB', fontSize: 22, fontWeight: '800', marginBottom: 3 },
  email: { color: '#6B7280', fontSize: 13, marginBottom: 12 },

  rolePill: {
    backgroundColor: '#1A1A1A', borderRadius: 20, borderWidth: 1,
    borderColor: '#FF4D00', paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10,
  },
  roleText: { color: '#FF4D00', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  memberCodeWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#141414', borderRadius: 10, borderWidth: 1,
    borderColor: '#2A2A2A', paddingHorizontal: 12, paddingVertical: 6,
  },
  memberCodeLabel: { color: '#6B7280', fontSize: 11 },
  memberCode: { color: '#FF4D00', fontSize: 13, fontWeight: '700' },

  section: { marginBottom: 4 },
  sectionTitle: {
    color: '#4B5563', fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1.2, paddingHorizontal: 24, marginBottom: 8, marginTop: 12,
  },
  card: {
    marginHorizontal: 16, backgroundColor: '#141414',
    borderRadius: 18, borderWidth: 1, borderColor: '#1F1F1F',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  iconCircle: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rowIcon: { fontSize: 17 },
  rowLabel: { flex: 1, color: '#E5E7EB', fontSize: 15, fontWeight: '500' },
  rowDanger: { color: '#EF4444' },
  chevron: { color: '#374151', fontSize: 20, fontWeight: '300' },
});
