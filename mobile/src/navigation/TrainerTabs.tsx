import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components';
import { colors, spacing } from '../theme';

import TrainerHomeScreen from '../screens/trainer/HomeScreen';
import TrainerMembersScreen from '../screens/trainer/MembersScreen';
import TrainerSessionsScreen from '../screens/trainer/SessionsScreen';
import TrainerAttendanceScreen from '../screens/trainer/AttendanceScreen';
import ProfileScreen from '../screens/member/ProfileScreen';

import TrainerChatScreen from '../screens/trainer/ChatScreen';
import TrainerNotificationsScreen from '../screens/trainer/NotificationsScreen';
import LeaveScreen from '../screens/trainer/LeaveScreen';
import SalaryScreen from '../screens/trainer/SalaryScreen';
import CreateSessionScreen from '../screens/trainer/CreateSessionScreen';
import AdminPlansScreen from '../screens/admin/PlansScreen';
import PlanAssignScreen from '../screens/admin/PlanAssignScreen';

import EditProfileScreen from '../screens/member/EditProfileScreen';
import ChangePasswordScreen from '../screens/member/ChangePasswordScreen';

const Tab = createBottomTabNavigator();
const SessionsStack = createStackNavigator();
const ProfileStack = createStackNavigator();
const PlansStack = createStackNavigator();

const TAB_ICONS: Record<string, IconName> = {
  Home: 'home', Members: 'users', Sessions: 'dumbbell', Plans: 'clipboard-text-outline', Attendance: 'calendar', Profile: 'user',
};

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  return (
    <View style={styles.tab}>
      <Icon name={TAB_ICONS[name] ?? 'home'} size={24} color={color} />
      <View style={[styles.dot, { opacity: focused ? 1 : 0 }]} />
    </View>
  );
}

// Trainers already have full plan authoring rights on the backend; this just
// surfaces them. Reuses the admin screens rather than duplicating the builder.
function PlansStackNavigator() {
  return (
    <PlansStack.Navigator screenOptions={{ headerShown: false }}>
      <PlansStack.Screen name="PlansMain" component={AdminPlansScreen} />
      <PlansStack.Screen name="PlanAssign" component={PlanAssignScreen} />
    </PlansStack.Navigator>
  );
}

function SessionsStackNavigator() {
  return (
    <SessionsStack.Navigator screenOptions={{ headerShown: false }}>
      <SessionsStack.Screen name="SessionsList" component={TrainerSessionsScreen} />
      <SessionsStack.Screen name="CreateSession" component={CreateSessionScreen} />
    </SessionsStack.Navigator>
  );
}

function TrainerProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="Chat" component={TrainerChatScreen} />
      <ProfileStack.Screen name="Notifications" component={TrainerNotificationsScreen} />
      <ProfileStack.Screen name="Leave" component={LeaveScreen} />
      <ProfileStack.Screen name="Salary" component={SalaryScreen} />
    </ProfileStack.Navigator>
  );
}

export default function TrainerTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: spacing.sm,
        },
        tabBarIcon: ({ focused, color }) => <TabIcon name={route.name} focused={focused} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={TrainerHomeScreen} />
      <Tab.Screen name="Members" component={TrainerMembersScreen} />
      <Tab.Screen name="Sessions" component={SessionsStackNavigator} />
      <Tab.Screen name="Plans" component={PlansStackNavigator} />
      <Tab.Screen name="Attendance" component={TrainerAttendanceScreen} />
      <Tab.Screen name="Profile" component={TrainerProfileStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', justifyContent: 'center', width: 44, height: 40 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 4 },
});
