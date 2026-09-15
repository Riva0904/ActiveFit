/**
 * Design tokens — the single source of truth for the dark "soft UI" look.
 * Screens and components import from here; no hex literals elsewhere.
 *
 * Palette (2026-09-15): deep navy-slate ground, glassy blue-grey surfaces,
 * azure accent — modelled on the "business dashboard" reference. Every colour
 * below is checked for contrast against `bg`/`surface`: text ≥ 7:1, secondary
 * ≥ 4.5:1, muted ≥ 3:1 (labels/captions only).
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // Ground and surfaces (navy-slate, cool and slightly desaturated)
  bg: '#0E1520',
  bgDeep: '#0A0F18',          // bottom of the page gradient
  surface: '#182334',
  surfaceRaised: '#213047',   // gradient top / highlight border on cards
  surfaceSunken: '#121B29',   // inputs, wells, chart tracks
  border: '#2A3A52',

  // Accent — azure, the one brand colour
  primary: '#3B8BFF',
  primaryDark: '#1F6FE5',     // gradient bottom for buttons
  primarySoft: '#3B8BFF20',

  // Text (all on bg/surface)
  text: '#F4F7FB',
  textSecondary: '#AEBBD0',
  textMuted: '#7C8CA6',
  textFaint: '#54637E',

  // Semantic, tuned to sit on navy without buzzing
  success: '#34D399',
  danger: '#F8717A',
  warning: '#FBBF24',
  info: '#60A5FA',
  purple: '#A78BFA',
  pink: '#F472B6',
  cyan: '#22D3EE',
  gold: '#FBBF24',
  silver: '#C7CFDB',
  bronze: '#D08A4E',
  white: '#FFFFFF',
} as const;

/** Gradient stops used by Card / Button / Screen. Top → bottom. */
export const gradients = {
  card: [colors.surfaceRaised, colors.surface] as const,
  cardGlow: ['#26395A', colors.surface] as const,   // slightly bluer top for glow cards
  primary: ['#4F9BFF', colors.primaryDark] as const,
  screen: [colors.bg, colors.bgDeep] as const,
  danger: ['#FF8A93', '#E0525D'] as const,
};

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
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  h2: { fontSize: 17, fontWeight: '700' } as TextStyle,
  body: { fontSize: 15 } as TextStyle,
  label: { fontSize: 13 } as TextStyle,
  caption: { fontSize: 12 } as TextStyle,
  micro: { fontSize: 11 } as TextStyle,
  /** Small-caps eyebrow, like "MY DASHBOARD" / "BAR CHART TITLE" in the reference. */
  section: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.4 } as TextStyle,
  number: { fontWeight: '700', ...tabular } as TextStyle,
};

/**
 * "Subtle elevation": ONE soft shadow + a 1px lighter border. iOS honours shadow*,
 * Android only renders `elevation` — and only on a view with an opaque background
 * and no `overflow: 'hidden'` on the same node.
 */
export const shadow = {
  card: {
    shadowColor: '#050912',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  } as ViewStyle,
  glow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  } as ViewStyle,
  none: { shadowOpacity: 0, elevation: 0 } as ViewStyle,
};

/** Translucent tint for icon circles / accents: `tint(colors.primary)` → '#3B8BFF18'. */
export const tint = (hex: string, alpha = '18') => `${hex}${alpha}`;
