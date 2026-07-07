import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCartStore } from '../../store/cartStore';

const CATEGORIES = ['All', 'Protein', 'Creatine', 'BCAA', 'Pre-Workout', 'Vitamins', 'Other'];

export default function StoreScreen({ navigation }: any) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const cartCount = useCartStore((s) => s.count());

  const { data: supplements, isLoading } = useQuery({
    queryKey: ['supplements'],
    queryFn: () => api.get('/supplements') as any,
  });

  const allItems: any[] = Array.isArray(supplements) ? supplements : (supplements as any)?.data ?? [];

  const items = allItems.filter((item: any) => {
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || item.category === category;
    return matchSearch && matchCat;
  });

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.header}>Supplements</Text>
        <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('Cart')}>
          <Text style={styles.cartIcon}>🛒</Text>
          {cartCount > 0 && (
            <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.orderHistoryBtn} onPress={() => navigation.navigate('OrderHistory')}>
        <Text style={styles.orderHistoryText}>My Orders</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search supplements…"
        placeholderTextColor="#4B5563"
      />

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, marginBottom: 16 }}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.catChip, category === cat && styles.catChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        )}
        style={{ flexGrow: 0 }}
      />

      {isLoading ? (
        <ActivityIndicator color="#FF4D00" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>No supplements found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('SupplementDetail', { supplementId: item.id, supplementName: item.name })}
              activeOpacity={0.7}
            >
              <View style={styles.imgPlaceholder}>
                <Text style={{ fontSize: 32 }}>💊</Text>
              </View>
              {item.stock != null && item.stock < 5 && item.stock > 0 && (
                <Text style={styles.lowStock}>Only {item.stock} left</Text>
              )}
              {item.stock === 0 && <Text style={styles.outOfStock}>Out of stock</Text>}
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.catLabel}>{item.category}</Text>
              <Text style={styles.price}>
                {item.discountPrice && item.discountPrice < item.price
                  ? `₹${item.discountPrice}`
                  : `₹${item.price}`}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, marginBottom: 8,
  },
  header: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  cartBtn: { position: 'relative', padding: 4 },
  cartIcon: { fontSize: 24 },
  cartBadge: {
    position: 'absolute', top: -2, right: -4,
    backgroundColor: '#FF4D00', borderRadius: 8,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  orderHistoryBtn: { alignSelf: 'flex-end', marginHorizontal: 20, marginBottom: 10 },
  orderHistoryText: { color: '#FF4D00', fontSize: 13, fontWeight: '600' },
  searchInput: {
    marginHorizontal: 20, marginBottom: 12, backgroundColor: '#1A1A1A',
    borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
    color: '#F9FAFB', fontSize: 14, paddingHorizontal: 16, paddingVertical: 10,
  },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  catChipActive: { backgroundColor: '#FF4D00', borderColor: '#FF4D00' },
  catText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  catTextActive: { color: '#fff' },
  empty: { color: '#4B5563', fontSize: 13, paddingHorizontal: 20 },
  card: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#2A2A2A',
  },
  imgPlaceholder: {
    backgroundColor: '#262626', borderRadius: 10, height: 80,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  lowStock: { color: '#F59E0B', fontSize: 10, marginBottom: 2 },
  outOfStock: { color: '#EF4444', fontSize: 10, marginBottom: 2 },
  name: { color: '#F9FAFB', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  catLabel: { color: '#9CA3AF', fontSize: 11, marginBottom: 6 },
  price: { color: '#FF4D00', fontSize: 15, fontWeight: '700' },
});
