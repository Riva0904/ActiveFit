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

/**
 * Registers this device for push, once the user is known.
 *
 * Previously this was called only from the member and trainer Home screens, so
 * gym admins, staff and super admins never registered a device at all — every
 * notification aimed at them went nowhere.
 *
 * `enabled` exists so the caller can wait for hydration rather than asking for
 * notification permission on the login screen.
 */
export function usePushToken(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    registerToken().catch(() => {});
  }, [enabled]);
}

/**
 * Android shows nothing for a data-only channel-less notification on API 26+.
 * Safe to call repeatedly — creating an existing channel is a no-op.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'ActiveBoost',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  }).catch(() => {});
}

async function registerToken() {
  await ensureAndroidChannel();

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

/**
 * Opens the right screen when a push is tapped. Without this a notification did
 * nothing at all beyond bringing the app to the foreground.
 *
 * `navigate` is passed in rather than imported so this stays free of a
 * navigation-ref singleton.
 */
export function usePushResponse(navigate: (screen: string, params?: any) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      // The server tags every notification with its `type`; anything unknown
      // falls through to the notifications list rather than crashing.
      switch (data.type) {
        case 'CHAT':
          navigate('Messages');
          break;
        case 'WINBACK':
        case 'ATTENDANCE':
          navigate('Attendance');
          break;
        case 'MEMBERSHIP_EXPIRY':
        case 'PAYMENT_DUE':
          navigate('Profile', { screen: 'MembershipRenewal' });
          break;
        default:
          navigate('Profile', { screen: 'Notifications' });
      }
    });
    return () => sub.remove();
  }, [navigate, enabled]);
}
