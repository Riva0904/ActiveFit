import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCartStore } from '../../store/cartStore';

export default function SupplementDetailScreen({ route, navigation }: any) {
  const { supplementId: id } = route.params;
  const addItem = useCartStore((s) => s.addItem);

  const { data: item, isLoading } = useQuery({
    queryKey: ['supplement', id],
    queryFn: () => api.get(`/supplements/${id}`) as any,
  });

  function addToCart() {
    if (!item) return;
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      discountPrice: item.discountPrice,
      category: item.category,
    });
    Alert.alert('Added to cart', `${item.name} added`, [
      { text: 'Continue Shopping', style: 'cancel' },
      { text: 'View Cart', onPress: () => navigation.navigate('Cart') },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        </View>

        {isLoading ? <ActivityIndicator color="#FF4D00" style={{ marginTop: 60 }} /> : !item ? (
          <Text style={styles.empty}>Product not found</Text>
        ) : (
          <>
            <View style={styles.imagePlaceholder}>
              <Text style={{ fontSize: 64 }}>💊</Text>
            </View>
            <View style={styles.infoSection}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.name}>{item.name}</Text>
              <View style={styles.priceRow}>
                {item.discountPrice ? (
                  <>
                    <Text style={styles.price}>₹{item.discountPrice}</Text>
                    <Text style={styles.originalPrice}>₹{item.price}</Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>
                        {Math.round((1 - item.discountPrice / item.price) * 100)}% OFF
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.price}>₹{item.price}</Text>
                )}
              </View>

              {item.stock !== undefined && (
                <Text style={styles.stock}>
                  {item.stock > 0 ? `${item.stock} in stock` : '⚠️ Out of stock'}
                </Text>
              )}

              {item.description && (
                <>
                  <Text style={styles.sectionTitle}>Description</Text>
                  <Text style={styles.desc}>{item.description}</Text>
                </>
              )}
              {item.benefits && (
                <>
                  <Text style={styles.sectionTitle}>Benefits</Text>
                  <Text style={styles.desc}>{item.benefits}</Text>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {item && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.addBtn, item.stock === 0 && styles.addBtnDisabled]}
            onPress={addToCart}
            disabled={item.stock === 0}
          >
            <Text style={styles.addBtnText}>
              {item.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20 },
  back: { color: '#FF4D00', fontSize: 16 },
  imagePlaceholder: {
    backgroundColor: '#1A1A1A', height: 200, alignItems: 'center',
    justifyContent: 'center', marginVertical: 16,
  },
  infoSection: { paddingHorizontal: 20 },
  category: { color: '#FF4D00', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  name: { color: '#F9FAFB', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  price: { color: '#FF4D00', fontSize: 26, fontWeight: '800' },
  originalPrice: { color: '#6B7280', fontSize: 16, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#22C55E', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stock: { color: '#9CA3AF', fontSize: 13, marginBottom: 20 },
  sectionTitle: { color: '#E5E7EB', fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  desc: { color: '#9CA3AF', fontSize: 14, lineHeight: 22 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0F0F0F', padding: 20,
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  addBtn: {
    backgroundColor: '#FF4D00', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  addBtnDisabled: { backgroundColor: '#374151' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  empty: { color: '#4B5563', textAlign: 'center', marginTop: 60 },
});
