import React, { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { colors, radius, shadow, spacing, tint, typography } from '../theme';

// ─── SectionTitle ───────────────────────────────────────────────────────────

export function SectionTitle({ title, action, style }: { title: string; action?: { label: string; onPress: () => void }; style?: ViewStyle }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.section}>{title}</Text>
      {action ? (
        <TouchableOpacity onPress={action.onPress} hitSlop={8}>
          <Text style={styles.sectionAction}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── ListRow ────────────────────────────────────────────────────────────────

interface ListRowProps {
  label: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  right?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}

export function ListRow({ label, subtitle, icon, iconColor, right, chevron, onPress, danger, last }: ListRowProps) {
  const color = danger ? colors.danger : iconColor ?? colors.primary;
  const Wrapper: any = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={[styles.row, !last && styles.rowBorder]} onPress={onPress} activeOpacity={0.7}>
      {icon ? (
        <View style={[styles.iconCircle, { backgroundColor: tint(color) }]}>
          <Icon name={icon} size={18} color={color} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]} numberOfLines={1}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" size={18} color={colors.textFaint} /> : null}
    </Wrapper>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

export function Avatar({ uri, firstName, lastName, size = 44, ring }: { uri?: string | null; firstName?: string; lastName?: string; size?: number; ring?: boolean }) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const dim = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: 2, borderColor: colors.primary } : null;
  if (uri) return <Image source={{ uri }} style={[dim, ringStyle]} />;
  return (
    <View style={[dim, ringStyle, styles.avatarFallback]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

// ─── EmptyState ─────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, subtitle, action }: { icon: IconName; title: string; subtitle?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name={icon} size={28} color={colors.textMuted} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
      {action ? (
        <TouchableOpacity onPress={action.onPress} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Loading ────────────────────────────────────────────────────────────────

export function Loading({ fullScreen, text }: { fullScreen?: boolean; text?: string }) {
  return (
    <View style={fullScreen ? styles.loadingFull : styles.loading}>
      <ActivityIndicator color={colors.primary} size={fullScreen ? 'large' : 'small'} />
      {text ? <Text style={styles.loadingText}>{text}</Text> : null}
    </View>
  );
}

// ─── Checkbox ───────────────────────────────────────────────────────────────

export function Checkbox({ checked, onToggle, disabled }: { checked: boolean; onToggle?: () => void; disabled?: boolean }) {
  const v = useSharedValue(checked ? 1 : 0);
  useEffect(() => { v.value = withSpring(checked ? 1 : 0, { damping: 12, stiffness: 260 }); }, [checked, v]);
  const boxAnim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], ['transparent', colors.primary]),
    borderColor: interpolateColor(v.value, [0, 1], [colors.textFaint, colors.primary]),
    transform: [{ scale: 1 + 0.08 * Math.sin(v.value * Math.PI) }],
  }));
  const tickAnim = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: v.value }] }));
  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled || !onToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      activeOpacity={0.8}
      style={disabled && { opacity: 0.5 }}
    >
      <Animated.View style={[styles.checkbox, checked && shadow.glow, boxAnim]}>
        <Animated.View style={tickAnim}><Icon name="check" size={15} color={colors.white} /></Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  section: { color: colors.textSecondary, ...typography.section },
  sectionAction: { color: colors.primary, ...typography.label, fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconCircle: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowLabel: { color: colors.text, ...typography.body, fontWeight: '600' },
  rowSub: { color: colors.textMuted, ...typography.caption, marginTop: 2 },

  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { color: colors.textSecondary, ...typography.body, fontWeight: '600', textAlign: 'center' },
  emptySub: { color: colors.textFaint, ...typography.label, textAlign: 'center' },
  emptyAction: { marginTop: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xxl, paddingVertical: 12 },
  emptyActionText: { color: colors.white, fontWeight: '700' },

  loading: { paddingVertical: 40, alignItems: 'center', gap: spacing.md },
  loadingFull: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: spacing.md },
  loadingText: { color: colors.textFaint, ...typography.label, textAlign: 'center', lineHeight: 20 },

  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.textFaint, alignItems: 'center', justifyContent: 'center' },
});
