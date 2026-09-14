import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from './Icon';
import { colors, spacing, typography } from '../theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

/** Screen header: chevron back (hit-slopped), title, optional subtitle and right slot. */
export function Header({ title, subtitle, onBack, right }: HeaderProps) {
  return (
    <View style={styles.wrap}>
      {onBack && (
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron-left" size={22} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}
      <View style={styles.row}>
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xxl },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, marginLeft: -4, alignSelf: 'flex-start' },
  backText: { color: colors.primary, ...typography.body, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  titles: { flex: 1 },
  title: { color: colors.text, ...typography.title },
  subtitle: { color: colors.textSecondary, ...typography.label, marginTop: spacing.xs },
  right: { alignItems: 'flex-end' },
});
