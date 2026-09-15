import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '../Text';
import { colors, radius, spacing, tint, typography } from '../../theme';
import type { GpsQuality } from '../../lib/run';

interface GpsStatusPillProps {
  quality: GpsQuality;
  accuracy: number | null;
  /** Tracking has started but no fix has arrived yet. */
  searching?: boolean;
}

const QUALITY_COLOR: Record<GpsQuality, string> = {
  none: colors.textMuted, poor: colors.danger, ok: colors.warning, good: colors.success,
};
const BARS: Record<GpsQuality, number> = { none: 0, poor: 1, ok: 2, good: 3 };

/** "Acquiring GPS" spinner, or 3 signal bars + ±Xm once fixes arrive. */
export function GpsStatusPill({ quality, accuracy, searching }: GpsStatusPillProps) {
  const color = QUALITY_COLOR[quality];
  const lit = BARS[quality];
  const label = searching || quality === 'none'
    ? (searching ? 'Acquiring GPS' : 'No GPS')
    : `±${Math.round(accuracy ?? 0)} m`;
  return (
    <View style={[styles.pill, { borderColor: tint(color, '55') }]} accessibilityLabel={`GPS ${quality}, ${label}`}>
      {searching ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={styles.bars}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.bar, { height: 6 + i * 4, backgroundColor: i < lit ? color : colors.textFaint }]} />
          ))}
        </View>
      )}
      <Text style={[styles.label, { color: searching ? colors.textSecondary : color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  bar: { width: 4, borderRadius: 1 },
  label: { ...typography.caption, fontWeight: '700', ...typography.number },
});
