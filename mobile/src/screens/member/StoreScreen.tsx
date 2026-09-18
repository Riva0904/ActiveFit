import React, { useState } from 'react';
import { FlatList, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCartStore } from '../../store/cartStore';
import { Chip, EmptyState, Header, Icon, Loading, Screen, TextField } from '../../components';
import { colors, radius, shadow, spacing, tint, typography } from '../../theme';

const CATEGORIES = ['All', 'Protein', 'Creatine', 'BCAA', 'Pre-Workout', 'Vitamins', 'Other'];

export default function StoreScreen({ navigation }: any) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const cartCount = useCartStore((s) => s.count());

  const { data: supplements, isLoading } = useQuery({
    queryKey: ['supplements'],
    queryFn: () => api.get('/supplements') as any,
  });

  // Items a gym admin picked out for this member specifically. Private ones are
  // invisible in the main catalogue, so this shelf is the only place they show.
  const { data: recommended } = useQuery({
    queryKey: ['supplements', 'recommended'],
    queryFn: () => api.get('/supplements/recommended') as any,
    staleTime: 5 * 60_000,
  });
  const picks: any[] = Array.isArray(recommended) ? recommended : [];

  const allItems: any[] = Array.isArray(supplements) ? supplements : (supplements as any)?.data ?? [];
  const items = allItems.filter((item: any) => {
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || item.category?.toLowerCase() === category.toLowerCase();
    return matchSearch && matchCat;
  });

  return (
    <Screen>
      <Header
        title="Supplements"
        subtitle="Gym store"
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('OrderHistory')} hitSlop={8} style={styles.iconBtn}>
              <Icon name="package" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Cart')} hitSlop={8} style={styles.iconBtn}>
              <Icon name="shopping-cart" size={20} color={colors.text} />
              {cartCount > 0 ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View> : null}
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={colors.textFaint} style={styles.searchIcon} />
        <TextField value={search} onChangeText={setSearch} placeholder="Search supplements…" style={styles.search} />
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
        style={{ flexGrow: 0, marginHorizontal: -spacing.screen, marginBottom: spacing.lg }}
        renderItem={({ item: cat }) => <Chip label={cat} selected={category === cat} onPress={() => setCategory(cat)} />}
      />

      {picks.length > 0 && !search && category === 'All' ? (
        <View style={styles.picksWrap}>
          <Text style={styles.picksTitle}>Recommended for you</Text>
          <FlatList
            horizontal
            data={picks}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginHorizontal: -spacing.screen }}
            contentContainerStyle={styles.picksRow}
            renderItem={({ item }) => {
              const price = item.discountPrice && item.discountPrice < item.price ? item.discountPrice : item.price;
              const img = Array.isArray(item.images) && item.images[0];
              return (
                <TouchableOpacity
                  style={styles.pickCard}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('SupplementDetail', { supplementId: item.id, supplementName: item.name })}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={styles.pickImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.pickImage, styles.pickImageEmpty]}>
                      <Icon name="pill" size={22} color={colors.textFaint} />
                    </View>
                  )}
                  <Text style={styles.pickName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.pickPrice}>₹{Math.round(price).toLocaleString('en-IN')}</Text>
                  {item.recommendationNote ? (
                    <Text style={styles.pickNote} numberOfLines={2}>{item.recommendationNote}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : null}

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingBottom: 32, gap: spacing.md }}
          columnWrapperStyle={{ gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState icon="package" title="No supplements found" />}
          renderItem={({ item }) => {
            const price = item.discountPrice && item.discountPrice < item.price ? item.discountPrice : item.price;
            const img = Array.isArray(item.images) && item.images[0];
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('SupplementDetail', { supplementId: item.id, supplementName: item.name })}
                activeOpacity={0.75}
              >
                <View style={styles.img}>
                  {img ? <Image source={{ uri: img }} style={styles.imgReal} /> : <Icon name="pill" size={30} color={colors.textFaint} />}
                </View>
                {item.stock != null && item.stock < 5 && item.stock > 0 ? <Text style={styles.lowStock}>Only {item.stock} left</Text> : null}
                {item.stock === 0 ? <Text style={styles.outOfStock}>Out of stock</Text> : null}
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.catLabel}>{item.category}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{Number(price).toLocaleString('en-IN')}</Text>
                  {price !== item.price ? <Text style={styles.origPrice}>₹{Number(item.price).toLocaleString('en-IN')}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: colors.primary, borderRadius: radius.pill, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  cartBadgeText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  searchWrap: { position: 'relative', marginBottom: spacing.md },
  searchIcon: { position: 'absolute', left: 14, top: 13, zIndex: 1 },
  search: { paddingLeft: 40 },
  catRow: { paddingHorizontal: spacing.screen, gap: spacing.sm },

  picksWrap: { marginBottom: spacing.lg },
  picksTitle: { color: colors.text, ...typography.h2, marginBottom: spacing.sm },
  picksRow: { paddingHorizontal: spacing.screen, gap: spacing.md },
  pickCard: {
    width: 132, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: tint(colors.purple, '38'), gap: 4, ...shadow.card,
  },
  pickImage: { width: '100%', height: 76, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  pickImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  pickName: { color: colors.text, ...typography.caption, fontWeight: '700' },
  pickPrice: { color: colors.primary, ...typography.caption, fontWeight: '800', ...typography.number },
  pickNote: { color: colors.textMuted, ...typography.micro },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.surfaceRaised, ...shadow.card },
  img: { backgroundColor: tint(colors.white, '08'), borderRadius: radius.md, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, overflow: 'hidden' },
  imgReal: { width: '100%', height: '100%' },
  lowStock: { color: colors.warning, fontSize: 10, marginBottom: 2 },
  outOfStock: { color: colors.danger, fontSize: 10, marginBottom: 2 },
  name: { color: colors.text, ...typography.label, fontWeight: '600', marginBottom: 2 },
  catLabel: { color: colors.textMuted, ...typography.micro, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { color: colors.primary, ...typography.body, fontWeight: '700', ...typography.number },
  origPrice: { color: colors.textFaint, ...typography.micro, textDecorationLine: 'line-through' },
});
