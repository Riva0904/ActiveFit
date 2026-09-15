import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing, tint } from '../theme';
import { Enter, PressScale } from './Motion';

type Accent = 'primary' | 'danger' | 'success' | 'warning' | 'muted';
const ACCENT_BORDER: Record<Accent, string> = {
  primary: tint(colors.primary, '50'),
  danger: tint(colors.danger, '50'),
  success: tint(colors.success, '50'),
  warning: tint(colors.warning, '50'),
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
  /** Orange halo + tinted border — for the one card that should draw the eye. */
  glow?: boolean;
  /** Staggered fade/slide-in on mount; pass the card's position in its list. */
  enter?: number;
}

/** Surface card: dark surface, large radius, 1px raised border, one soft shadow. */
export function Card({ children, style, padding = 'lg', accent, onPress, elevated = true, glow, enter }: CardProps) {
  const base: StyleProp<ViewStyle> = [
    styles.card,
    elevated ? shadow.card : shadow.none,
    glow && styles.glow,
    { padding: padding === 'none' ? 0 : spacing[padding] },
    accent ? { borderColor: ACCENT_BORDER[accent] } : null,
    style,
  ];

  const body = onPress ? (
    <PressScale style={base} onPress={onPress} scaleTo={0.975}>
      {children}
    </PressScale>
  ) : (
    <View style={base}>{children}</View>
  );

  if (enter === undefined) return body;
  // The animated wrapper must inherit flex sizing so cards in a row still share width.
  const flex = (StyleSheet.flatten(style) as ViewStyle | undefined)?.flex;
  return <Enter index={enter} style={flex !== undefined ? { flex } : undefined}>{body}</Enter>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    marginBottom: spacing.md,
  },
  glow: { ...shadow.glow, borderColor: tint(colors.primary, '55') },
});
