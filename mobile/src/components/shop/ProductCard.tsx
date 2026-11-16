import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Heart, Plus } from '@/components/icons';
import { Skeleton, Text } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useToast } from '@/context/ToastContext';
import { formatSAR } from '@/domain';
import { tap } from '@/lib/haptics';
import { colors, radii, shadows } from '@/theme/theme';
import type { Product } from '@/types/api';

/** Heart on product photos: toggles the favourite with a short toast (same as the web). */
export function FavoriteButton({ productId, productName, size = 34 }: { productId: string; productName: string; size?: number }) {
  const { isFavorite, toggle } = useFavorites();
  const toast = useToast();
  const active = isFavorite(productId);
  return (
    <Pressable
      onPress={() => {
        const added = toggle(productId);
        tap();
        toast.show(added ? 'Saved to your favourites' : 'Removed from your favourites', { tone: 'info', duration: 1800 });
      }}
      accessibilityRole="button"
      accessibilityLabel={active ? `Remove ${productName} from favourites` : `Save ${productName} to favourites`}
      accessibilityState={{ selected: active }}
      hitSlop={6}
      style={({ pressed }) => [styles.heart, { width: size, height: size, borderRadius: size / 2 }, pressed && styles.pressedSmall]}
    >
      <Heart size={Math.round(size * 0.55)} color={colors.maroon} strokeWidth={1.9} fill={active ? colors.maroon : 'none'} />
    </Pressable>
  );
}

/** Product card (PDF screens 07/08): photo, heart, name, meta, price, "+" quick add. */
export const ProductCard = memo(function ProductCard({ product, width }: { product: Product; width: number }) {
  const router = useRouter();
  const { add } = useCart();
  const toast = useToast();
  const price = formatSAR(product.price, { decimals: 0 });

  const quickAdd = () => {
    add(product.id, 1);
    tap();
    toast.show(`${product.name} added to your cart`, { action: { label: 'View cart', onPress: () => router.push(ROUTES.cart) } });
  };

  return (
    <Pressable
      onPress={() => router.push(ROUTES.product(product.id))}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${price}`}
      style={({ pressed }) => [styles.card, { width }, pressed && shadows.float]}
    >
      <View style={[styles.photo, { height: (width * 158) / 167 }]}>
        {product.images[0] ? (
          <Image
            source={{ uri: product.images[0] }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            recyclingKey={product.id}
          />
        ) : null}
        <View style={styles.heartSpot}>
          <FavoriteButton productId={product.id} productName={product.name} />
        </View>
      </View>
      <View style={styles.body}>
        <Text weight={600} numberOfLines={2} style={styles.name}>
          {product.name}
        </Text>
        {product.meta ? (
          <Text variant="label" weight={400} color="muted" style={styles.meta} numberOfLines={1}>
            {product.meta}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text weight={700} color="maroon" style={styles.price}>
            {price}
          </Text>
          <Pressable
            onPress={quickAdd}
            accessibilityRole="button"
            accessibilityLabel={`Add ${product.name} to cart`}
            hitSlop={6}
            style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
          >
            <Plus size={20} color={colors.white} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

export function ProductCardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.card, { width }]}>
      <Skeleton style={{ height: (width * 158) / 167, borderRadius: 0 }} />
      <View style={[styles.body, styles.skeletonBody]}>
        <Skeleton style={styles.skelLine} />
        <Skeleton style={styles.skelShort} />
        <View style={styles.footer}>
          <Skeleton style={styles.skelPrice} />
          <Skeleton style={styles.skelButton} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.lineSubtle, overflow: 'hidden' },
  photo: { backgroundColor: colors.sand },
  heartSpot: { position: 'absolute', top: 8, right: 8 },
  heart: { backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  pressedSmall: { transform: [{ scale: 0.9 }] },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  name: { fontSize: 15, lineHeight: 20 },
  meta: { marginTop: 2 },
  footer: { marginTop: 'auto', paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  price: { fontSize: 16, lineHeight: 22 },
  add: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  addPressed: { backgroundColor: colors.maroonDark, transform: [{ scale: 0.9 }] },
  skeletonBody: { gap: 8 },
  skelLine: { height: 16, width: '75%', borderRadius: 4 },
  skelShort: { height: 12, width: '50%', borderRadius: 4 },
  skelPrice: { height: 16, width: 64, borderRadius: 4 },
  skelButton: { width: 36, height: 36, borderRadius: 18 },
});
