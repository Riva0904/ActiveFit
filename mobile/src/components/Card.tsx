import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, shadow, spacing, tint } from '../theme';
import { Enter, PressScale } from './Motion';

type Accent = 'primary' | 'danger' | 'success' | 'warning' | 'muted';
const ACCENT_BORDER: Record<Accent, string> = {
  primary: tint(colors.primary, '66'),
  danger: tint(colors.danger, '66'),
  success: tint(colors.success, '66'),
  warning: tint(colors.warning, '66'),
  muted: colors.textFaint,
};

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing | 'none';
  accent?: Accent;
  onPress?: () => void;
  /** Soft drop shadow (default on). Off for cards inside other cards. */
  elevated?: boolean;
  /** Azure halo + tinted border — for the one card that should draw the eye. */
  glow?: boolean;
  /** Staggered fade/slide-in on mount; pass the card's position in its list. */
  enter?: number;
}

const LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'alignSelf', 'position', 'top', 'left', 'right', 'bottom', 'zIndex',
]);

/**
 * Surface card: glassy top-to-bottom gradient (lighter at the top, like the
 * reference dashboard), 1px raised border, one soft shadow.
 *
 * Structure: outer View carries layout + shadow (opaque bg so Android draws
 * elevation); inner LinearGradient carries radius/overflow/padding/content.
 */
export function Card({ children, style, padding = 'lg', accent, onPress, elevated = true, glow, enter }: CardProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (LAYOUT_KEYS.has(k) ? outer : inner)[k] = v;

  const outerStyle: StyleProp<ViewStyle> = [
    styles.outer,
    elevated ? shadow.card : shadow.none,
    glow && shadow.glow,
    outer as ViewStyle,
  ];
  const innerStyle: StyleProp<ViewStyle> = [
    styles.inner,
    { padding: padding === 'none' ? 0 : spacing[padding] },
    glow && styles.glowBorder,
    accent ? { borderColor: ACCENT_BORDER[accent] } : null,
    inner as ViewStyle,
  ];

  const surface = (
    <LinearGradient colors={glow ? [...gradients.cardGlow] : [...gradients.card]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={innerStyle}>
      {children}
    </LinearGradient>
  );

  const body = onPress ? (
    <PressScale style={outerStyle} onPress={onPress} scaleTo={0.975}>
      {surface}
    </PressScale>
  ) : (
    <View style={outerStyle}>{surface}</View>
  );

  if (enter === undefined) return body;
  const flex = outer.flex as number | undefined;
  return <Enter index={enter} style={flex !== undefined ? { flex } : undefined}>{body}</Enter>;
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.md },
  inner: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.surfaceRaised, overflow: 'hidden' },
  glowBorder: { borderColor: tint(colors.primary, '66') },
});
