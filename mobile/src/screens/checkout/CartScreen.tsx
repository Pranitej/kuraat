import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CartItemCard, CheckoutSteps, OrderSummary } from '@/components/checkout/CheckoutParts';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { ChevronRight, CloudOff, ShoppingBag, Store, Tag as TagIcon, X } from '@/components/icons';
import { Button, EmptyState, Field, IconButton, InfoBanner, Skeleton, Tag, Text } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAddresses } from '@/context/AddressContext';
import { useCart, type CartLine } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useDeliveryQuote } from '@/hooks/quote';
import { colors, radii } from '@/theme/theme';
import type { Quote } from '@/types/api';

function availabilityText(count: number, delivery: Quote): [string, string] {
  const lead = count === 1 ? 'This item is' : count === 2 ? 'Both items are' : `All ${count} items are`;
  if (delivery.inStock === false) return ['Some items are limited at ', '. We will confirm stock with the branch at checkout.'];
  return [
    `${lead} available at `,
    delivery.isNearest
      ? ', your nearest branch. Stock is confirmed at checkout.'
      : ', the nearest branch with everything in stock. Stock is confirmed at checkout.',
  ];
}

/** 12 · Cart */
export default function CartScreen() {
  const router = useRouter();
  const toast = useToast();
  const {
    lines,
    count,
    totals,
    promo,
    setQty,
    remove,
    restore,
    applyPromo,
    removePromo,
    items,
    status,
    error,
    syncing,
    blocked,
    flush,
    reload,
  } = useCart();
  const { defaultAddress } = useAddresses();
  const productIds = useMemo(() => items.map((i) => i.productId), [items]);
  const { quote: delivery } = useDeliveryQuote({ addressId: defaultAddress?.id, productIds });
  const [code, setCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [applying, setApplying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const lineCount = lines.length;

  const removeLine = (line: CartLine) => {
    const removed = remove(line.productId);
    if (removed)
      toast.show(`${line.product?.name ?? 'Item'} removed`, { tone: 'info', action: { label: 'Undo', onPress: () => restore(removed) } });
  };

  // Leave only once the server has the cart as shown (it prices and checks it again at payment).
  const continueToDelivery = async () => {
    setLeaving(true);
    try {
      await flush();
      router.push(ROUTES.delivery);
    } catch (err) {
      toast.show((err as Error).message, { tone: 'error' });
    } finally {
      setLeaving(false);
    }
  };

  const apply = async () => {
    if (!code.trim()) {
      setPromoError('Enter a promo code');
      return;
    }
    setApplying(true);
    setPromoError('');
    try {
      const p = await applyPromo(code);
      setCode('');
      toast.show(`${p.code} applied — ${(p.label || '').toLowerCase()}`);
    } catch (err) {
      setPromoError((err as Error).message);
    } finally {
      setApplying(false);
    }
  };

  const header = (
    <ScreenHeader
      title="My cart"
      right={count > 0 ? <Tag style={styles.countTag}>{`${count} ${count === 1 ? 'item' : 'items'}`}</Tag> : null}
    />
  );

  if (!lineCount && status === 'loading') {
    return (
      <Screen header={header}>
        <View style={styles.lines}>
          {[0, 1].map((i) => (
            <Skeleton key={i} style={styles.lineSkeleton} />
          ))}
        </View>
      </Screen>
    );
  }

  if (!lineCount && status === 'error') {
    const e = error as { code?: string; message?: string } | null;
    return (
      <Screen header={header}>
        <EmptyState
          icon={CloudOff}
          title="We can't reach the store right now"
          message={e?.code === 'network' ? e.message : 'Please try again in a moment.'}
          actionLabel="Try again"
          onAction={reload}
        />
      </Screen>
    );
  }

  if (!lineCount) {
    return (
      <Screen header={header}>
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          message="Add truffles, cakes or pastries and they will appear here, ready for delivery from your nearest branch."
          actionLabel="Start shopping"
          onAction={() => router.replace(ROUTES.home)}
        />
      </Screen>
    );
  }

  const [before, after] = delivery ? availabilityText(lineCount, delivery) : ['', ''];

  return (
    <Screen
      header={header}
      keyboard
      bottomBar={
        <BottomBar>
          <Button block rightIcon={ChevronRight} disabled={blocked} loading={leaving} onPress={continueToDelivery}>
            Continue to delivery
          </Button>
        </BottomBar>
      }
    >
      <CheckoutSteps current={0} />
      <View style={[styles.lines, styles.first]}>
        {lines.map((line) => (
          <CartItemCard
            key={line.productId}
            line={line}
            branchName={delivery?.branch.shortName}
            onQty={(q) => setQty(line.productId, q)}
            onRemove={() => removeLine(line)}
          />
        ))}
      </View>

      <View style={styles.block}>
        {promo ? (
          <View style={styles.applied}>
            <TagIcon size={20} color={colors.maroon} strokeWidth={1.8} />
            <Text numberOfLines={1} style={[styles.flex, styles.appliedText]}>
              <Text weight={700}>{promo.code}</Text> applied · <Text color="muted">{promo.label}</Text>
            </Text>
            <IconButton icon={X} label="Remove promo code" variant="plain" size="xs" iconSize={18} onPress={removePromo} />
          </View>
        ) : (
          <View>
            <View style={styles.promoRow}>
              <Field
                icon={TagIcon}
                value={code}
                onChangeText={(t) => {
                  setCode(t.toUpperCase());
                  setPromoError('');
                }}
                placeholder="Promo code"
                accessibilityLabel="Promo code"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={apply}
                error={promoError || null}
                style={styles.flex}
              />
              <Button variant="secondary" size="sm" loading={applying} onPress={apply} style={styles.apply}>
                Apply
              </Button>
            </View>
          </View>
        )}
        <OrderSummary totals={totals} promo={promo} dimmed={syncing} />
      </View>

      {delivery ? (
        <InfoBanner icon={Store} style={styles.banner}>
          <Text color="copy" style={styles.bannerText}>
            {before}
            <Text weight={700}>{delivery.branch.displayName}</Text>
            {after}
          </Text>
        </InfoBanner>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  countTag: { height: 32, paddingHorizontal: 12 },
  lines: { gap: 12 },
  first: { marginTop: 16 },
  lineSkeleton: { height: 116, borderRadius: radii.xl },
  block: { marginTop: 16, gap: 12 },
  applied: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.md,
    backgroundColor: colors.sand,
    paddingHorizontal: 16,
  },
  appliedText: { fontSize: 15 },
  promoRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  apply: { height: 52, paddingHorizontal: 20 },
  banner: { marginTop: 12 },
  bannerText: { fontSize: 15, lineHeight: 22 },
});
