import React from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Text';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
import { useCartStore } from '../../store/cartStore';
import { Button, EmptyState, Header, Icon, Loading, Screen } from '../../components';
import { colors, radius, spacing, tint, typography } from '../../theme';

export default function SupplementDetailScreen({ route, navigation }: any) {
  const { supplementId: id } = route.params;
  const addItem = useCartStore((s) => s.addItem);
  const insets = useSafeAreaInsets();

  const { data: item, isLoading } = useQuery({
    queryKey: ['supplement', id],
    queryFn: () => api.get(`/supplements/${id}`) as any,
  });

  function addToCart() {
    if (!item) return;
    addItem({ id: item.id, name: item.name, price: item.price, discountPrice: item.discountPrice, category: item.category });
    Alert.alert('Added to cart', `${item.name} added`, [
      { text: 'Continue shopping', style: 'cancel' },
      { text: 'View cart', onPress: () => navigation.navigate('Cart') },
    ]);
  }

  const img = Array.isArray(item?.images) && item.images[0];
  const hasDiscount = item?.discountPrice && item.discountPrice < item.price;

  return (
    <View style={{ flex: 1 }}>
      <Screen scroll contentContainerStyle={{ paddingBottom: 120 }}>
        <Header title={item?.name ?? route.params?.supplementName ?? 'Product'} onBack={() => navigation.goBack()} />

        {isLoading ? (
          <Loading />
        ) : !item ? (
          <EmptyState icon="package" title="Product not found" />
        ) : (
          <>
            <View style={styles.image}>
              {img ? <Image source={{ uri: img }} style={styles.imageReal} resizeMode="cover" /> : <Icon name="pill" size={64} color={colors.textFaint} />}
            </View>
            <Text style={styles.category}>{item.category}{item.brand ? ` · ${item.brand}` : ''}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{Number(hasDiscount ? item.discountPrice : item.price).toLocaleString('en-IN')}</Text>
              {hasDiscount ? (
                <>
                  <Text style={styles.originalPrice}>₹{Number(item.price).toLocaleString('en-IN')}</Text>
                  <View style={styles.discountBadge}><Text style={styles.discountText}>{Math.round((1 - item.discountPrice / item.price) * 100)}% OFF</Text></View>
                </>
              ) : null}
            </View>
            {item.stock !== undefined ? (
              <Text style={[styles.stock, item.stock === 0 && { color: colors.danger }]}>{item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}{item.weight ? ` · ${item.weight}` : ''}</Text>
            ) : null}
            {item.description ? (<><Text style={styles.sectionTitle}>Description</Text><Text style={styles.desc}>{item.description}</Text></>) : null}
            {item.benefits ? (<><Text style={styles.sectionTitle}>Benefits</Text><Text style={styles.desc}>{item.benefits}</Text></>) : null}
          </>
        )}
      </Screen>

      {item ? (
        <View style={[styles.footer, { paddingBottom: spacing.xl + insets.bottom }]}>
          <Button title={item.stock === 0 ? 'Out of stock' : 'Add to cart'} size="lg" icon="shopping-cart" onPress={addToCart} disabled={item.stock === 0} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface, height: 220, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.surfaceRaised },
  imageReal: { width: '100%', height: '100%' },
  category: { color: colors.primary, ...typography.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  price: { color: colors.text, fontSize: 28, fontWeight: '800', ...typography.number },
  originalPrice: { color: colors.textMuted, ...typography.body, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: tint(colors.success, '22'), borderRadius: radius.sm - 2, paddingHorizontal: 7, paddingVertical: 2 },
  discountText: { color: colors.success, ...typography.micro, fontWeight: '700' },
  stock: { color: colors.textSecondary, ...typography.label, marginBottom: spacing.lg },
  sectionTitle: { color: colors.text, ...typography.body, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.lg },
  desc: { color: colors.textSecondary, ...typography.body, lineHeight: 22 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
});
