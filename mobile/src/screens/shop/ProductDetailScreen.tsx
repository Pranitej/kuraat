import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { BottomBar, Screen, useScreenScrollY } from '@/components/layout';
import { ChevronLeft, Maximize, PackageSearch, ShoppingBag, ZoomIn } from '@/components/icons';
import { DeliveryFromCard } from '@/components/shop/DeliveryFromCard';
import { FavoriteButton } from '@/components/shop/ProductCard';
import { Button, Card, EmptyState, IconButton, Skeleton, Stepper, Tag, Text, TextLink } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { useAddresses } from '@/context/AddressContext';
import { useCart } from '@/context/CartContext';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/context/ToastContext';
import { formatSAR, formatWindow, quoteStockLabel } from '@/domain';
import { useGoBack } from '@/hooks';
import { useDeliveryQuote } from '@/hooks/quote';
import { tap } from '@/lib/haptics';
import { colors, layout, radii, shadows } from '@/theme/theme';
import type { Product } from '@/types/api';

/** Thumbnails over the hero (active one with a white border). */
function Thumbs({ images, active, onSelect }: { images: string[]; active: number; onSelect: (i: number) => void }) {
  return (
    <View style={styles.thumbs} accessibilityRole="tablist" accessibilityLabel="Product photos">
      {images.map((src, i) => (
        <Pressable
          key={src}
          onPress={() => onSelect(i)}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === active }}
          accessibilityLabel={`Photo ${i + 1}`}
          style={[styles.thumb, i === active ? [styles.thumbActive, shadows.float] : styles.thumbIdle]}
        >
          <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Pressable>
      ))}
    </View>
  );
}

/** Back · name · heart — slides in once the hero has scrolled away (PDF screen 10). */
function CompactHeader({ product, onBack }: { product: Product; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const scrollY = useScreenScrollY();
  const [visible, setVisible] = useState(false);
  useAnimatedReaction(
    () => (scrollY ? scrollY.get() > 300 : false),
    (now, before) => {
      if (now !== before) scheduleOnRN(setVisible, now);
    },
  );
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
    transform: [{ translateY: withTiming(visible ? 0 : -8, { duration: 200 }) }],
  }));
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[styles.compact, { paddingTop: insets.top + layout.headerTop }, style]}
    >
      <View style={styles.compactRow}>
        <IconButton icon={ChevronLeft} label="Back" iconSize={22} strokeWidth={2} onPress={onBack} />
        <Text variant="heading" numberOfLines={1} style={styles.compactTitle}>
          {product.name}
        </Text>
        <View style={styles.compactHeart}>
          <FavoriteButton productId={product.id} productName={product.name} size={44} />
        </View>
      </View>
    </Animated.View>
  );
}

function PurchaseControls({
  qty,
  setQty,
  onAdd,
  onBuy,
}: {
  qty: number;
  setQty: (n: number) => void;
  onAdd: () => void;
  onBuy: () => void;
}) {
  const { width } = useWindowDimensions();
  return (
    <View style={styles.purchase}>
      <Stepper value={qty} onChange={setQty} size="lg" />
      <Button variant="secondary" leftIcon={width >= 380 ? ShoppingBag : undefined} block onPress={onAdd} style={styles.addToCart}>
        Add to cart
      </Button>
      <Button block onPress={onBuy} style={styles.buyNow}>
        Buy now
      </Button>
    </View>
  );
}

