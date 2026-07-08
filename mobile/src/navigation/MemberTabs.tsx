import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View } from 'react-native';
import { useCartStore } from '../store/cartStore';

import MemberHomeScreen from '../screens/member/HomeScreen';
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
import ChatScreen from '../screens/member/ChatScreen';
import SuperAdminChatScreen from '../screens/member/SuperAdminChatScreen';
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
const ProfileStack = createStackNavigator();
const AttendanceStack = createStackNavigator();
const PlansStack = createStackNavigator();
const StoreStack = createStackNavigator();

const ORANGE = '#FF4D00';
const GRAY = '#9CA3AF';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠', Attendance: '📅', Plans: '💪', Store: '🛒', Profile: '👤',
  };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>;
}

function CartIcon({ focused }: { focused: boolean }) {
  const count = useCartStore((s) => s.count());
  return (
    <View>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>🛒</Text>
      {count > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -6,
          backgroundColor: ORANGE, borderRadius: 8,
          minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{count}</Text>
        </View>
      )}
    </View>
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
      <ProfileStack.Screen name="Chat" component={ChatScreen} />
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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: GRAY,
        tabBarStyle: { paddingBottom: 4, paddingTop: 4, height: 60, backgroundColor: '#0F0F0F', borderTopColor: '#1A1A1A' },
        tabBarIcon: ({ focused }) =>
          route.name === 'Store'
            ? <CartIcon focused={focused} />
            : <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={MemberHomeScreen} />
      <Tab.Screen name="Attendance" component={AttendanceStackNavigator} />
      <Tab.Screen name="Plans" component={PlansStackNavigator} />
      <Tab.Screen name="Store" component={StoreStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}
