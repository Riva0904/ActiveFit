import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Replaces app.json so the Android Google Maps key can come from the environment
 * (EAS secret `GOOGLE_MAPS_ANDROID_API_KEY` for preview/production, `mobile/.env` locally)
 * instead of being committed. iOS uses Apple Maps and needs no key.
 */
// `splash` and the Android shrink flags are honoured at build time but have dropped
// out of the ExpoConfig TS type in SDK 57 — hence the cast on the way out.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ActiveBoost',
  slug: 'activeboost-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: { backgroundColor: '#0E1520' },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.activeboost.mobile',
    infoPlist: {
      NSCameraUsageDescription: 'Camera is used to scan QR codes at the gym entrance.',
      NSPhotoLibraryUsageDescription: 'Photo library is used to upload profile photos and chat attachments.',
    },
  },
  // Cast: the two release-shrinking flags are honoured by the Android prebuild but
  // are not part of ExpoConfig['android']'s type.
  android: {
    package: 'com.activeboost.mobile',
    enableProguardInReleaseBuilds: true,
    enableShrinkResourcesInReleaseBuilds: true,
    adaptiveIcon: {
      backgroundColor: '#0E1520',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
    ],
    config: {
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? '' },
    },
  } as ExpoConfig['android'],
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-secure-store',
    'expo-notifications',
    [
      'expo-location',
      {
        // Foreground-only v1: no background modes, no ACCESS_BACKGROUND_LOCATION.
        locationWhenInUsePermission: 'ActiveBoost records your run route while the app is open.',
        locationAlwaysAndWhenInUsePermission: 'ActiveBoost records your run route while the app is open.',
      },
    ],
  ],
  extra: { eas: { projectId: '6910a57c-75eb-4eee-94fe-98c2e03c34cc' } },
  owner: 'activeboost',
} as unknown as ExpoConfig);
