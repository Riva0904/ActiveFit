import React from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCartStore } from '../../store/cartStore';
import { api } from '../../lib/api';
import { presentUpiCheckout } from '../../lib/upiPrompt';
import { Button, Card, EmptyState, Header, Icon, Screen } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

export default function CartScreen({ navigation }: any) {
  const { items, removeItem, updateQty, clear, total, count } = useCartStore();
  const insets = useSafeAreaInsets();

  // POST /supplements/checkout prices the cart server-side and, with useUpi, returns
  // { paymentId, amount, vpa, payeeName }. The SupplementOrder itself is only created
  // once the gym admin confirms the payment — so the cart is cleared only after the
  // member has marked it paid (which is what puts it in the admin's queue).
  const checkoutMutation = useMutation({
    mutationFn: (body: any) => api.post('/supplements/checkout', body) as any,
    onSuccess: (data: any) => {
      presentUpiCheckout(data, {
        note: `Supplements ${count()} items`,
        onPaid: () => {
          clear();
          navigation.navigate('OrderHistory');
          Alert.alert('Order submitted', 'Your order will appear once the gym confirms your payment.');
        },
      });
    },
    onError: (e: any) => Alert.alert('Checkout failed', e?.message ?? 'Try again'),
  });

  function checkout() {
    checkoutMutation.mutate({ items: items.map((i) => ({ supplementId: i.id, quantity: i.quantity })), useUpi: true });
  }

  if (items.length === 0) {
    return (
      <Screen>
        <Header title="Cart" onBack={() => navigation.goBack()} />
        <EmptyState icon="shopping-cart" title="Your cart is empty" action={{ label: 'Browse supplements', onPress: () => navigation.navigate('StoreMain') }} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Header title={`Cart (${count()} items)`} onBack={() => navigation.goBack()} />
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 180 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card padding="md" style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{((item.discountPrice ?? item.price) * item.quantity).toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity - 1)} hitSlop={6}>
                  <Icon name="minus" size={16} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.qtyNum}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.id, item.quantity + 1)} hitSlop={6}>
                  <Icon name="plus" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={8} style={{ padding: 4 }}>
                <Icon name="trash-2" size={18} color={colors.danger} />
              </TouchableOpacity>
            </Card>
          )}
        />
      </Screen>

      <View style={[styles.footer, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>₹{total().toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
        </View>
        <Button title="Place order · Pay via UPI" size="lg" icon="smartphone" onPress={checkout} loading={checkoutMutation.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  itemName: { color: colors.text, ...typography.label, fontWeight: '600', marginBottom: 4 },
  itemPrice: { color: colors.primary, ...typography.label, fontWeight: '700', ...typography.number },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qtyBtn: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyNum: { color: colors.text, ...typography.body, fontWeight: '700', minWidth: 20, textAlign: 'center', ...typography.number },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  totalLabel: { color: colors.textSecondary, ...typography.body },
  totalAmount: { color: colors.text, fontSize: 20, fontWeight: '800', ...typography.number },
});
