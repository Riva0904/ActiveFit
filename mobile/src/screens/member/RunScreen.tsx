import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { api } from '../../lib/api';
import { formatDistance, formatDuration, formatPace } from '../../lib/run';
import { latestWeight } from '../../lib/weight';
import { useRunTracker } from '../../hooks/useRunTracker';
import { Button, Card, Header, HeroStat, Icon, Screen, StatRow } from '../../components';
import { GpsStatusPill, RunMap } from '../../components/widgets';
import { colors, radius, spacing, tint, typography } from '../../theme';

/** Below this the GPS noise floor is larger than the run — nothing worth saving. */
const MIN_SAVE_METERS = 20;

export default function RunScreen({ navigation }: any) {
  useKeepAwake();
  const queryClient = useQueryClient();

  // Calories scale with body weight; without this every member burns as if they
  // were 70 kg. The same query backs the Progress Log screen, so it is usually
  // already warm in the cache.
  const { data: progressLogs } = useQuery({
    queryKey: ['progress-logs'],
    queryFn: () => api.get('/progress-logs/my') as any,
    staleTime: 5 * 60 * 1000,
  });
  const logs: any[] = Array.isArray(progressLogs) ? progressLogs : (progressLogs as any)?.data ?? [];
  const weightKg = latestWeight(logs) ?? undefined;

  const run = useRunTracker(weightKg);
  const [saving, setSaving] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (body: any) => api.post('/activities/runs', body) as any,
    onSuccess: (saved: any) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      queryClient.invalidateQueries({ queryKey: ['my-points'] });
      run.reset();
      navigation.replace('RunDetail', { id: saved.id });
    },
    onError: (e: any) => { setSaving(false); Alert.alert('Could not save run', e?.message ?? 'Try again'); },
  });

  function finish() {
    // The "too short" check has to happen BEFORE stop(): stop() moves the store to
    // `finished` and tears tracking down, and `resume()` only acts on a `paused`
    // run — so offering "keep going" afterwards left the GPS on while every fix
    // was discarded. Nothing is torn down on this path, so cancelling really does
    // keep the run alive.
    if (run.distanceMeters < MIN_SAVE_METERS) {
      Alert.alert(
        'Run too short to save',
        `Only ${formatDistance(run.distanceMeters)} recorded. Move at least ${MIN_SAVE_METERS} m, then finish.`,
        [
          { text: 'Keep tracking', style: 'cancel' },
          { text: 'Discard run', style: 'destructive', onPress: () => { run.reset(); navigation.goBack(); } },
        ],
      );
      return;
    }

    const doStop = () => {
      const payload = run.stop();
      if (!payload) {
        // Only reachable if the run was never started.
        run.reset();
        navigation.goBack();
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

  /** Leaving the screen never stops tracking — the run continues in the background. */
  function leave() {
    navigation.goBack();
  }

  function discard() {
    Alert.alert('Discard run?', 'Your current run will be lost.', [
      { text: 'Keep tracking', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { run.reset(); navigation.goBack(); } },
    ]);
  }

  const active = run.status === 'running' || run.status === 'paused';
  const searching = run.status === 'running' && !run.hasFix;
  const subtitle =
    run.status === 'running'
      ? (run.mode === 'background' ? 'Tracking — screen can be off' : 'Tracking — keep the app open')
      : run.status === 'paused'
      ? (run.interrupted ? 'Tracking was interrupted — resume to continue' : 'Paused')
      : 'GPS-tracked · continues in the background';

  const settingsHint = /Settings|precise|permission/i.test(run.error ?? '');

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <Header
          title="Run"
          subtitle={subtitle}
          onBack={leave}
          right={active ? <GpsStatusPill quality={run.gpsQuality} accuracy={run.gpsAccuracy} searching={searching} /> : undefined}
        />
      </View>

      <RunMap route={run.points} live={run.status === 'running'} center={run.seedCenter} style={styles.map} />

      <View style={styles.panelPad}>
        <Card style={styles.panel}>
          {run.interrupted && run.status === 'paused' ? (
            <View style={styles.banner}>
              <Icon name="alert-circle" size={16} color={colors.warning} />
              <Text style={styles.bannerText}>Run restored from {run.startedAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Tap Resume to keep tracking.</Text>
            </View>
          ) : null}

          <HeroStat value={formatDistance(run.distanceMeters)} label="Distance" />
          <StatRow style={styles.stats} items={[
            { label: 'Time', value: formatDuration(run.elapsedSec) },
            { label: 'Pace', value: formatPace(run.paceSecPerKm), unit: '/km' },
            { label: 'Points', value: run.points.length },
          ]} />

          {run.error ? (
            <View style={styles.errorRow}>
              <Icon name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{run.error}</Text>
            </View>
          ) : null}
          {settingsHint ? <Button title="Open settings" variant="secondary" icon="settings" style={styles.settingsBtn} onPress={run.openLocationSettings} /> : null}
          {run.notice ? <Text style={styles.notice}>{run.notice}</Text> : null}
          {searching ? <Text style={styles.notice}>Acquiring GPS — head outdoors with a clear view of the sky. Distance starts counting from the first good fix.</Text> : null}

          {!active ? (
            <Button title="Start run" size="lg" icon="play" onPress={() => run.start()} loading={run.status === 'requesting' || saving} />
          ) : (
            <>
              <View style={styles.btnRow}>
                {run.status === 'running' ? (
                  <Button title="Pause" variant="secondary" icon="pause" style={{ flex: 1 }} onPress={run.pause} />
                ) : (
                  <Button title="Resume" variant="secondary" icon="play" style={{ flex: 1 }} onPress={() => run.resume()} />
                )}
                <Button title="Finish" icon="square" style={{ flex: 1 }} onPress={finish} loading={saving} />
              </View>
              <Button title="Discard run" variant="ghost" onPress={discard} style={styles.discard} />
            </>
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
  discard: { marginTop: spacing.sm, alignSelf: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  errorText: { color: colors.danger, ...typography.label, flex: 1 },
  settingsBtn: { marginBottom: spacing.md },
  notice: { color: colors.textMuted, ...typography.caption, marginBottom: spacing.md, textAlign: 'center' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md,
    backgroundColor: tint(colors.warning, '18'), borderRadius: radius.md, padding: spacing.md,
  },
  bannerText: { color: colors.text, ...typography.caption, flex: 1 },
});
