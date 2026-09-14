import React from 'react';
import { StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing, tint } from '../theme';

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
  style?: ViewStyle | ViewStyle[];
  padding?: keyof typeof spacing | 'none';
  accent?: Accent;
  onPress?: () => void;
  /** Soft drop shadow (default on). Off for cards inside other cards. */
  elevated?: boolean;
}

/** Surface card: dark surface, large radius, 1px raised border, one soft shadow. */
export function Card({ children, style, padding = 'lg', accent, onPress, elevated = true }: CardProps) {
  const base: ViewStyle[] = [
    styles.card,
    elevated ? shadow.card : shadow.none,
    { padding: padding === 'none' ? 0 : spacing[padding] },
    accent ? { borderColor: ACCENT_BORDER[accent] } : null,
    ...(Array.isArray(style) ? style : [style]),
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <TouchableOpacity style={base} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    marginBottom: spacing.md,
  },
});
