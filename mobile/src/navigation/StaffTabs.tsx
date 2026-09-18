import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components';
import { useAuthStore } from '../store/authStore';
import { isCleaningStaff } from '../lib/roles';
import { useChatUnread } from '../hooks/useChatUnread';
import { colors, spacing, tint } from '../theme';

// The desk screen is the admin attendance screen; it hides the QR scanner for
// staff on its own, since /attendance/qr-check-in is gym-admin only.
import AdminAttendanceScreen from '../screens/admin/AdminAttendanceScreen';
import EnquiriesScreen from '../screens/staff/EnquiriesScreen';
import MemberDuesScreen from '../screens/staff/MemberDuesScreen';
// Generic self check-in screen — the cleaning crew's whole Desk equivalent.
import TrainerAttendanceScreen from '../screens/trainer/AttendanceScreen';

// Shared with the other shells.
import { chatScreens } from './chatScreens';
import AddPersonScreen from '../screens/admin/AddPersonScreen';
import ProfileScreen from '../screens/member/ProfileScreen';
import EditProfileScreen from '../screens/member/EditProfileScreen';
import ChangePasswordScreen from '../screens/member/ChangePasswordScreen';
import NotificationsScreen from '../screens/member/NotificationsScreen';
import LeaveScreen from '../screens/trainer/LeaveScreen';
import SalaryScreen from '../screens/trainer/SalaryScreen';

const Tab = createBottomTabNavigator();
const DeskStack = createStackNavigator();
const DuesStack = createStackNavigator();
const EnquiriesStack = createStackNavigator();
const MessagesStack = createStackNavigator();
const ProfileStack = createStackNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Desk: 'qrcode',
  MyShift: 'calendar-check',
  Dues: 'credit-card',
  Enquiries: 'inbox',
  Messages: 'message-circle',
  Profile: 'user',
};

function TabIcon({ route, focused, color }: { route: string; focused: boolean; color: string }) {
  const f = useSharedValue(focused ? 1 : 0);
  useEffect(() => { f.value = withSpring(focused ? 1 : 0, { damping: 14, stiffness: 220 }); }, [focused, f]);
  const iconAnim = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * f.value }, { scale: 1 + 0.1 * f.value }] }));
  const haloAnim = useAnimatedStyle(() => ({ opacity: f.value, transform: [{ scale: 0.6 + 0.4 * f.value }] }));
  const dotAnim = useAnimatedStyle(() => ({ opacity: f.value, transform: [{ scaleX: f.value }] }));
  return (
    <View style={styles.tab}>
      <Animated.View style={[styles.halo, haloAnim]} pointerEvents="none" />
      <Animated.View style={iconAnim}>
        <Icon name={TAB_ICONS[route] ?? 'home'} size={24} color={color} />
      </Animated.View>
      <Animated.View style={[styles.dot, dotAnim]} />
    </View>
  );
}

function DeskStackNavigator() {
  return (
    <DeskStack.Navigator screenOptions={{ headerShown: false }}>
      <DeskStack.Screen name="DeskMain" component={AdminAttendanceScreen} />
      <DeskStack.Screen name="AddPerson" component={AddPersonScreen} />
    </DeskStack.Navigator>
  );
}

function DuesStackNavigator() {
  return (
    <DuesStack.Navigator screenOptions={{ headerShown: false }}>
      <DuesStack.Screen name="DuesMain" component={MemberDuesScreen} />
    </DuesStack.Navigator>
  );
}

/**
 * The cleaning crew's shell. They are `Role.STAFF` like the front desk, but the
 * desk's work is not theirs: no member sign-ups, no enquiries, no dues. What is
 * left is their own attendance, leave, salary and messages.
 */
function CleaningAttendanceNavigator() {
  return (
    <DeskStack.Navigator screenOptions={{ headerShown: false }}>
      <DeskStack.Screen name="MyAttendance" component={TrainerAttendanceScreen} />
    </DeskStack.Navigator>
  );
}

function EnquiriesStackNavigator() {
  return (
    <EnquiriesStack.Navigator screenOptions={{ headerShown: false }}>
      <EnquiriesStack.Screen name="EnquiriesMain" component={EnquiriesScreen} />
    </EnquiriesStack.Navigator>
  );
}

function MessagesStackNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      {chatScreens(MessagesStack, 'MessagesMain')}
    </MessagesStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="Leave" component={LeaveScreen} />
      <ProfileStack.Screen name="Salary" component={SalaryScreen} />
      {chatScreens(ProfileStack)}
    </ProfileStack.Navigator>
  );
}

/**
 * The front desk. Staff used to land in the member app, where the QR card was
 * empty and Plans and Store returned nothing — none of it was theirs. These
 * four tabs are exactly what the backend grants a STAFF account.
 */
export default function StaffTabs() {
  const insets = useSafeAreaInsets();
  const unread = useChatUnread();
  const user = useAuthStore((s) => s.user);
  const cleaning = isCleaningStaff(user);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceRaised,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: spacing.sm,
          shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12,
        },
        tabBarIcon: ({ focused, color }) => <TabIcon route={route.name} focused={focused} color={color} />,
      })}
    >
      {cleaning ? (
        <Tab.Screen name="MyShift" component={CleaningAttendanceNavigator} />
      ) : (
        <Tab.Screen name="Desk" component={DeskStackNavigator} />
      )}
      {!cleaning && <Tab.Screen name="Dues" component={DuesStackNavigator} />}
      {!cleaning && <Tab.Screen name="Enquiries" component={EnquiriesStackNavigator} />}
      <Tab.Screen
        name="Messages"
        component={MessagesStackNavigator}
        options={{
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.white, fontSize: 10 },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', justifyContent: 'center', width: 48, height: 44 },
  halo: { position: 'absolute', top: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: tint(colors.primary, '1F') },
  dot: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginTop: 6 },
});
