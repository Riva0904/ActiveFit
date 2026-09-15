import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Card, Chip, ChipRow, EmptyState, Header, Icon, Loading, PressScale, Screen, SectionTitle,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

type Kind = 'workout' | 'diet';

interface Plan {
  id: string; name: string; goal?: string; difficulty?: string; isPremium: boolean; price?: number;
  exercises?: any[]; meals?: any[]; _count?: { assignments: number };
}

export default function AdminPlansScreen({ navigation }: any) {
  const [kind, setKind] = useState<Kind>('workout');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['admin-plans', kind],
    queryFn: () => api.get(`/${kind}-plans/manage/all`) as any,
  });

  const plans: Plan[] = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header title="Plans" subtitle="Workout and diet plans for your members" />

        <ChipRow>
          <Chip label="Workout" selected={kind === 'workout'} onPress={() => setKind('workout')} />
          <Chip label="Diet" selected={kind === 'diet'} onPress={() => setKind('diet')} />
        </ChipRow>

        <SectionTitle title={`${plans.length} plan${plans.length === 1 ? '' : 's'}`} />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon={kind === 'workout' ? 'dumbbell' : 'food-apple-outline'}
              title={`No ${kind} plans yet`}
              subtitle="Build plans on the web dashboard, then assign them here."
            />
          }
          renderItem={({ item }) => {
            const units = kind === 'workout' ? item.exercises?.length ?? 0 : item.meals?.length ?? 0;
            const days = kind === 'workout' ? new Set((item.exercises ?? []).map((e: any) => e.day)).size : 0;
            return (
              <PressScale
                style={styles.row}
                scaleTo={0.98}
                onPress={() => navigation.navigate('PlanAssign', { kind, plan: item })}
              >
                <View style={[styles.rowIcon, { backgroundColor: tint(kind === 'workout' ? colors.purple : colors.success, '22') }]}>
                  <Icon name={kind === 'workout' ? 'dumbbell' : 'food-apple-outline'} size={18} color={kind === 'workout' ? colors.purple : colors.success} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {kind === 'workout'
                      ? `${days} days · ${units} exercises`
                      : `${units} meals`}
                    {' · '}{item._count?.assignments ?? 0} assigned
                  </Text>
                </View>
                {item.isPremium ? (
                  <View style={styles.premium}>
                    <Text style={styles.premiumText}>{item.price ? `₹${item.price}` : 'PRO'}</Text>
                  </View>
                ) : null}
                <Icon name="chevron-right" size={18} color={colors.textFaint} />
              </PressScale>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.surfaceRaised,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, ...typography.h2 },
  rowMeta: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
  premium: { backgroundColor: tint(colors.primary, '22'), borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  premiumText: { color: colors.primary, ...typography.micro, fontWeight: '800' },
});
