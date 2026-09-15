import React from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { PressScale } from './Motion';
import { colors, gradients, radius, shadow, spacing, tint } from '../theme';

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

/** Primary = azure gradient + glow; secondary = glassy outlined; ghost = text; danger = tinted. */
export function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, icon, style }: ButtonProps) {
  const off = disabled || loading;
  const lg = size === 'lg';
  const content = loading ? (
    <ActivityIndicator color={FG[variant]} />
  ) : (
    <View style={styles.inner}>
      {icon ? <Icon name={icon} size={lg ? 20 : 18} color={FG[variant]} /> : null}
      <Text style={[styles.text, lg && styles.textLg, { color: FG[variant] }]}>{title}</Text>
    </View>
  );

  return (
    <PressScale
      onPress={onPress}
      disabled={off}
      scaleTo={0.95}
      accessibilityRole="button"
      style={[
        styles.outer,
        lg && styles.outerLg,
        { backgroundColor: BG[variant] },
        variant === 'primary' && !off && shadow.glow,
        variant === 'secondary' && styles.outlined,
        off && styles.off,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={[...gradients.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fill, lg && styles.fillLg]}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, lg && styles.fillLg]}>{content}</View>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: radius.md, overflow: 'hidden' },
  outerLg: { borderRadius: radius.lg },
  fill: { paddingVertical: 13, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  fillLg: { paddingVertical: 17, borderRadius: radius.lg },
  outlined: { borderWidth: 1, borderColor: colors.border },
  off: { opacity: 0.5 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontSize: 15, fontWeight: '700' },
  textLg: { fontSize: 16 },
});
