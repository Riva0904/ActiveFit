import React, { useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../lib/api';
import { can } from '../../lib/roles';
import { useGymScope } from '../../hooks/useGymScope';
import { useAuthStore } from '../../store/authStore';
import {
  Avatar, Button, Card, Enter, EmptyState, GymBadge, Header, Icon, Loading, PressScale, Screen, SectionTitle, StatRow, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

interface TodayStats { total?: number; checkedIn?: number; checkedOut?: number; present?: number }

const time = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminAttendanceScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((st) => st.user);
  // The QR kiosk is gym-admin only on the backend; staff check people in by code.
  const canScan = can(user, 'canScanQr');
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  // A scanner fires continuously; this stops one QR turning into ten check-ins.
  const lastScan = useRef<{ value: string; at: number } | null>(null);

  // Keys and params both carry the gym: for a gym admin that is their own gym
  // and nothing changes, for a super admin it is the gym they drilled into —
  // which is also what stops gym A's rows rendering under gym B's header.
  const scope = useGymScope();

  const stats = useQuery<TodayStats>({
    queryKey: scope.key(['attendance-today']),
    queryFn: () => api.get('/attendance/stats/today', { params: scope.params() }) as any,
    staleTime: 30_000,
  });

  const list = useQuery({
    queryKey: scope.key(['attendance-list']),
    queryFn: () => api.get('/attendance', { params: scope.params({ limit: 100 }) }) as any,
    staleTime: 30_000,
  });

  const refresh = () => { stats.refetch(); list.refetch(); };

  const checkIn = useMutation({
    mutationFn: (payload: { qrCode?: string; code?: string }) =>
      (payload.qrCode
        ? api.post('/attendance/qr-check-in', { qrCode: payload.qrCode })
        : api.post('/attendance/admin-manual-check-in', { code: payload.code })) as any,
    onSuccess: (res: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const name = res?.member?.user?.firstName ?? res?.user?.firstName ?? 'Member';
      const action = res?.checkOutTime ? 'checked out' : 'checked in';
      Alert.alert('Done', `${name} ${action}.`);
      setCode('');
      queryClient.invalidateQueries({ queryKey: scope.key(['attendance-today']) });
      queryClient.invalidateQueries({ queryKey: scope.key(['attendance-list']) });
    },
    onError: (e: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Check-in failed', e?.message ?? 'Try again');
    },
  });

  const onScan = ({ data }: { data: string }) => {
    const now = Date.now();
    if (lastScan.current && lastScan.current.value === data && now - lastScan.current.at < 4000) return;
    lastScan.current = { value: data, at: now };
    checkIn.mutate({ qrCode: data });
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera needed', 'Allow camera access to scan member QR codes.');
        return;
      }
    }
    setScanning(true);
  };

  const rows: any[] = Array.isArray(list.data) ? list.data : (list.data?.data ?? []);
  const s = stats.data ?? {};

  if (scanning) {
    return (
      <Screen padded={false}>
        <View style={styles.scanPad}>
          <Header title="Scan member QR" subtitle="Point at the member's code" onBack={() => setScanning(false)} />
        </View>
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={checkIn.isPending ? undefined : onScan}
          />
          <View style={styles.reticle} pointerEvents="none" />
          {checkIn.isPending && (
            <View style={styles.scanBusy}><Loading text="Checking in…" /></View>
          )}
        </View>
        <View style={styles.scanPad}>
          <Button title="Done scanning" variant="secondary" icon="check" onPress={() => setScanning(false)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header title="Attendance" subtitle="Today at your gym" eyebrow={<GymBadge />} />

        <Enter index={0}>
          <Card padding="md">
            <StatRow items={[
              { label: 'Checked in', value: s.checkedIn ?? s.present ?? 0, color: colors.success },
              { label: 'Checked out', value: s.checkedOut ?? 0 },
              { label: 'Total today', value: s.total ?? 0, color: colors.primary },
            ]} />
          </Card>
        </Enter>

        <Enter index={1}>
          {canScan ? <Button title="Scan member QR" size="lg" icon="qrcode" onPress={openScanner} /> : null}
          <View style={styles.manualRow}>
            <View style={{ flex: 1 }}>
              <TextField
                value={code}
                onChangeText={setCode}
                placeholder={canScan ? 'Or type a member code' : 'Enter the member code'}
                autoCapitalize="characters"
                onSubmitEditing={() => code.trim() && checkIn.mutate({ code: code.trim() })}
              />
            </View>
            <Button
              title="Go"
              onPress={() => code.trim() && checkIn.mutate({ code: code.trim() })}
              loading={checkIn.isPending}
              disabled={!code.trim()}
            />
          </View>
        </Enter>

        <SectionTitle title="Today's check-ins" action={{ label: 'Refresh', onPress: refresh }} />
      </View>

      {list.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => r.id ?? String(i)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="calendar-check" title="Nobody yet" subtitle="Scan a member QR to check them in" />}
          renderItem={({ item }) => {
            const u = item.member?.user ?? item.user ?? {};
            const out = !!item.checkOutTime;
            return (
              <View style={styles.row}>
                <Avatar uri={u.avatar} firstName={u.firstName} lastName={u.lastName} size={40} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{u.firstName} {u.lastName}</Text>
                  <Text style={styles.rowMeta}>
                    In {time(item.checkInTime)}{out ? ` · Out ${time(item.checkOutTime)}` : ''}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: tint(out ? colors.textMuted : colors.success, '22') }]}>
                  <Text style={[styles.pillText, { color: out ? colors.textMuted : colors.success }]}>
                    {out ? 'Left' : 'In gym'}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  scanPad: { paddingHorizontal: spacing.screen },
  manualRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.md },

  cameraWrap: { flex: 1, margin: spacing.screen, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surfaceSunken },
  reticle: {
    position: 'absolute', top: '22%', left: '12%', right: '12%', bottom: '22%',
    borderWidth: 3, borderColor: colors.primary, borderRadius: radius.xl,
  },
  scanBusy: { ...StyleSheet.absoluteFill as object, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },

  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.h2 },
  rowMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  pill: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { ...typography.micro, fontWeight: '700' },
});
