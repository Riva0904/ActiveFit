import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Avatar, Card, EmptyState, Header, Icon, Loading, PressScale, Screen } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

/**
 * The trainer's roster. Each row now opens the member — attendance and body
 * transformation — which the app had no screen for at all.
 */
export default function TrainerMembersScreen({ navigation }: any) {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['trainer-assigned-members'],
    queryFn: () => api.get('/pt-sessions/assigned-members') as any,
  });

  const members: any[] = Array.isArray(data) ? data : (data as any)?.data ?? [];

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="My members"
          subtitle={`${members.length} assigned to you`}
        />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              title="No members assigned"
              subtitle="Your gym admin assigns members to you from their profile page."
            />
          }
          renderItem={({ item }) => (
            <PressScale
              style={styles.row}
              scaleTo={0.98}
              onPress={() =>
                navigation.navigate('TrainerMemberDetail', {
                  memberId: item.id,
                  name: `${item.user?.firstName ?? ''} ${item.user?.lastName ?? ''}`.trim(),
                  member: item,
                })
              }
            >
              <Avatar uri={item.user?.avatar} firstName={item.user?.firstName} lastName={item.user?.lastName} size={46} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.user?.firstName} {item.user?.lastName}
                </Text>
                <Text style={styles.code}>{item.memberCode}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textMuted} />
            </PressScale>
          )}
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
  body: { flex: 1, minWidth: 0 },
  name: { color: colors.text, ...typography.h2 },
  code: { color: colors.textMuted, ...typography.caption, marginTop: 2 },
});
