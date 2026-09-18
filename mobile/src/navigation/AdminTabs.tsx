import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components';
import { colors, spacing, tint } from '../theme';

import AdminDashboardScreen from '../screens/admin/DashboardScreen';
import PeopleScreen from '../screens/admin/PeopleScreen';
import PersonDetailScreen from '../screens/admin/PersonDetailScreen';
import AdminAttendanceScreen from '../screens/admin/AdminAttendanceScreen';
import AdminPlansScreen from '../screens/admin/PlansScreen';
import PlanAssignScreen from '../screens/admin/PlanAssignScreen';
import PaymentsScreen from '../screens/admin/PaymentsScreen';
import ExpensesScreen from '../screens/admin/ExpensesScreen';
import PayrollScreen from '../screens/admin/PayrollScreen';
import ProfitLossScreen from '../screens/admin/ProfitLossScreen';
import MembershipPlansScreen from '../screens/admin/MembershipPlansScreen';
import AdminSupplementsScreen from '../screens/admin/AdminSupplementsScreen';
import SubscriptionScreen from '../screens/admin/SubscriptionScreen';

// Shared with the member app
import ProfileScreen from '../screens/member/ProfileScreen';
import EditProfileScreen from '../screens/member/EditProfileScreen';
import ChangePasswordScreen from '../screens/member/ChangePasswordScreen';
import NotificationsScreen from '../screens/member/NotificationsScreen';
import SuperAdminChatScreen from '../screens/member/SuperAdminChatScreen';
import { chatScreens } from './chatScreens';
import AddPersonScreen from '../screens/admin/AddPersonScreen';
import EnquiriesScreen from '../screens/staff/EnquiriesScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();
const PeopleStack = createStackNavigator();
const AttendanceStack = createStackNavigator();
const PlansStack = createStackNavigator();
const MoneyStack = createStackNavigator();
const ProfileStack = createStackNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Home: 'home',
  People: 'users',
  Attendance: 'qrcode',
  Plans: 'clipboard-text-outline',
  Money: 'cash-multiple',
  // Without this the Profile tab fell through to the 'home' fallback and showed
  // the same glyph as the first tab.
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

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="DashboardMain" component={AdminDashboardScreen} />
      <HomeStack.Screen name="Enquiries" component={EnquiriesScreen} />
    </HomeStack.Navigator>
  );
}

function PeopleStackNavigator() {
  return (
    <PeopleStack.Navigator screenOptions={{ headerShown: false }}>
      <PeopleStack.Screen name="PeopleMain" component={PeopleScreen} />
      <PeopleStack.Screen name="PersonDetail" component={PersonDetailScreen} />
      <PeopleStack.Screen name="AddPerson" component={AddPersonScreen} />
      <PeopleStack.Screen name="Enquiries" component={EnquiriesScreen} />
    </PeopleStack.Navigator>
  );
}

function AttendanceStackNavigator() {
  return (
    <AttendanceStack.Navigator screenOptions={{ headerShown: false }}>
      <AttendanceStack.Screen name="AttendanceMain" component={AdminAttendanceScreen} />
    </AttendanceStack.Navigator>
  );
}

function PlansStackNavigator() {
  return (
    <PlansStack.Navigator screenOptions={{ headerShown: false }}>
      <PlansStack.Screen name="PlansMain" component={AdminPlansScreen} />
      <PlansStack.Screen name="PlanAssign" component={PlanAssignScreen} />
    </PlansStack.Navigator>
  );
}

/** Everything money-related lives behind one tab: payments in, costs out, and the plan you pay us for. */
function MoneyStackNavigator() {
  return (
    <MoneyStack.Navigator screenOptions={{ headerShown: false }}>
      <MoneyStack.Screen name="Payments" component={PaymentsScreen} />
      <MoneyStack.Screen name="Expenses" component={ExpensesScreen} />
      <MoneyStack.Screen name="Payroll" component={PayrollScreen} />
      <MoneyStack.Screen name="ProfitLoss" component={ProfitLossScreen} />
      <MoneyStack.Screen name="MembershipPlans" component={MembershipPlansScreen} />
      <MoneyStack.Screen name="AdminSupplements" component={AdminSupplementsScreen} />
      <MoneyStack.Screen name="Subscription" component={SubscriptionScreen} />
    </MoneyStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="SuperAdminChat" component={SuperAdminChatScreen} />
      {chatScreens(ProfileStack)}
      <ProfileStack.Screen name="Subscription" component={SubscriptionScreen} />
    </ProfileStack.Navigator>
  );
}

export default function AdminTabs() {
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
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="People" component={PeopleStackNavigator} />
      <Tab.Screen name="Attendance" component={AttendanceStackNavigator} />
      <Tab.Screen name="Plans" component={PlansStackNavigator} />
      <Tab.Screen name="Money" component={MoneyStackNavigator} />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ tabBarIcon: ({ color, focused }) => <TabIcon route="Profile" focused={focused} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', justifyContent: 'center', width: 48, height: 44 },
  halo: { position: 'absolute', top: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: tint(colors.primary, '1F') },
  dot: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginTop: 6 },
});
