import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, Share, Alert, Clipboard,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function ReferralsScreen({ navigation }: any) {
  const { data, isLoading } = useQuery({
    queryKey: ['referrals'],
    queryFn: () => api.get('/referrals/my') as any,
  });

  const code: string = (data as any)?.referralCode ?? '';
  const credits: number = (data as any)?.credits ?? 0;
  const history: any[] = (data as any)?.referrals ?? [];

  async function share() {
    try {
      await Share.share({
        message: `Join my gym with code ${code} and get a discount on your first membership! Download ActiveBoost app to get started.`,
        title: 'Join my gym!',
      });
    } catch {}
  }

  function copy() {
    Clipboard.setString(code);
    Alert.alert('Copied!', `Referral code ${code} copied to clipboard`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Referrals 🎁</Text>
      </View>

      {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 40 }} /> : (
        <>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <Text style={styles.code}>{code || '—'}</Text>
            <Text style={styles.creditsText}>Credits earned: ₹{credits}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btn} onPress={copy}>
                <Text style={styles.btnText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnAccent]} onPress={share}>
                <Text style={[styles.btnText, { color: '#fff' }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Referral History</Text>
          {history.length === 0 ? (
            <Text style={styles.empty}>No referrals yet. Share your code to earn credits!</Text>
          ) : history.map((r: any, i: number) => (
            <View key={i} style={styles.historyRow}>
              <Text style={styles.historyName}>{r.referred?.firstName} {r.referred?.lastName}</Text>
              <Text style={styles.historyDate}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : ''}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 24 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  codeCard: {
    margin: 20, backgroundColor: '#1A1A1A', borderRadius: 16,
    padding: 24, borderWidth: 1, borderColor: '#FF4D00', alignItems: 'center',
  },
  codeLabel: { color: '#9CA3AF', fontSize: 13, marginBottom: 12 },
  code: { color: '#FF4D00', fontSize: 32, fontWeight: '800', letterSpacing: 6, marginBottom: 8 },
  creditsText: { color: '#22C55E', fontSize: 14, fontWeight: '600', marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: '#3A3A3A',
  },
  btnAccent: { backgroundColor: '#FF4D00', borderColor: '#FF4D00' },
  btnText: { color: '#F9FAFB', fontWeight: '600', fontSize: 14 },
  sectionTitle: { color: '#E5E7EB', fontSize: 15, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  historyName: { color: '#F9FAFB', fontSize: 14 },
  historyDate: { color: '#6B7280', fontSize: 13 },
  empty: { color: '#4B5563', fontSize: 13, paddingHorizontal: 20, textAlign: 'center' },
});
