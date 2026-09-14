import React from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button, Card, EmptyState, Header, Loading, Screen, SectionTitle } from '../../components';
import { colors, spacing, typography } from '../../theme';

export default function ReferralsScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api.get('/referrals/my') as any,
  });

  const code: string = (data as any)?.referralCode ?? '';
  const credits: number = (data as any)?.referralCredit ?? 0;
  const history: any[] = (data as any)?.referrals ?? [];

  async function share() {
    try {
      await Share.share({
        message: `Join my gym with code ${code} and get a discount on your first membership! Download ActiveBoost app to get started.`,
        title: 'Join my gym!',
      });
    } catch {}
  }

  return (
    <Screen scroll>
      <Header title="Referrals" subtitle="Invite friends, earn credits" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <Card accent="primary" style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your referral code</Text>
            <Text style={styles.code}>{code || '—'}</Text>
            <Text style={styles.credits}>Credits earned: ₹{Number(credits).toLocaleString('en-IN')}</Text>
            <View style={styles.btnRow}>
              <Button title="Copy" variant="secondary" icon="copy" style={{ flex: 1 }} onPress={() => Alert.alert('Referral Code', code, [{ text: 'OK' }])} />
              <Button title="Share" icon="share-2" style={{ flex: 1 }} onPress={share} />
            </View>
          </Card>

          <SectionTitle title="Referral history" />
          {history.length === 0 ? (
            <EmptyState icon="gift" title="No referrals yet" subtitle="Share your code to earn credits" />
          ) : (
            <Card padding="none">
              {history.map((r: any, i: number) => (
                <View key={i} style={[styles.historyRow, i < history.length - 1 && styles.rowBorder]}>
                  <Text style={styles.historyName}>{r.referred?.firstName} {r.referred?.lastName}</Text>
                  <Text style={styles.historyDate}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : ''}</Text>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  codeLabel: { color: colors.textSecondary, ...typography.label, marginBottom: spacing.md },
  code: { color: colors.primary, fontSize: 32, fontWeight: '800', letterSpacing: 6, marginBottom: spacing.sm, ...typography.number },
  credits: { color: colors.success, ...typography.label, fontWeight: '600', marginBottom: spacing.xl },
  btnRow: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  historyName: { color: colors.text, ...typography.body },
  historyDate: { color: colors.textMuted, ...typography.label },
});
