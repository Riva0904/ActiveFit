import React, { useMemo, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Avatar, Button, Card, Chip, ChipRow, EmptyState, Enter, Header, Icon,
  Loading, Screen, SectionTitle, StatRow,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface MemberAttendance {
  member: { id: string; firstName: string; lastName: string; avatar?: string | null; memberCode?: string | null } | null;
  currentStreak: number;
  bestStreak: number;
  daysSinceLastVisit: number;
  visitsThisMonth: number;
  presentDates: string[];
  avgDuration: number | null;
  recent: { id: string; checkInTime: string; checkOutTime: string | null; durationMinutes: number | null }[];
}

interface ProgressLog {
  id: string;
  weight?: number | null;
  bodyFat?: number | null;
  bmi?: number | null;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  photos?: string[];
  notes?: string | null;
  logDate?: string;
  createdAt?: string;
}

const dayNum = (iso: string) => new Date(iso).getDate();
const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

/**
 * One member, for their trainer: are they turning up, and is their body
 * changing.
 *
 * Both reads are new — `/attendance/member/:id` and `/progress-logs/member/:id`
 * — and both are refused by the server unless this member is actually assigned
 * to the caller, so a 403 here is the expected answer for someone else's member.
 */
export default function TrainerMemberDetailScreen({ route, navigation }: any) {
  const memberId: string = route.params?.memberId;
  const seed = route.params?.member ?? {};
  const [tab, setTab] = useState<'attendance' | 'progress'>('attendance');

  const attendanceQ = useQuery<MemberAttendance>({
    queryKey: ['member-attendance', memberId],
    queryFn: () => api.get(`/attendance/member/${memberId}`) as any,
    enabled: !!memberId,
  });

  const progressQ = useQuery<ProgressLog[]>({
    queryKey: ['member-progress', memberId],
    queryFn: () => api.get(`/progress-logs/member/${memberId}`) as any,
    enabled: !!memberId,
  });

  const logs = Array.isArray(progressQ.data) ? progressQ.data : [];
  const a = attendanceQ.data;

  // Oldest and newest photo sets, for the before/after compare.
  const withPhotos = useMemo(() => logs.filter((l) => (l.photos?.length ?? 0) > 0), [logs]);
  const before = withPhotos[withPhotos.length - 1];
  const after = withPhotos[0];

  // `logs` arrive newest-first; the trend reads left to right in time order.
  const weights = useMemo(
    () => [...logs].reverse().filter((l) => typeof l.weight === 'number'),
    [logs],
  );
  const weightDelta =
    weights.length >= 2 ? (weights[weights.length - 1].weight! - weights[0].weight!) : null;

  const denied =
    (attendanceQ.error as any)?.statusCode === 403 || (progressQ.error as any)?.statusCode === 403;

  if (denied) {
    return (
      <Screen scroll>
        <Header title={route.params?.name ?? 'Member'} onBack={() => navigation.goBack()} />
        <EmptyState
          icon="lock"
          title="Not your member"
          subtitle="You can only see members your gym admin has assigned to you."
        />
      </Screen>
    );
  }

  if (attendanceQ.isLoading && progressQ.isLoading) return <Loading fullScreen />;

  const person = a?.member ?? seed.user ?? {};

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={attendanceQ.isRefetching || progressQ.isRefetching}
          onRefresh={() => { attendanceQ.refetch(); progressQ.refetch(); }}
          tintColor={colors.primary}
        />
      }
    >
      <Header
        title={`${person.firstName ?? ''} ${person.lastName ?? ''}`.trim() || 'Member'}
        subtitle={a?.member?.memberCode ?? seed.memberCode ?? undefined}
        onBack={() => navigation.goBack()}
      />

      <Enter index={0}>
        <Card style={styles.hero}>
          <Avatar uri={person.avatar} firstName={person.firstName} lastName={person.lastName} size={64} ring />
          <StatRow style={styles.heroStats} items={[
            { label: 'Streak', value: a?.currentStreak ?? 0, unit: (a?.currentStreak ?? 0) === 1 ? 'day' : 'days', color: colors.primary },
            { label: 'This month', value: a?.visitsThisMonth ?? 0, unit: 'visits' },
            { label: 'Last seen', value: a ? (a.daysSinceLastVisit === 0 ? 'Today' : `${a.daysSinceLastVisit}d`) : '—', color: (a?.daysSinceLastVisit ?? 0) >= 7 ? colors.warning : undefined },
          ]} />
        </Card>
      </Enter>

      <ChipRow>
        <Chip label="Attendance" selected={tab === 'attendance'} onPress={() => setTab('attendance')} />
        <Chip label="Transformation" selected={tab === 'progress'} onPress={() => setTab('progress')} />
      </ChipRow>

      {tab === 'attendance' ? (
        <>
          <SectionTitle title="This month" />
          <Card padding="md">
            {(a?.presentDates.length ?? 0) === 0 ? (
              <Text style={styles.empty}>No visits recorded this month.</Text>
            ) : (
              <View style={styles.dayGrid}>
                {a!.presentDates.map((d) => (
                  <View key={d} style={styles.dayPill}>
                    <Text style={styles.dayText}>{dayNum(d)}</Text>
                  </View>
                ))}
              </View>
            )}
            <StatRow style={styles.stats} items={[
              { label: 'Best streak', value: a?.bestStreak ?? 0, unit: 'days' },
              { label: 'Avg session', value: a?.avgDuration ?? '—', unit: a?.avgDuration ? 'min' : undefined },
            ]} />
          </Card>

          <SectionTitle title="Recent visits" />
          {(a?.recent.length ?? 0) === 0 ? (
            <Card padding="md"><Text style={styles.empty}>Nothing logged yet.</Text></Card>
          ) : (
            <Card padding="none">
              {a!.recent.map((r, i) => (
                <View key={r.id} style={[styles.visitRow, i < a!.recent.length - 1 && styles.divider]}>
                  <Icon name="calendar-check" size={16} color={colors.primary} />
                  <Text style={styles.visitDate}>
                    {new Date(r.checkInTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  <Text style={styles.visitMeta}>
                    {new Date(r.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {r.durationMinutes ? ` · ${r.durationMinutes} min` : r.checkOutTime ? '' : ' · still in'}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
      ) : (
        <>
          {before && after && before.id !== after.id ? (
            <>
              <SectionTitle title="Before & after" />
              <Card padding="md">
                <View style={styles.compareRow}>
                  <ComparePane label={shortDate(before.logDate ?? before.createdAt)} uri={before.photos![0]} weight={before.weight} />
                  <Icon name="chevron-right" size={20} color={colors.textMuted} />
                  <ComparePane label={shortDate(after.logDate ?? after.createdAt)} uri={after.photos![0]} weight={after.weight} />
                </View>
              </Card>
            </>
          ) : null}

          <SectionTitle title="Weight" />
          <Card padding="md">
            {weights.length === 0 ? (
              <Text style={styles.empty}>No weight logged yet.</Text>
            ) : (
              <>
                <View style={styles.weightTop}>
                  <Text style={styles.weightNow}>{weights[weights.length - 1].weight} kg</Text>
                  {weightDelta !== null && weightDelta !== 0 ? (
                    <View style={[styles.deltaChip, { backgroundColor: tint(weightDelta < 0 ? colors.success : colors.warning, '1F') }]}>
                      <Text style={[styles.deltaText, { color: weightDelta < 0 ? colors.success : colors.warning }]}>
                        {weightDelta > 0 ? '+' : ''}{weightDelta.toFixed(1)} kg
                      </Text>
                    </View>
                  ) : null}
                </View>
                <WeightTrend points={weights.map((l) => l.weight!)} />
              </>
            )}
          </Card>

          <SectionTitle title="Measurements" />
          {logs.length === 0 ? (
            <Card padding="md"><Text style={styles.empty}>This member has not logged anything yet.</Text></Card>
          ) : (
            logs.slice(0, 10).map((log) => (
              <Card key={log.id} padding="md">
                <Text style={styles.logDate}>{shortDate(log.logDate ?? log.createdAt)}</Text>
                <View style={styles.metricsRow}>
                  {log.weight != null ? <Metric label="Weight" value={`${log.weight} kg`} highlight /> : null}
                  {log.bodyFat != null ? <Metric label="Body fat" value={`${log.bodyFat}%`} /> : null}
                  {log.bmi != null ? <Metric label="BMI" value={`${log.bmi}`} /> : null}
                  {log.chest != null ? <Metric label="Chest" value={`${log.chest} cm`} /> : null}
                  {log.waist != null ? <Metric label="Waist" value={`${log.waist} cm`} /> : null}
                  {log.hips != null ? <Metric label="Hips" value={`${log.hips} cm`} /> : null}
                </View>
                {log.photos?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                    {log.photos.map((p) => (
                      <Image key={p} source={{ uri: p }} style={styles.photo} resizeMode="cover" />
                    ))}
                  </ScrollView>
                ) : null}
                {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
              </Card>
            ))
          )}
        </>
      )}

      <Button
        title="Create a plan for this member"
        icon="clipboard-text-outline"
        style={styles.planBtn}
        onPress={() => navigation.navigate('Plans', { screen: 'PlanAssign', params: { memberId } })}
      />
    </Screen>
  );
}

function ComparePane({ label, uri, weight }: { label: string; uri: string; weight?: number | null }) {
  return (
    <View style={styles.comparePane}>
      <Image source={{ uri }} style={styles.compareImage} resizeMode="cover" />
      <Text style={styles.compareLabel}>{label}</Text>
      {weight != null ? <Text style={styles.compareWeight}>{weight} kg</Text> : null}
    </View>
  );
}

/** Minimal sparkline: enough to see the direction, without a chart library. */
function WeightTrend({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(0.1, max - min);
  return (
    <View style={styles.trend}>
      {points.slice(-12).map((p, i) => (
        <View key={i} style={styles.trendCol}>
          <View style={[styles.trendBar, { height: `${20 + ((p - min) / span) * 80}%` }]} />
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, highlight && { color: colors.primary }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  heroStats: { marginTop: spacing.lg, alignSelf: 'stretch' },
  stats: { marginTop: spacing.lg },
  empty: { color: colors.textMuted, ...typography.caption },

  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dayPill: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: tint(colors.primary, '1F'),
    alignItems: 'center', justifyContent: 'center',
  },
  dayText: { color: colors.primary, ...typography.caption, fontWeight: '800' },

  visitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  visitDate: { color: colors.text, ...typography.caption, fontWeight: '600', flex: 1 },
  visitMeta: { color: colors.textMuted, ...typography.micro },

  compareRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  comparePane: { flex: 1, alignItems: 'center', gap: 4 },
  compareImage: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  compareLabel: { color: colors.textMuted, ...typography.micro },
  compareWeight: { color: colors.text, ...typography.caption, fontWeight: '700' },

  weightTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  weightNow: { color: colors.text, ...typography.title, ...typography.number },
  deltaChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  deltaText: { ...typography.micro, fontWeight: '800' },

  trend: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 4 },
  trendCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  trendBar: { backgroundColor: colors.primary, borderRadius: 2, minHeight: 3 },

  logDate: { color: colors.textSecondary, ...typography.caption, fontWeight: '600', marginBottom: spacing.sm },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  metric: { alignItems: 'flex-start', minWidth: 64 },
  metricValue: { color: colors.text, ...typography.body, fontWeight: '700', ...typography.number },
  metricLabel: { color: colors.textMuted, ...typography.micro },
  photoRow: { marginTop: spacing.md },
  photo: { width: 90, height: 120, borderRadius: radius.md, marginRight: spacing.sm, backgroundColor: colors.surfaceRaised },
  logNotes: { color: colors.textMuted, ...typography.caption, marginTop: spacing.sm },

  planBtn: { marginTop: spacing.xl },
});
