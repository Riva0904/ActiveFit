import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useCartStore } from '../../store/cartStore';
import { api } from '../../lib/api';
import { useMutation } from '@tanstack/react-query';

export default function CartScreen({ navigation }: any) {
  const { items, removeItem, updateQty, clear, total, count } = useCartStore();
  const [upiId, setUpiId] = useState('');
  const [showUpi, setShowUpi] = useState(false);

  const checkoutMutation = useMutation({
    mutationFn: (body: any) => api.post('/supplements/checkout', body) as any,
    onSuccess: (data: any) => {
      if (data?.upiQr || data?.upiId) {
        Alert.alert(
          'UPI Payment',
          `Pay ₹${total().toFixed(0)} to UPI ID: ${data.upiId ?? 'gym UPI ID'}\n\nAfter payment, tap Confirm.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Mark Paid',
              onPress: () => {
                clear();
                navigation.navigate('OrderHistory');
                Alert.alert('Order placed!', 'Admin will confirm your payment shortly');
              },
            },
          ],
        );
      } else {
        clear();
        navigation.navigate('OrderHistory');
        Alert.alert('Order placed!', 'Your supplement order is confirmed');
      }
    },
    onError: (e: any) => Alert.alert('Checkout failed', e?.message ?? 'Try again'),
  });

  function checkout() {
    const body = {
      items: items.map((i) => ({ supplementId: i.id, quantity: i.quantity })),
      paymentMethod: 'UPI',
    };
    checkoutMutation.mutate(body);
  }

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
          <Text style={styles.title}>Cart</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 64 }}>🛒</Text>
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('StoreMain')}>
            <Text style={styles.shopBtnText}>Browse Supplements</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Cart ({count()} items)</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 160 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{(item.discountPrice ?? item.price) * item.quantity}</Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity - 1)}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyNum}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity + 1)}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => removeItem(item.id)} style={{ padding: 6 }}>
              <Text style={{ color: '#EF4444', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₹{total().toFixed(0)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={checkout}
          disabled={checkoutMutation.isPending}
        >
          {checkoutMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.checkoutBtnText}>Place Order</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingTop: 56, paddingHorizontal: 20, marginBottom: 16 },
  back: { color: '#FF4D00', fontSize: 16, marginBottom: 10 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
  shopBtn: { backgroundColor: '#FF4D00', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  shopBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  itemName: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemPrice: { color: '#FF4D00', fontSize: 14, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { color: '#F9FAFB', fontSize: 18, fontWeight: '700' },
  qtyNum: { color: '#F9FAFB', fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#141414', padding: 20,
    borderTopWidth: 1, borderTopColor: '#2A2A2A',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  totalLabel: { color: '#9CA3AF', fontSize: 16 },
  totalAmount: { color: '#F9FAFB', fontSize: 20, fontWeight: '800' },
  checkoutBtn: {
    backgroundColor: '#FF4D00', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
