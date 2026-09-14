import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, spacing, tint, typography } from '../theme';

// ─── StatPill: dot + value + label, used in header rows ─────────────────────

export function StatPill({ label, value, color = colors.primary }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={[styles.pill, { borderColor: tint(color, '40') }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View>
        <Text style={[styles.pillValue, { color }]} numberOfLines={1}>{value}</Text>
        <Text style={styles.pillLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ─── StatRow: "67 889 | 11 km | 234 kcal" with vertical dividers ────────────

export interface StatItem { label: string; value: string | number; unit?: string; color?: string }

export function StatRow({ items, style }: { items: StatItem[]; style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]}>
      {items.map((it, i) => (
        <View key={it.label} style={[styles.rowItem, i > 0 && styles.rowDivider]}>
          <Text style={[styles.rowValue, it.color ? { color: it.color } : null]} numberOfLines={1}>
            {it.value}
            {it.unit ? <Text style={styles.rowUnit}> {it.unit}</Text> : null}
          </Text>
          <Text style={styles.rowLabel} numberOfLines={1}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── HeroStat: the big number ("45 kg") ─────────────────────────────────────

export function HeroStat({ value, unit, label, color = colors.primary, align = 'center' }:
  { value: string | number; unit?: string; label?: string; color?: string; align?: 'center' | 'left' }) {
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Text style={[styles.hero, { color }]}>
        {value}
        {unit ? <Text style={styles.heroUnit}> {unit}</Text> : null}
      </Text>
      {label ? <Text style={styles.heroLabel}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillValue: { ...typography.label, ...typography.number, maxWidth: 140 },
  pillLabel: { color: colors.textMuted, ...typography.micro },

  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  rowDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  rowValue: { color: colors.text, ...typography.h2, ...typography.number },
  rowUnit: { color: colors.textSecondary, ...typography.caption, fontWeight: '600' },
  rowLabel: { color: colors.textMuted, ...typography.micro, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  hero: { ...typography.hero },
  heroUnit: { color: colors.textSecondary, fontSize: 18, fontWeight: '600', letterSpacing: 0 },
  heroLabel: { color: colors.textSecondary, ...typography.label, marginTop: spacing.xs },
});
