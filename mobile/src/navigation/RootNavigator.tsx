import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';
import { Loading } from '../components';
import { navTheme } from '../theme/navigation';

import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import MemberTabs from './MemberTabs';
import TrainerTabs from './TrainerTabs';

const Stack = createStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator({ role }: { role: string }) {
  if (role === 'TRAINER') return <TrainerTabs />;
  // MEMBER, STAFF — member app UI
  return <MemberTabs />;
}

export default function RootNavigator() {
  const { user, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  if (isLoading) return <Loading fullScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <AppNavigator role={user.role} /> : <AuthStack />}
    </NavigationContainer>
  );
}