/** 09/10 · Product detail (+ expanded description) */
export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // The gallery lives in the screen column (640 pt max on tablets), so pages are that wide.
  const width = Math.min(windowWidth, layout.maxWidth);
  const catalog = useCatalog();
  const product = catalog.getProduct(productId);
  const { loadProduct } = catalog;
  const goBack = useGoBack(ROUTES.home);
  const toast = useToast();
  const { add } = useCart();
  const { defaultAddress } = useAddresses();
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const gallery = useRef<FlatList<string>>(null);
  const { quote: delivery } = useDeliveryQuote({
    addressId: product ? defaultAddress?.id : null,
    productIds: product ? [product.id] : [],
  });

  useEffect(() => {
    loadProduct(productId);
  }, [productId, loadProduct]);

  const heroHeight = insets.top + 330;

  if (!product && catalog.status === 'loading') {
    return (
      <Screen topInset={false} gutter={0}>
        <Skeleton style={{ height: heroHeight, borderRadius: 0 }} />
        <View style={styles.loadingBody}>
          <Skeleton style={styles.loadingTitle} />
          <Skeleton style={styles.loadingLine} />
        </View>
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen contentStyle={styles.missing}>
        <EmptyState
          icon={PackageSearch}
          title="This sweet is not available"
          message="It may have been removed from our menu."
          actionLabel="Browse sweets"
          onAction={() => router.replace(ROUTES.home)}
        />
      </Screen>
    );
  }

  const images = product.images;
  const openZoom = (i = active) => router.push(ROUTES.productPhotos(product.id, i));
  const select = (i: number) => {
    setActive(i);
    gallery.current?.scrollToIndex({ index: i, animated: true });
  };

  const deliveryMeta = delivery
    ? [
        delivery.isNearest ? 'Closest to you' : `${delivery.distanceKm} km away`,
        quoteStockLabel(delivery.inStock),
        formatWindow(delivery.window.start, delivery.window.end, new Date(), { long: false }),
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const addToCart = () => {
    add(product.id, qty);
    tap();
    toast.show(`${qty} × ${product.name} added to your cart`, { action: { label: 'View cart', onPress: () => router.push(ROUTES.cart) } });
  };
  const buyNow = () => {
    add(product.id, qty);
    router.push(ROUTES.cart);
  };

  const highlightCols = Math.min(product.highlights.length, 3);

  return (
    <Screen
      topInset={false}
      gutter={0}
      bottomBar={
        <BottomBar>
          <PurchaseControls qty={qty} setQty={setQty} onAdd={addToCart} onBuy={buyNow} />
        </BottomBar>
      }
      overlay={<CompactHeader product={product} onBack={goBack} />}
    >
      {/* Gallery */}
      <View style={{ height: heroHeight, backgroundColor: colors.sand }}>
        <FlatList
          ref={gallery}
          data={images}
          keyExtractor={(src) => src}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item: src, index }) => (
            <Pressable
              onPress={() => openZoom(index)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`${product.name} — photo ${index + 1} of ${images.length}. Opens the photo viewer`}
            >
              <Image testID={`hero-photo-${index}`} source={{ uri: src }} style={{ width, height: heroHeight }} contentFit="cover" transition={150} />
            </Pressable>
          )}
        />
        <View style={[styles.heroTop, { top: insets.top + layout.headerTop }]} pointerEvents="box-none">
          <IconButton icon={ChevronLeft} label="Back" variant="overlay" iconSize={22} strokeWidth={2} onPress={goBack} />
          <View style={styles.heroActions}>
            <View style={shadows.float}>
              <FavoriteButton productId={product.id} productName={product.name} size={44} />
            </View>
            <IconButton icon={Maximize} label="View full screen" variant="overlay" onPress={() => openZoom()} />
          </View>
        </View>
        <View style={styles.heroBottom} pointerEvents="box-none">
          {images.length > 1 ? <Thumbs images={images} active={active} onSelect={select} /> : <View />}
          <Pressable
            onPress={() => openZoom()}
            accessibilityRole="button"
            accessibilityLabel={`Photo ${active + 1} of ${images.length}. Tap to zoom`}
            style={styles.zoomPill}
          >
            <ZoomIn size={16} color={colors.maroon} strokeWidth={2} />
            <Text variant="label" weight={600}>
              {active + 1} / {images.length} · Tap to zoom
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Info sheet */}
      <View style={styles.sheet}>
        <View style={styles.titleRow}>
          <Text variant="h1" accessibilityRole="header" style={styles.flex}>
            {product.name}
          </Text>
          <Text weight={700} color="maroon" style={styles.price}>
            {formatSAR(product.price, { decimals: 0 })}
          </Text>
        </View>
        {product.subtitle ? (
          <Text color="muted" style={styles.subtitle}>
            {product.subtitle}
          </Text>
        ) : null}

        {highlightCols > 0 ? (
          <View style={styles.highlights}>
            {product.highlights.map(({ label, value }) => (
              <View key={label} style={[styles.highlight, { flexBasis: `${100 / highlightCols - 3}%` }]}>
                <Text variant="label" weight={400} color="muted">
                  {label}
                </Text>
                <Text weight={700} style={styles.highlightValue} numberOfLines={1} adjustsFontSizeToFit>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {delivery ? (
          <DeliveryFromCard
            style={styles.delivery}
            branch={delivery.branch}
            meta={deliveryMeta}
            onPress={() => router.push(ROUTES.branch(delivery.branch.id))}
          />
        ) : null}

        <View style={styles.section}>
          <Text variant="h3" accessibilityRole="header">
            Description
          </Text>
          <View style={styles.description}>
            {expanded ? (
              product.description.map((p) => (
                <Text key={p} variant="body-lg" color="copy">
                  {p}
                </Text>
              ))
            ) : (
              <Text variant="body-lg" color="copy" numberOfLines={3}>
                {product.description[0]}
              </Text>
            )}
          </View>
          {!expanded ? (
            <View style={styles.readMore}>
              <TextLink role="button" onPress={() => setExpanded(true)}>
                Read more
              </TextLink>
            </View>
          ) : null}
        </View>

        {expanded ? (
          <>
            {product.details.length > 0 ? (
              <View style={styles.section}>
                <Text variant="h3" accessibilityRole="header">
                  Product details
                </Text>
                <Card style={styles.details}>
                  {product.details.map(({ key, label, value }) => (
                    <View key={key} style={styles.detailRow}>
                      <Text color="muted">{label}</Text>
                      <Text weight={600} align="right" style={styles.detailValue}>
                        {value}
                      </Text>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}

            {product.ingredients || product.allergens.length > 0 ? (
              <View style={styles.section}>
                <Text variant="h3" accessibilityRole="header">
                  Ingredients &amp; allergens
                </Text>
                {product.ingredients ? (
                  <Text variant="body-lg" color="copy" style={styles.ingredients}>
                    {product.ingredients}
                  </Text>
                ) : null}
                {product.allergens.length > 0 ? (
                  <View style={styles.allergens}>
                    {product.allergens.map((a) => (
                      <Tag key={a}>{a}</Tag>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {delivery ? <DeliveryFromCard style={styles.section} branch={delivery.branch} /> : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  missing: { paddingTop: 40 },
  loadingBody: { paddingHorizontal: 20, paddingTop: 24, gap: 12 },
  loadingTitle: { height: 28, width: '66%', borderRadius: 4 },
  loadingLine: { height: 16, width: '50%', borderRadius: 4 },
  heroTop: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  heroActions: { flexDirection: 'row', gap: 12 },
  heroBottom: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  thumbs: { flexDirection: 'row', gap: 10 },
  thumb: { width: 50, height: 50, borderRadius: radii.sm, borderWidth: 2, overflow: 'hidden' },
  thumbActive: { borderColor: colors.white },
  thumbIdle: { borderColor: 'rgba(255,255,255,0.6)', opacity: 0.9 },
  zoomPill: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
    ...shadows.float,
  },
  sheet: {
    marginTop: -28,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    backgroundColor: colors.cream,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  price: { fontSize: 22, lineHeight: 30 },
  subtitle: { marginTop: 4 },
  highlights: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  highlight: {
    flexGrow: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  highlightValue: { marginTop: 2, fontSize: 15, lineHeight: 20 },
  delivery: { marginTop: 16 },
  section: { marginTop: 24 },
  description: { marginTop: 8, gap: 12 },
  readMore: { marginTop: 8, alignSelf: 'flex-start' },
  details: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingVertical: 8 },
  detailValue: { flexShrink: 1, fontSize: 15 },
  ingredients: { marginTop: 8 },
  allergens: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSubtle,
  },
  compactRow: { height: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  compactTitle: { flex: 1, textAlign: 'center' },
  compactHeart: { borderRadius: 22, borderWidth: 1, borderColor: colors.lineSubtle, backgroundColor: colors.white },
  purchase: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addToCart: { flex: 1.15, minWidth: 0, paddingHorizontal: 12 },
  buyNow: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
});
