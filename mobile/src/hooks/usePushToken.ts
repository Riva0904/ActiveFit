import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '../lib/api';
import { tokenStore } from '../lib/secureStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushToken() {
  useEffect(() => {
    registerToken().catch(() => {});
  }, []);
}

async function registerToken() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const tokenData = await Notifications.getDevicePushTokenAsync();
  const token = tokenData.data;

  const stored = await tokenStore.getPushToken();
  if (stored === token) return; // already registered this token

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await api.post('/mobile/push-token', { token, platform });
  await tokenStore.setPushToken(token);
}
