import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CheckoutSteps } from '@/components/checkout/CheckoutParts';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { Banknote, CreditCard, Lock, Store, TriangleAlert, type LucideIcon } from '@/components/icons';
import { DeliveryFromCard } from '@/components/shop/DeliveryFromCard';
import { Button, RadioDot, Text } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAddresses } from '@/context/AddressContext';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { useOrders } from '@/context/OrderContext';
import { useToast } from '@/context/ToastContext';
import { CARD_PAYMENT, PICKUP, formatSAR } from '@/domain';
import { useDeliveryQuote } from '@/hooks/quote';
import { success as successHaptic } from '@/lib/haptics';
import { getPaymentOptions } from '@/services/checkoutService.js';
import { offeredMethod, toPaymentBody } from '@/services/orderService.js';
import { colors, radii } from '@/theme/theme';
import type { PaymentMethod } from '@/types/api';
import { t } from '@/i18n';

// Saudi Arabia: card (incl. Mada) and cash on delivery; branch pickup pays now (card) or at the branch.
// UPI (shown in the PDF) was removed — it is India-only. A card is paid on RSOF's secure payment page after the
// order is placed (19 Nov 2026): no card details are typed in the app.
type MethodRow = { id: PaymentMethod; title: string; subtitle: string; icon: LucideIcon };
/** Built when the screen draws (not when the file loads), so the words follow the language chosen now. */
const deliveryMethods = (): MethodRow[] => [
  { id: 'card', title: CARD_PAYMENT.title, subtitle: CARD_PAYMENT.subtitle, icon: CreditCard },
  { id: 'cod', title: t('Cash on delivery'), subtitle: t('Pay when your order arrives'), icon: Banknote },
];
const pickupMethods = (): MethodRow[] => [
  { id: 'card', title: PICKUP.payNow, subtitle: PICKUP.payNowSub, icon: CreditCard },
  { id: 'branch', title: PICKUP.payAtBranch, subtitle: PICKUP.payAtBranchSub, icon: Store },
];

type Errors = Partial<Record<'form', string>>;

