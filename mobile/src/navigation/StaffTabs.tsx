import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components';
import { colors, spacing, tint } from '../theme';

// The desk screen is the admin attendance screen; it hides the QR scanner for
// staff on its own, since /attendance/qr-check-in is gym-admin only.
import AdminAttendanceScreen from '../screens/admin/AdminAttendanceScreen';
import EnquiriesScreen from '../screens/staff/EnquiriesScreen';

// Shared with the other shells.
import MessagesScreen from '../screens/chat/MessagesScreen';
import ChatContactsScreen from '../screens/chat/ContactsScreen';
import DirectChatScreen from '../screens/chat/DirectChatScreen';
import AddPersonScreen from '../screens/admin/AddPersonScreen';
import ProfileScreen from '../screens/member/ProfileScreen';
import EditProfileScreen from '../screens/member/EditProfileScreen';
import ChangePasswordScreen from '../screens/member/ChangePasswordScreen';
import NotificationsScreen from '../screens/member/NotificationsScreen';
import LeaveScreen from '../screens/trainer/LeaveScreen';
import SalaryScreen from '../screens/trainer/SalaryScreen';

const Tab = createBottomTabNavigator();
const DeskStack = createStackNavigator();
const EnquiriesStack = createStackNavigator();
const MessagesStack = createStackNavigator();
const ProfileStack = createStackNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Desk: 'qrcode',
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
      <MessagesStack.Screen name="MessagesMain" component={MessagesScreen} />
      <MessagesStack.Screen name="ChatContacts" component={ChatContactsScreen} />
      <MessagesStack.Screen name="DirectChat" component={DirectChatScreen} />
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
      <ProfileStack.Screen name="Messages" component={MessagesScreen} />
      <ProfileStack.Screen name="ChatContacts" component={ChatContactsScreen} />
      <ProfileStack.Screen name="DirectChat" component={DirectChatScreen} />
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
      <Tab.Screen name="Desk" component={DeskStackNavigator} />
      <Tab.Screen name="Enquiries" component={EnquiriesStackNavigator} />
      <Tab.Screen name="Messages" component={MessagesStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', justifyContent: 'center', width: 48, height: 44 },
  halo: { position: 'absolute', top: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: tint(colors.primary, '1F') },
  dot: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginTop: 6 },
});
