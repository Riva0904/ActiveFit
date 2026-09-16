import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Modal, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { can } from '../../lib/roles';
import { useAuthStore } from '../../store/authStore';
import {
  Avatar, Button, Card, Chip, ChipRow, EmptyState, Field, Header, Icon, Loading, PressScale, Screen, SectionTitle, StatRow, TextField,
} from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

/** Matches the backend EnquiryStatus enum. */
const STATUSES = [
  { value: '', label: 'All', color: colors.textMuted },
  { value: 'NEW', label: 'New', color: colors.info },
  { value: 'CONTACTED', label: 'Contacted', color: colors.warning },
  { value: 'INTERESTED', label: 'Interested', color: colors.success },
  { value: 'CONVERTED', label: 'Joined', color: colors.primary },
  { value: 'NOT_INTERESTED', label: 'Lost', color: colors.textFaint },
];
const statusMeta = (v: string) => STATUSES.find((s) => s.value === v) ?? STATUSES[0];

const SOURCES = ['WALK_IN', 'PHONE', 'WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA'];

interface Enquiry {
  id: string; name: string; phone: string; email?: string;
  status: string; source: string; notes?: string; createdAt: string;
}

export default function EnquiriesScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Enquiry | null>(null);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['enquiries', status],
    queryFn: () => api.get('/enquiries', { params: { limit: 100, ...(status ? { status } : {}) } }) as any,
  });

  const { data: stats } = useQuery({
    queryKey: ['enquiry-stats'],
    queryFn: () => api.get('/enquiries/kanban-stats') as any,
    staleTime: 60_000,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) => api.patch(`/enquiries/${id}`, { status: next }) as any,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['enquiry-stats'] });
      setDetail(null);
    },
    onError: (e: any) => Alert.alert('Could not update', e?.message ?? 'Try again'),
  });

  const convert = useMutation({
    mutationFn: (id: string) => api.patch(`/enquiries/${id}/convert`) as any,
    onSuccess: () => {
      Alert.alert('Converted', 'They are now a member.');
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      setDetail(null);
    },
    onError: (e: any) => Alert.alert('Could not convert', e?.message ?? 'Try again'),
  });

  const enquiries: Enquiry[] = Array.isArray(data) ? data : (data?.data ?? []);
  const s: any = stats ?? {};

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enquiries;
    return enquiries.filter((e) => `${e.name} ${e.phone} ${e.email ?? ''}`.toLowerCase().includes(q));
  }, [enquiries, search]);

  return (
    <Screen padded={false}>
      <View style={styles.pad}>
        <Header
          title="Enquiries"
          subtitle="People who asked about joining"
          right={<PressScale onPress={() => setShowForm(true)} style={styles.addBtn}><Icon name="plus" size={20} color={colors.white} /></PressScale>}
        />

        <Card padding="md">
          <StatRow items={[
            { label: 'New', value: s.NEW ?? s.new ?? 0, color: colors.info },
            { label: 'Contacted', value: s.CONTACTED ?? s.contacted ?? 0, color: colors.warning },
            { label: 'Joined', value: s.CONVERTED ?? s.converted ?? 0, color: colors.success },
          ]} />
        </Card>

        <View style={styles.filters}>
          <ChipRow>
            {STATUSES.map((st) => (
              <Chip key={st.value || 'all'} label={st.label} selected={status === st.value} onPress={() => setStatus(st.value)} />
            ))}
          </ChipRow>
        </View>

        <View style={styles.searchWrap}>
          <TextField value={search} onChangeText={setSearch} placeholder="Search by name or phone" />
        </View>

        <SectionTitle title={`${filtered.length} enquir${filtered.length === 1 ? 'y' : 'ies'}`} />
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="inbox"
              title={search || status ? 'No matches' : 'No enquiries yet'}
              subtitle="Add someone who walked in or called."
              action={{ label: 'Add enquiry', onPress: () => setShowForm(true) }}
            />
          }
          renderItem={({ item }) => {
            const meta = statusMeta(item.status);
            return (
              <PressScale style={styles.row} scaleTo={0.98} onPress={() => setDetail(item)}>
                <Avatar firstName={item.name?.split(' ')[0]} lastName={item.name?.split(' ')[1]} size={40} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.phone} · {item.source?.replace(/_/g, ' ').toLowerCase()}
                  </Text>
                </View>
                <View style={[styles.pill, { backgroundColor: tint(meta.color, '22') }]}>
                  <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </PressScale>
            );
          }}
        />
      )}

      {/* Detail sheet */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{detail?.name}</Text>
            <Text style={styles.sheetSub}>{detail?.phone}{detail?.email ? ` · ${detail.email}` : ''}</Text>

            <View style={styles.contactRow}>
              <Button title="Call" icon="smartphone" style={{ flex: 1 }} onPress={() => detail?.phone && Linking.openURL(`tel:${detail.phone}`)} />
              {detail?.email ? (
                <Button title="Email" variant="secondary" icon="mail" style={{ flex: 1 }} onPress={() => Linking.openURL(`mailto:${detail.email}`)} />
              ) : null}
            </View>

            {detail?.notes ? <Text style={styles.notes}>{detail.notes}</Text> : null}

            <Field label="Move to">
              <ChipRow>
                {STATUSES.filter((st) => st.value && st.value !== 'CONVERTED').map((st) => (
                  <Chip
                    key={st.value}
                    label={st.label}
                    selected={detail?.status === st.value}
                    onPress={() => detail && setStatusMutation.mutate({ id: detail.id, next: st.value })}
                  />
                ))}
              </ChipRow>
            </Field>

            {/* Converting creates a member, so it stays with the gym admin. */}
            {can(user, 'canConvertEnquiry') && detail?.status !== 'CONVERTED' ? (
              <Button
                title="Convert to member"
                icon="user-check"
                onPress={() =>
                  Alert.alert('Convert to member?', `${detail?.name} will get a member account.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Convert', onPress: () => detail && convert.mutate(detail.id) },
                  ])
                }
                loading={convert.isPending}
              />
            ) : null}

            <Button title="Close" variant="secondary" onPress={() => setDetail(null)} />
          </View>
        </View>
      </Modal>

      <EnquiryForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: ['enquiries'] });
          queryClient.invalidateQueries({ queryKey: ['enquiry-stats'] });
        }}
      />
    </Screen>
  );
}

function EnquiryForm({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('WALK_IN');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (visible) { setName(''); setPhone(''); setEmail(''); setSource('WALK_IN'); setNotes(''); }
  }, [visible]);

  const save = useMutation({
    mutationFn: () =>
      api.post('/enquiries', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        source,
        notes: notes.trim() || undefined,
      }) as any,
    onSuccess: onSaved,
    onError: (e: any) => Alert.alert('Could not save', e?.message ?? 'Try again'),
  });

  const submit = () => {
    if (!name.trim()) return Alert.alert('Add a name');
    if (!phone.trim()) return Alert.alert('Add a phone number');
    save.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>New enquiry</Text>

          <Field label="Name"><TextField value={name} onChangeText={setName} placeholder="Who walked in?" /></Field>
          <Field label="Phone"><TextField value={phone} onChangeText={setPhone} placeholder="10-digit number" keyboardType="phone-pad" /></Field>
          <Field label="Email"><TextField value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" autoCapitalize="none" /></Field>
          <Field label="How did they hear about you?">
            <ChipRow>
              {SOURCES.map((sc) => (
                <Chip key={sc} label={sc.replace(/_/g, ' ').toLowerCase()} selected={source === sc} onPress={() => setSource(sc)} />
              ))}
            </ChipRow>
          </Field>
          <Field label="Notes"><TextField value={notes} onChangeText={setNotes} placeholder="What are they looking for?" /></Field>

          <View style={styles.sheetBtns}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
            <Button title="Save enquiry" style={{ flex: 2 }} onPress={submit} loading={save.isPending} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  filters: { marginTop: spacing.md },
  searchWrap: { marginTop: spacing.sm },

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

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.screen, paddingBottom: spacing.xxl, gap: spacing.md, maxHeight: '92%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' },
  sheetTitle: { color: colors.text, ...typography.title },
  sheetSub: { color: colors.textSecondary, ...typography.caption, marginTop: -8 },
  sheetBtns: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  contactRow: { flexDirection: 'row', gap: spacing.md },
  notes: { color: colors.textSecondary, ...typography.body },
});
