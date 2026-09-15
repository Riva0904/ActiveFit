/**
 * Design tokens — the single source of truth for the dark "soft UI" look.
 * Screens and components import from here; no hex literals elsewhere.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  bg: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceRaised: '#202020', // top-edge highlight border on cards
  border: '#2A2A2A',
  primary: '#FF4D00',
  primarySoft: '#FF4D0020',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textFaint: '#4B5563',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  purple: '#7C3AED',
  pink: '#EC4899',
  cyan: '#06B6D4',
  gold: '#FBBF24',
  silver: '#C0C4CC',
  bronze: '#CD7F32',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, screen: 20 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Inter static faces, loaded in App.tsx via @expo-google-fonts/inter. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/** Maps an RN fontWeight to the Inter face that carries it (undefined → regular). */
export function fontFor(weight?: TextStyle['fontWeight']): string | undefined {
  if (weight === undefined || weight === null) return undefined;
  const w = typeof weight === 'number' ? weight : weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight);
  if (Number.isNaN(w)) return undefined;
  if (w >= 800) return fonts.extrabold;
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography = {
  hero: { fontSize: 44, fontWeight: '800', letterSpacing: -1, ...tabular } as TextStyle,
  title: { fontSize: 22, fontWeight: '700' } as TextStyle,
  h2: { fontSize: 17, fontWeight: '700' } as TextStyle,
  body: { fontSize: 15 } as TextStyle,
  label: { fontSize: 13 } as TextStyle,
  caption: { fontSize: 12 } as TextStyle,
  micro: { fontSize: 11 } as TextStyle,
  section: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 } as TextStyle,
  number: { fontWeight: '700', ...tabular } as TextStyle,
};

/**
 * "Subtle elevation": ONE soft shadow + a 1px lighter border. iOS honours shadow*,
 * Android only renders `elevation` — and only on a view with an opaque background
 * and no `overflow: 'hidden'` on the same node.
 */
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  } as ViewStyle,
  glow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  } as ViewStyle,
  none: { shadowOpacity: 0, elevation: 0 } as ViewStyle,
};

/** Translucent tint for icon circles / accents: `tint(colors.primary)` → '#FF4D0018'. */
export const tint = (hex: string, alpha = '18') => `${hex}${alpha}`;
