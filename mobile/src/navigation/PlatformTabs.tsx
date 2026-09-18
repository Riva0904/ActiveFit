import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, PressScale, type IconName } from '../components';
import { Text } from '../components/Text';
import { useGymScope } from '../hooks/useGymScope';
import { colors, radius, spacing, tint, typography } from '../theme';

import PlatformDashboardScreen from '../screens/platform/PlatformDashboardScreen';
import GymsScreen from '../screens/platform/GymsScreen';
import GymDetailScreen from '../screens/platform/GymDetailScreen';
import ApprovalsScreen from '../screens/platform/ApprovalsScreen';
import RevenueScreen from '../screens/platform/RevenueScreen';
import SaaSPlansScreen from '../screens/platform/SaaSPlansScreen';
import SaaSPlanEditScreen from '../screens/platform/SaaSPlanEditScreen';
import PlatformSettingsScreen from '../screens/platform/PlatformSettingsScreen';
import SuperAdminChatScreen from '../screens/member/SuperAdminChatScreen';

import ProfileScreen from '../screens/member/ProfileScreen';
import EditProfileScreen from '../screens/member/EditProfileScreen';
import ChangePasswordScreen from '../screens/member/ChangePasswordScreen';
import NotificationsScreen from '../screens/member/NotificationsScreen';

import AdminTabs from './AdminTabs';

const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();
const GymsStack = createStackNavigator();
const RevenueStack = createStackNavigator();
const ProfileStack = createStackNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Overview: 'grid',
  Gyms: 'bank-outline',
  Approvals: 'inbox',
  Revenue: 'cash-multiple',
  Support: 'headphones',
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

function GymsStackNavigator() {
  return (
    <GymsStack.Navigator screenOptions={{ headerShown: false }}>
      <GymsStack.Screen name="GymsMain" component={GymsScreen} />
      <GymsStack.Screen name="GymDetail" component={GymDetailScreen} />
    </GymsStack.Navigator>
  );
}

function RevenueStackNavigator() {
  return (
    <RevenueStack.Navigator screenOptions={{ headerShown: false }}>
      <RevenueStack.Screen name="RevenueMain" component={RevenueScreen} />
      <RevenueStack.Screen name="SaaSPlans" component={SaaSPlansScreen} />
      <RevenueStack.Screen name="SaaSPlanEdit" component={SaaSPlanEditScreen} />
    </RevenueStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="PlatformSettings" component={PlatformSettingsScreen} />
      <ProfileStack.Screen name="SuperAdminChat" component={SuperAdminChatScreen} />
    </ProfileStack.Navigator>
  );
}

function PlatformTabNavigator() {
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
      <Tab.Screen name="Overview" component={PlatformDashboardScreen} />
      <Tab.Screen name="Gyms" component={GymsStackNavigator} />
      <Tab.Screen name="Approvals" component={ApprovalsScreen} />
      <Tab.Screen name="Revenue" component={RevenueStackNavigator} />
      <Tab.Screen name="Support" component={SuperAdminChatScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

/**
 * While the platform owner is inside a gym, this bar states whose data is on
 * screen. Without it, two gyms look identical and the wrong books get edited.
 */
function ScopeBanner({ navigation }: any) {
  const { gymName, exitGym } = useGymScope();
  return (
    <View style={styles.banner}>
      <Icon name="bank-outline" size={15} color={colors.primary} />
      <Text style={styles.bannerText} numberOfLines={1}>Viewing {gymName ?? 'a gym'}</Text>
      <PressScale
        style={styles.exitBtn}
        onPress={() => { exitGym(); navigation.goBack(); }}
      >
        <Text style={styles.exitText}>Exit</Text>
      </PressScale>
    </View>
  );
}

function GymScopeScreen({ navigation }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScopeBanner navigation={navigation} />
      <AdminTabs />
    </View>
  );
}

/**
 * The platform owner's app. They have no gym of their own, so the gym-scoped
 * admin tabs only make sense once they pick one — which is what GymScope is.
 */
export default function PlatformTabs() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="PlatformRoot" component={PlatformTabNavigator} />
      <RootStack.Screen name="GymScope" component={GymScopeScreen} />
    </RootStack.Navigator>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', justifyContent: 'center', width: 48, height: 44 },
  halo: { position: 'absolute', top: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: tint(colors.primary, '1F') },
  dot: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginTop: 6 },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: tint(colors.primary, '1F'),
    borderBottomWidth: 1, borderBottomColor: colors.surfaceRaised,
    paddingHorizontal: spacing.screen, paddingTop: 48, paddingBottom: spacing.sm,
  },
  bannerText: { color: colors.text, ...typography.caption, fontWeight: '700', flex: 1 },
  exitBtn: {
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: colors.border,
  },
  exitText: { color: colors.primary, ...typography.micro, fontWeight: '800' },
});
