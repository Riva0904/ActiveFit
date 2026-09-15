import React from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Avatar, Button, Card, Enter, Header, Icon, ListRow, Loading, Screen, SectionTitle, StatRow,
} from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function PersonDetailScreen({ route, navigation }: any) {
  const person = route.params?.person ?? {};
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin-person', person.id],
    queryFn: () => api.get(`/users/${person.id}`) as any,
    enabled: !!person.id,
  });

  const toggleActive = useMutation({
    mutationFn: () => api.patch(`/users/${person.id}/${person.isActive ? 'deactivate' : 'activate'}`) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-people'] });
      queryClient.invalidateQueries({ queryKey: ['admin-person', person.id] });
      navigation.goBack();
    },
    onError: (e: any) => Alert.alert('Could not update', e?.message ?? 'Try again'),
  });

  const u = { ...person, ...(detail ?? {}) };
  const membership = u.memberships?.[0] ?? detail?.memberships?.[0];

  const confirmToggle = () => {
    const off = u.isActive;
    Alert.alert(
      off ? 'Deactivate account?' : 'Activate account?',
      off ? `${u.firstName} will not be able to log in or check in.` : `${u.firstName} will regain access.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: off ? 'Deactivate' : 'Activate', style: off ? 'destructive' : 'default', onPress: () => toggleActive.mutate() },
      ],
    );
  };

  if (isLoading && !person.id) return <Loading fullScreen />;

  return (
    <Screen scroll>
      <Header title={`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()} subtitle={u.role} onBack={() => navigation.goBack()} />

      <Enter index={0}>
        <Card style={styles.hero}>
          <Avatar uri={u.avatar} firstName={u.firstName} lastName={u.lastName} size={72} ring />
          <Text style={styles.name}>{u.firstName} {u.lastName}</Text>
          {u.memberCode ? <Text style={styles.code}>{u.memberCode}</Text> : null}
          <View style={[styles.statusPill, { backgroundColor: u.isActive ? colors.success + '22' : colors.danger + '22' }]}>
            <Text style={[styles.statusText, { color: u.isActive ? colors.success : colors.danger }]}>
              {u.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </Card>
      </Enter>

      {membership && (
        <Enter index={1}>
          <SectionTitle title="Membership" />
          <Card>
            <StatRow items={[
              { label: 'Plan', value: membership.plan?.name ?? '—' },
              { label: 'Status', value: membership.status ?? '—', color: membership.status === 'ACTIVE' ? colors.success : colors.warning },
              { label: 'Ends', value: membership.endDate ? new Date(membership.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—' },
            ]} />
          </Card>
        </Enter>
      )}

      <Enter index={2}>
        <SectionTitle title="Contact" />
        <Card padding="none">
          <ListRow
            icon="mail"
            iconColor={colors.info}
            label="Email"
            subtitle={u.email}
            onPress={u.email ? () => Linking.openURL(`mailto:${u.email}`) : undefined}
          />
          <ListRow
            icon="smartphone"
            iconColor={colors.success}
            label="Phone"
            subtitle={u.phone ?? 'Not provided'}
            onPress={u.phone ? () => Linking.openURL(`tel:${u.phone}`) : undefined}
            last
          />
        </Card>
      </Enter>

      <Enter index={3}>
        <Button
          title={u.isActive ? 'Deactivate account' : 'Activate account'}
          variant={u.isActive ? 'danger' : 'primary'}
          icon={u.isActive ? 'user-x' : 'user-check'}
          onPress={confirmToggle}
          loading={toggleActive.isPending}
          style={{ marginTop: spacing.md }}
        />
        <Text style={styles.hint}>Editing details and adding people is done from the web dashboard.</Text>
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  name: { color: colors.text, ...typography.title, marginTop: spacing.sm },
  code: { color: colors.primary, ...typography.label, fontWeight: '700', letterSpacing: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: spacing.xs },
  statusText: { ...typography.caption, fontWeight: '700' },
  hint: { color: colors.textFaint, ...typography.caption, textAlign: 'center', marginTop: spacing.md },
});
