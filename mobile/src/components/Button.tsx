import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { PressScale } from './Motion';
import { colors, radius, shadow, spacing, tint } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: ViewStyle;
}

const BG: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  ghost: 'transparent',
  danger: tint(colors.danger, '22'),
};
const FG: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.text,
  ghost: colors.primary,
  danger: colors.danger,
};

export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, icon, style }: ButtonProps) {
  const off = disabled || loading;
  return (
    <PressScale
      onPress={onPress}
      disabled={off}
      scaleTo={0.95}
      accessibilityRole="button"
      style={[
        styles.base,
        size === 'lg' && styles.lg,
        { backgroundColor: BG[variant] },
        variant === 'primary' && !off && shadow.glow,
        variant === 'secondary' && styles.outlined,
        off && styles.off,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Icon name={icon} size={size === 'lg' ? 20 : 18} color={FG[variant]} /> : null}
          <Text style={[styles.text, size === 'lg' && styles.textLg, { color: FG[variant] }]}>{title}</Text>
        </View>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  lg: { borderRadius: radius.lg, paddingVertical: 17 },
  outlined: { borderWidth: 1, borderColor: colors.border },
  off: { opacity: 0.5 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontSize: 15, fontWeight: '700' },
  textLg: { fontSize: 16 },
});