/** 14 · Payment */
export default function PaymentScreen() {
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();
  const { addresses, defaultAddress, loaded: addressesLoaded } = useAddresses();
  const { placeOrder } = useOrders();
  const checkout = useCheckout();
  const pickup = checkout.fulfilment === 'pickup';
  const METHODS = pickup ? pickupMethods() : deliveryMethods();
  const address = pickup ? null : addresses.find((a) => a.id === checkout.addressId) || defaultAddress;
  const productIds = useMemo(() => cart.items.map((i) => i.productId), [cart.items]);
  const { quote: delivery, error: quoteError, retry: retryQuote } = useDeliveryQuote({
    addressId: address?.id,
    productIds,
    fulfilment: pickup ? 'pickup' : 'delivery',
  });
  const { ensureIdempotencyKey } = checkout;

  // One key per checkout, made when the payment screen opens and reused on every retry.
  useEffect(() => {
    ensureIdempotencyKey();
  }, [ensureIdempotencyKey]);

  // The remembered method if this way of getting the order still offers it (a draft may even say "upi").
  const [method, setMethod] = useState<PaymentMethod>(() => offeredMethod(checkout.paymentMethod, checkout.fulfilment) as PaymentMethod);
  const [errors, setErrors] = useState<Errors>({});
  const [processing, setProcessing] = useState(false);
  // Blocks a second tap before the first one has re-rendered the button (review focus 2).
  const paying = useRef(false);
  // Card works only while RSOF's payment page does (null = still asking the kuraat server).
  const [cardAvailable, setCardAvailable] = useState<boolean | null>(null);
  const fulfilment = checkout.fulfilment;

  useEffect(() => {
    let alive = true;
    getPaymentOptions().then(({ card }) => {
      if (!alive) return;
      setCardAvailable(card);
      if (!card) setMethod((m) => offeredMethod(m, fulfilment, { cardAvailable: false }) as PaymentMethod);
    });
    return () => {
      alive = false;
    };
  }, [fulfilment]);

  const waiting = (!cart.items.length && (cart.status === 'loading' || cart.status === 'idle')) || !addressesLoaded;
  if (!processing && waiting) return <Screen>{null}</Screen>;
  if (!cart.items.length && !processing) return <Redirect href={ROUTES.cart} />;
  if (!pickup && !address && !processing) return <Redirect href={ROUTES.delivery} />;

  // Pickup totals come priced from the server with the quote (the same RSOF product prices).
  const totals = pickup ? delivery?.totals : cart.totals;
  const choose = (id: PaymentMethod) => {
    setMethod(id);
    setErrors({});
    checkout.patch({ paymentMethod: id });
  };

  const cardOff = method === 'card' && cardAvailable !== true;

  const pay = async () => {
    if (paying.current || (!pickup && !address) || !totals || cardOff) return;
    paying.current = true;
    setProcessing(true);
    setErrors({});
    try {
      await cart.flush(); // the server places the cart it has
      const order = await placeOrder({
        fulfilment: pickup ? 'pickup' : 'delivery',
        addressId: address?.id,
        payment: toPaymentBody(method),
        idempotencyKey: ensureIdempotencyKey(),
      });
      successHaptic();
      cart.reload(); // the server emptied it
      checkout.reset({ lastOrderId: order.id, paymentMethod: method, fulfilment: pickup ? 'pickup' : 'delivery' });
      router.replace(ROUTES.paymentSuccess(order.id));
    } catch (err) {
      const e = err as { code?: string; field?: string; message: string };
      if (e.code === 'idempotency_conflict') checkout.renewIdempotencyKey();
      // Card stopped working between opening this screen and paying: grey it out and offer the other way.
      if (e.code === 'payment_unavailable' && method === 'card') {
        setCardAvailable(false);
        choose(offeredMethod('card', checkout.fulfilment, { cardAvailable: false }) as PaymentMethod);
      }
      paying.current = false;
      setProcessing(false);
      setErrors({ form: e.message });
      toast.show(t('Your order could not be placed'), { tone: 'error' });
    }
  };

  const later = method === 'cod' || method === 'branch';
  // Card: the order is placed first, then paid on the secure payment page (the next screen opens it).
  const payLabel = !totals ? t('Pay') : later ? t('Place order · {amount}', { amount: formatSAR(totals.total) }) : t('Continue to payment · {amount}', { amount: formatSAR(totals.total) });

  return (
    <Screen
      header={<ScreenHeader title={t('Payment')} backFallback={ROUTES.delivery} />}
      keyboard
      bottomBar={
        <BottomBar>
          {!totals && !quoteError ? (
            <Text color="muted" style={styles.gettingTotal} accessibilityLiveRegion="polite">{t('Getting your total…')}</Text>
          ) : null}
          {totals ? (
            <View style={styles.totalRow}>
              <Text color="muted">{t('Total · {count}', { count: totals.count })}{' '}{totals.count === 1 ? t('item') : t('items')}
              </Text>
              <Text weight={700} style={styles.total}>
                {formatSAR(totals.total)}
              </Text>
            </View>
          ) : null}
          <Button block leftIcon={later ? undefined : Lock} loading={processing} disabled={!totals || cardOff} onPress={pay}>
            {payLabel}
          </Button>
        </BottomBar>
      }
    >
      <CheckoutSteps current={2} />
      <Text variant="h3" accessibilityRole="header" style={styles.title}>{t('Payment method')}</Text>
      {errors.form ? (
        <View style={styles.formError} accessibilityRole="alert">
          <TriangleAlert size={20} color={colors.hotpink} strokeWidth={1.8} />
          <Text style={styles.formErrorText}>{errors.form}</Text>
        </View>
      ) : null}

      {!totals && quoteError ? (
        // Pickup prices come with the quote: say so when it fails, and let the customer try again.
        <View style={styles.quoteError} accessibilityRole="alert">
          <View style={styles.quoteErrorRow}>
            <TriangleAlert size={20} color={colors.hotpink} strokeWidth={1.8} />
            <Text style={styles.formErrorText}>{quoteError.message}</Text>
          </View>
          <Button variant="secondary" size="sm" onPress={retryQuote}>{t('Try again')}</Button>
        </View>
      ) : null}

      <View accessibilityRole="radiogroup" accessibilityLabel={t('Payment method')} style={styles.methods}>
        {METHODS.map((m) => {
          const checked = method === m.id;
          const off = m.id === 'card' && cardAvailable === false;
          const subtitle = off ? CARD_PAYMENT.unavailable : m.subtitle;
          return (
            <View key={m.id} style={[styles.method, checked ? styles.methodChecked : null]}>
              <Pressable
                onPress={() => choose(m.id)}
                disabled={processing || off}
                accessibilityRole="radio"
                accessibilityState={{ checked, disabled: processing || off }}
                accessibilityLabel={`${m.title}, ${subtitle}`}
                style={[styles.methodRow, off ? styles.methodOff : null]}
              >
                <RadioDot checked={checked} />
                <View style={styles.methodIcon}>
                  <m.icon size={21} color={colors.maroon} strokeWidth={1.8} />
                </View>
                <View style={styles.flex}>
                  <Text weight={700} style={styles.methodTitle}>
                    {m.title}
                  </Text>
                  <Text variant="small" color="muted">
                    {subtitle}
                  </Text>
                </View>
              </Pressable>

              {checked && m.id === 'card' ? (
                <Animated.View entering={FadeIn.duration(180)} style={styles.methodBody}>
                  <Text variant="small" color="muted">
                    {CARD_PAYMENT.returnHint}
                  </Text>
                </Animated.View>
              ) : null}

              {checked && m.id === 'cod' && totals ? (
                <Animated.View entering={FadeIn.duration(180)} style={styles.methodBody}>
                  <Text variant="small" color="muted">{t('Please keep {total} ready. The courier carries change and a card machine.', { total: formatSAR(totals.total) })}</Text>
                </Animated.View>
              ) : null}

              {checked && m.id === 'branch' && totals ? (
                <Animated.View entering={FadeIn.duration(180)} style={styles.methodBody}>
                  <Text variant="small" color="muted">
                    {PICKUP.payAtBranchHint(formatSAR(totals.total))}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          );
        })}
      </View>

      {delivery?.branch ? (
        <DeliveryFromCard
          style={styles.delivery}
          icon="store"
          label={pickup ? PICKUP.likely : undefined}
          branch={delivery.branch}
          distanceKm={delivery.distanceKm}
          showDistance
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gettingTotal: { marginBottom: 12, paddingHorizontal: 4 },
  quoteError: {
    marginTop: 12,
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(237,59,92,0.4)',
    backgroundColor: 'rgba(237,59,92,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quoteErrorRow: { flexDirection: 'row', gap: 10 },
  title: { marginTop: 16 },
  formError: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(237,59,92,0.4)',
    backgroundColor: 'rgba(237,59,92,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  formErrorText: { flex: 1, fontSize: 15 },
  methods: { marginTop: 12, gap: 12 },
  method: { borderRadius: radii.xl, borderWidth: 1, borderColor: colors.lineSubtle, backgroundColor: colors.surface },
  methodChecked: { borderWidth: 1.5, borderColor: colors.maroon },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: { fontSize: 16, lineHeight: 22 },
  methodBody: { paddingHorizontal: 16, paddingBottom: 16 },
  methodOff: { opacity: 0.5 },
  delivery: { marginTop: 20 },
  totalRow: { marginBottom: 12, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  total: { fontSize: 18, fontVariant: ['tabular-nums'] },
});
