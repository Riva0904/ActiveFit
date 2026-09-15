import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useAuthStore } from '../../store/authStore';
import { Avatar, Card, Enter, GlowOrb, Icon, ListRow, PressScale, Screen, SectionTitle, type IconName } from '../../components';
import { colors, radius, shadow, spacing, typography } from '../../theme';

interface MenuItem {
  label: string;
  icon: IconName;
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
        { label: 'Leave Requests', icon: 'file-text', color: colors.purple, onPress: () => navigation.navigate('Leave') },
        { label: 'Salary History', icon: 'dollar-sign', color: colors.success, onPress: () => navigation.navigate('Salary') },
      ]
    : isAdminRole
    ? []
    : [
        { label: 'My Membership', icon: 'award', color: colors.primary, onPress: () => navigation.navigate('MyMembership') },
        { label: 'Renew Membership', icon: 'refresh-cw', color: colors.warning, onPress: () => navigation.navigate('MembershipRenewal') },
        { label: 'Payment History', icon: 'credit-card', color: colors.info, onPress: () => navigation.navigate('PaymentHistory') },
        { label: 'Progress Log', icon: 'trending-up', color: colors.success, onPress: () => navigation.navigate('ProgressLog') },
        { label: 'My Trainer', icon: 'dumbbell', color: colors.purple, onPress: () => navigation.navigate('MyTrainer') },
        { label: 'Referrals', icon: 'gift', color: colors.pink, onPress: () => navigation.navigate('Referrals') },
      ];

  const chatTarget = role === 'SUPER_ADMIN' ? 'SuperAdminChat' : role === 'GYM_ADMIN' ? 'GymAdminChat' : 'Chat';
  const chatLabel = role === 'SUPER_ADMIN' ? 'Gym Admin Chats' : role === 'GYM_ADMIN' ? 'Member Messages' : 'Chat with Admin';

  type Section = { title: string; items: MenuItem[] };
  const sections: Section[] = [
    {
      title: 'Account',
      items: [
        { label: 'Edit Profile', icon: 'edit-2', color: colors.info, onPress: () => navigation.navigate('EditProfile') },
        { label: 'Change Password', icon: 'lock', color: colors.purple, onPress: () => navigation.navigate('ChangePassword') },
        { label: 'Notifications', icon: 'bell', color: colors.warning, onPress: () => navigation.navigate('Notifications') },
      ],
    },
    ...(gymItems.length > 0 ? [{ title: isTrainer ? 'Work' : 'Gym', items: gymItems }] : []),
    {
      title: 'Support',
      items: [
        { label: chatLabel, icon: 'message-circle', color: colors.cyan, onPress: () => navigation.navigate(chatTarget) },
        ...(!isTrainer && !isAdminRole
          ? [{ label: 'Gamification & Badges', icon: 'trophy-outline' as IconName, color: colors.warning, onPress: () => navigation.navigate('Gamification') }]
          : []),
      ],
    },
    {
      title: '',
      items: [
        {
          label: 'Logout',
          icon: 'log-out',
          color: colors.danger,
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
    <Screen scroll>
      {/* Hero */}
      <View style={styles.hero}>
        <GlowOrb size={340} intensity={0.5} breathe style={styles.heroGlow} />
        <PressScale style={styles.avatarWrap} onPress={() => navigation.navigate('EditProfile')} scaleTo={0.94}>
          <Avatar uri={user?.avatar} firstName={user?.firstName} lastName={user?.lastName} size={90} ring />
          <View style={styles.editBadge}><Icon name="edit-2" size={11} color={colors.text} /></View>
        </PressScale>
        <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.rolePill}><Text style={styles.roleText}>{role.replace(/_/g, ' ')}</Text></View>
        {user?.memberCode ? (
          <View style={styles.memberCodeWrap}>
            <Text style={styles.memberCodeLabel}>Member Code</Text>
            <Text style={styles.memberCode}>{user.memberCode}</Text>
          </View>
        ) : null}
      </View>

      {/* Menu */}
      {sections.map((section, si) => (
        <Enter key={si} index={si + 1}>
          {section.title ? <SectionTitle title={section.title} /> : <View style={{ height: spacing.md }} />}
          <Card padding="none">
            {section.items.map((item, ii) => (
              <ListRow
                key={item.label}
                label={item.label}
                icon={item.icon}
                iconColor={item.color}
                danger={item.danger}
                chevron={!item.danger}
                onPress={item.onPress}
                last={ii === section.items.length - 1}
              />
            ))}
          </Card>
        </Enter>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: spacing.xxl, marginHorizontal: -spacing.screen, paddingHorizontal: spacing.screen, overflow: 'hidden' },
  heroGlow: { top: -130, alignSelf: 'center' },
  avatarWrap: { position: 'relative', marginBottom: spacing.lg, ...shadow.glow },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center',
  },
  name: { color: colors.text, ...typography.title, fontWeight: '800', marginBottom: 3 },
  email: { color: colors.textMuted, ...typography.label, marginBottom: spacing.md },
  rolePill: { backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10 },
  roleText: { color: colors.primary, ...typography.caption, fontWeight: '700', letterSpacing: 0.5 },
  memberCodeWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md - 2, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6 },
  memberCodeLabel: { color: colors.textMuted, ...typography.micro },
  memberCode: { color: colors.primary, ...typography.label, fontWeight: '700', ...typography.number },
});
