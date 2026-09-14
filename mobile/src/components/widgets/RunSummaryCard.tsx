import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../Card';
import { Icon } from '../Icon';
import { StatRow } from '../Stats';
import { RunMap } from './RunMap';
import { colors, spacing, tint, typography } from '../../theme';
import { formatDistance, formatDuration, formatPace } from '../../lib/run';
import type { ActivityRun } from '../../types';

interface RunSummaryCardProps {
  run: ActivityRun | null | undefined;
  onStart: () => void;
  onPress?: () => void;
}

/** Home card: last run's route thumbnail + "Running · 8 566 m · 44:13", or a start CTA. */
export function RunSummaryCard({ run, onStart, onPress }: RunSummaryCardProps) {
  if (!run) {
    return (
      <Card onPress={onStart} accent="primary" style={styles.cta}>
        <View style={styles.ctaIcon}><Icon name="run" size={24} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Start a run</Text>
          <Text style={styles.ctaSub}>Track your route, distance and pace</Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textFaint} />
      </Card>
    );
  }

  return (
    <Card padding="none" onPress={onPress}>
      {run.route && run.route.length >= 2 ? <RunMap route={run.route} thumbnail style={styles.map} /> : null}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.runIcon}><Icon name="run" size={16} color={colors.primary} /></View>
          <Text style={styles.title}>Running</Text>
          <Text style={styles.date}>{new Date(run.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
        </View>
        <StatRow items={[
          { label: 'Distance', value: formatDistance(run.distanceMeters) },
          { label: 'Time', value: formatDuration(run.durationSec) },
          { label: 'Pace', value: formatPace(run.avgPaceSecPerKm), unit: '/km' },
        ]} />
        <TouchableOpacity onPress={onStart} style={styles.again} hitSlop={8}>
          <Icon name="play" size={14} color={colors.primary} />
          <Text style={styles.againText}>Run again</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: colors.text, ...typography.body, fontWeight: '700' },
  ctaSub: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  map: { height: 150, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  body: { padding: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  runIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: tint(colors.primary), alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, ...typography.body, fontWeight: '700', flex: 1 },
  date: { color: colors.textMuted, ...typography.caption },
  again: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginTop: spacing.md },
  againText: { color: colors.primary, ...typography.label, fontWeight: '600' },
});
