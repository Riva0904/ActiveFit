import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';

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

import EditProfileScreen from '../screens/member/EditProfileScreen';
import ChangePasswordScreen from '../screens/member/ChangePasswordScreen';

const Tab = createBottomTabNavigator();
const SessionsStack = createStackNavigator();
const ProfileStack = createStackNavigator();

const ORANGE = '#FF4D00';
const GRAY = '#9CA3AF';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠', Members: '👥', Sessions: '🏋️', Attendance: '📅', Profile: '👤',
  };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>;
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: { paddingBottom: 4, paddingTop: 4, height: 60, backgroundColor: '#0F0F0F', borderTopColor: '#1A1A1A' },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={TrainerHomeScreen} />
      <Tab.Screen name="Members" component={TrainerMembersScreen} />
      <Tab.Screen name="Sessions" component={SessionsStackNavigator} />
      <Tab.Screen name="Attendance" component={TrainerAttendanceScreen} />
      <Tab.Screen name="Profile" component={TrainerProfileStackNavigator} />
    </Tab.Navigator>
  );
}
