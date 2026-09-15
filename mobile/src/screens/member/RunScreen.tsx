import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { api } from '../../lib/api';
import { formatDistance, formatDuration, formatPace } from '../../lib/run';
import { useRunTracker } from '../../hooks/useRunTracker';
import { Button, Card, Header, HeroStat, Icon, Screen, StatRow } from '../../components';
import { RunMap } from '../../components/widgets/RunMap';
import { colors, spacing, typography } from '../../theme';

export default function RunScreen({ navigation }: any) {
  useKeepAwake();
  const queryClient = useQueryClient();
  const run = useRunTracker();
  const [saving, setSaving] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (body: any) => api.post('/activities/runs', body) as any,
    onSuccess: (saved: any) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['my-points'] });
      navigation.replace('RunDetail', { id: saved.id });
    },
    onError: (e: any) => { setSaving(false); Alert.alert('Could not save run', e?.message ?? 'Try again'); },
  });

  function finish() {
    const doStop = () => {
      const payload = run.stop();
      if (!payload || payload.distanceMeters < 20) {
        Alert.alert('Run too short', 'Nothing worth saving yet — move at least 20 m.', [{ text: 'Discard', style: 'destructive', onPress: () => { run.reset(); navigation.goBack(); } }, { text: 'Keep going', onPress: () => run.resume() }]);
        return;
      }
      setSaving(true);
      saveMutation.mutate(payload);
    };
    Alert.alert('Finish run?', `${formatDistance(run.distanceMeters)} · ${formatDuration(run.elapsedSec)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish & save', onPress: doStop },
    ]);
  }

  function leave() {
    if (run.status === 'idle' || run.status === 'finished') return navigation.goBack();
    Alert.alert('Discard run?', 'Your current run will be lost.', [
      { text: 'Keep tracking', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { run.reset(); navigation.goBack(); } },
    ]);
  }

  const active = run.status === 'running' || run.status === 'paused';

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header
          title="Run"
          subtitle={
            run.status === 'running' ? (run.hasFix ? 'Tracking…' : 'Waiting for GPS — head outdoors')
            : run.status === 'paused' ? 'Paused'
            : 'Foreground GPS · keep the app open'
          }
          onBack={leave}
        />
      </View>

      <RunMap route={run.points} live={run.status === 'running'} style={styles.map} />

      <View style={styles.panelPad}>
        <Card style={styles.panel}>
          <HeroStat value={formatDistance(run.distanceMeters)} label="Distance" />
          <StatRow style={styles.stats} items={[
            { label: 'Time', value: formatDuration(run.elapsedSec) },
            { label: 'Pace', value: formatPace(run.paceSecPerKm), unit: '/km' },
            { label: 'Points', value: run.points.length },
          ]} />
          {run.error ? (
            <View style={styles.errorRow}><Icon name="alert-circle" size={16} color={colors.danger} /><Text style={styles.errorText}>{run.error}</Text></View>
          ) : null}

          {run.status === 'idle' || run.status === 'requesting' || run.status === 'finished' ? (
            <Button title="Start run" size="lg" icon="play" onPress={() => run.start()} loading={run.status === 'requesting' || saving} />
          ) : (
            <View style={styles.btnRow}>
              {run.status === 'running' ? (
                <Button title="Pause" variant="secondary" icon="pause" style={{ flex: 1 }} onPress={run.pause} />
              ) : (
                <Button title="Resume" variant="secondary" icon="play" style={{ flex: 1 }} onPress={() => run.resume()} />
              )}
              <Button title="Finish" icon="square" style={{ flex: 1 }} onPress={finish} loading={saving} disabled={!active} />
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: spacing.screen },
  map: { flex: 1, marginHorizontal: spacing.screen, borderRadius: 20 },
  panelPad: { padding: spacing.screen },
  panel: { alignItems: 'stretch', marginBottom: 0 },
  stats: { marginVertical: spacing.lg },
  btnRow: { flexDirection: 'row', gap: spacing.md },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  errorText: { color: colors.danger, ...typography.label, flex: 1 },
});
