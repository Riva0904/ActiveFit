import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '../store/cartStore';
import { Icon, type IconName } from '../components';
import { colors, radius, spacing, tint } from '../theme';

import MemberHomeScreen from '../screens/member/HomeScreen';
import RunScreen from '../screens/member/RunScreen';
import RunDetailScreen from '../screens/member/RunDetailScreen';
import AttendanceScreen from '../screens/member/AttendanceScreen';
import PlansScreen from '../screens/member/PlansScreen';
import StoreScreen from '../screens/member/StoreScreen';
import ProfileScreen from '../screens/member/ProfileScreen';

import EditProfileScreen from '../screens/member/EditProfileScreen';
import ChangePasswordScreen from '../screens/member/ChangePasswordScreen';
import MyMembershipScreen from '../screens/member/MyMembershipScreen';
import PaymentHistoryScreen from '../screens/member/PaymentHistoryScreen';
import NotificationsScreen from '../screens/member/NotificationsScreen';
import MembershipRenewalScreen from '../screens/member/MembershipRenewalScreen';
import SuperAdminChatScreen from '../screens/member/SuperAdminChatScreen';
import MessagesScreen from '../screens/chat/MessagesScreen';
import ChatContactsScreen from '../screens/chat/ContactsScreen';
import DirectChatScreen from '../screens/chat/DirectChatScreen';
import GamificationScreen from '../screens/member/GamificationScreen';
import ReferralsScreen from '../screens/member/ReferralsScreen';
import MyTrainerScreen from '../screens/member/MyTrainerScreen';
import ProgressLogScreen from '../screens/member/ProgressLogScreen';

import AttendanceHistoryScreen from '../screens/member/AttendanceHistoryScreen';
import InsightsScreen from '../screens/member/InsightsScreen';
import LeaderboardScreen from '../screens/member/LeaderboardScreen';

import WorkoutDetailScreen from '../screens/member/WorkoutDetailScreen';
import DietDetailScreen from '../screens/member/DietDetailScreen';
import AIWorkoutScreen from '../screens/member/AIWorkoutScreen';
import AIDietScreen from '../screens/member/AIDietScreen';

import SupplementDetailScreen from '../screens/member/SupplementDetailScreen';
import CartScreen from '../screens/member/CartScreen';
import OrderHistoryScreen from '../screens/member/OrderHistoryScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createStackNavigator();
const ProfileStack = createStackNavigator();
const AttendanceStack = createStackNavigator();
const PlansStack = createStackNavigator();
const StoreStack = createStackNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Home: 'home',
  Attendance: 'calendar',
  Plans: 'dumbbell',
  Store: 'shopping-cart',
  Profile: 'user',
};

/** Icon-only tab: line icon that lifts + glows when focused, orange dot slides in under it. */
function TabIcon({ route, focused, color }: { route: string; focused: boolean; color: string }) {
  const count = useCartStore((s) => s.count());
  const showBadge = route === 'Store' && count > 0;
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
      {showBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
      <Animated.View style={[styles.dot, dotAnim]} />
    </View>
  );
}

// Home gets its own stack so Phase 4 (Run / RunDetail) can push screens without
// touching the tab structure again.
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={MemberHomeScreen} />
      <HomeStack.Screen name="Run" component={RunScreen} />
      <HomeStack.Screen name="RunDetail" component={RunDetailScreen} />
    </HomeStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="MyMembership" component={MyMembershipScreen} />
      <ProfileStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="MembershipRenewal" component={MembershipRenewalScreen} />
      <ProfileStack.Screen name="Messages" component={MessagesScreen} />
      <ProfileStack.Screen name="ChatContacts" component={ChatContactsScreen} />
      <ProfileStack.Screen name="DirectChat" component={DirectChatScreen} />
      <ProfileStack.Screen name="SuperAdminChat" component={SuperAdminChatScreen} />
      <ProfileStack.Screen name="Gamification" component={GamificationScreen} />
      <ProfileStack.Screen name="Referrals" component={ReferralsScreen} />
      <ProfileStack.Screen name="MyTrainer" component={MyTrainerScreen} />
      <ProfileStack.Screen name="ProgressLog" component={ProgressLogScreen} />
    </ProfileStack.Navigator>
  );
}

function AttendanceStackNavigator() {
  return (
    <AttendanceStack.Navigator screenOptions={{ headerShown: false }}>
      <AttendanceStack.Screen name="AttendanceMain" component={AttendanceScreen} />
      <AttendanceStack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
      <AttendanceStack.Screen name="Insights" component={InsightsScreen} />
      <AttendanceStack.Screen name="Leaderboard" component={LeaderboardScreen} />
    </AttendanceStack.Navigator>
  );
}

function PlansStackNavigator() {
  return (
    <PlansStack.Navigator screenOptions={{ headerShown: false }}>
      <PlansStack.Screen name="PlansMain" component={PlansScreen} />
      <PlansStack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} />
      <PlansStack.Screen name="DietDetail" component={DietDetailScreen} />
      <PlansStack.Screen name="AIWorkout" component={AIWorkoutScreen} />
      <PlansStack.Screen name="AIDiet" component={AIDietScreen} />
    </PlansStack.Navigator>
  );
}

function StoreStackNavigator() {
  return (
    <StoreStack.Navigator screenOptions={{ headerShown: false }}>
      <StoreStack.Screen name="StoreMain" component={StoreScreen} />
      <StoreStack.Screen name="SupplementDetail" component={SupplementDetailScreen} />
      <StoreStack.Screen name="Cart" component={CartScreen} />
      <StoreStack.Screen name="OrderHistory" component={OrderHistoryScreen} />
    </StoreStack.Navigator>
  );
}

export default function MemberTabs() {
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
          // Lift the bar off the page a touch (Android: elevation, iOS: shadow).
          shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 12,
        },
        tabBarIcon: ({ focused, color }) => <TabIcon route={route.name} focused={focused} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Attendance" component={AttendanceStackNavigator} />
      <Tab.Screen name="Plans" component={PlansStackNavigator} />
      <Tab.Screen name="Store" component={StoreStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', justifyContent: 'center', width: 48, height: 44 },
  halo: { position: 'absolute', top: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: tint(colors.primary, '1F') },
  dot: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginTop: 6 },
  badge: {
    position: 'absolute', top: -2, right: 2,
    backgroundColor: colors.primary, borderRadius: radius.pill,
    minWidth: 16, height: 16, paddingHorizontal: 3,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
});
