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
        // Background run tracking: Android uses a foreground service (needs only
        // "while in use" + FOREGROUND_SERVICE_LOCATION, added by this flag — NOT
        // ACCESS_BACKGROUND_LOCATION); iOS gets UIBackgroundModes: ['location'].
        locationWhenInUsePermission: 'ActiveBoost records your run route, including while the screen is off during a run.',
        locationAlwaysAndWhenInUsePermission: 'ActiveBoost records your run route, including while the screen is off during a run.',
        isAndroidForegroundServiceEnabled: true,
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: true,
      },
    ],
  ],
  extra: {
    eas: { projectId: '6910a57c-75eb-4eee-94fe-98c2e03c34cc' },
    // Lets RunMap swap the Google MapView for an SVG route sketch when no key is baked in.
    hasGoogleMapsKey: !!process.env.GOOGLE_MAPS_ANDROID_API_KEY,
  },
  owner: 'activeboost',
} as unknown as ExpoConfig);
