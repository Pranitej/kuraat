import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CheckoutSteps } from '@/components/checkout/CheckoutParts';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { Banknote, CreditCard, Lock, TriangleAlert, type LucideIcon } from '@/components/icons';
import { DeliveryFromCard } from '@/components/shop/DeliveryFromCard';
import { Button, Field, RadioDot, Text, Toggle } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAddresses } from '@/context/AddressContext';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { useOrders } from '@/context/OrderContext';
import { useToast } from '@/context/ToastContext';
import {
  formatCardNumber,
  formatExpiry,
  formatSAR,
  onlyDigits,
  validateCardNumber,
  validateCvv,
  validateExpiry,
  validateUpi,
} from '@/domain';
import { useDeliveryQuote } from '@/hooks/quote';
import { success as successHaptic } from '@/lib/haptics';
import { toPaymentBody } from '@/services/orderService.js';
import { colors, radii } from '@/theme/theme';
import type { PaymentMethod } from '@/types/api';

const METHODS: { id: PaymentMethod; title: string; subtitle: string; icon?: LucideIcon; text?: string }[] = [
  { id: 'card', title: 'Credit / debit card', subtitle: 'Visa, Mastercard, Mada', icon: CreditCard },
  { id: 'upi', title: 'UPI', subtitle: 'Pay with any UPI app', text: 'UPI' },
  { id: 'cod', title: 'Cash on delivery', subtitle: 'Pay when your order arrives', icon: Banknote },
];

/** Server field names → this form's error slots. */
const FIELD_ERRORS: Record<string, keyof Errors> = { 'card.number': 'number', 'card.expiry': 'expiry', 'card.cvv': 'cvv', upiId: 'upi' };
type Errors = Partial<Record<'number' | 'expiry' | 'cvv' | 'upi' | 'form', string>>;

/** 14 · Payment */
export default function PaymentScreen() {
  const router = useRouter();
  const toast = useToast();
  const cart = useCart();
  const { addresses, defaultAddress, loaded: addressesLoaded } = useAddresses();
  const { placeOrder } = useOrders();
  const checkout = useCheckout();
  const address = addresses.find((a) => a.id === checkout.addressId) || defaultAddress;
  const productIds = useMemo(() => cart.items.map((i) => i.productId), [cart.items]);
  const { quote: delivery } = useDeliveryQuote({ addressId: address?.id, productIds });
  const { ensureIdempotencyKey } = checkout;

  // One key per checkout, made when the payment screen opens and reused on every retry.
  useEffect(() => {
    ensureIdempotencyKey();
  }, [ensureIdempotencyKey]);

  const [method, setMethod] = useState<PaymentMethod>(checkout.paymentMethod || 'card');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [save, setSave] = useState(true);
  const [upiId, setUpiId] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [processing, setProcessing] = useState(false);
  // Blocks a second tap before the first one has re-rendered the button (review focus 2).
  const paying = useRef(false);

  const waiting = (!cart.items.length && (cart.status === 'loading' || cart.status === 'idle')) || !addressesLoaded;
  if (!processing && waiting) return <Screen>{null}</Screen>;
  if (!cart.items.length && !processing) return <Redirect href={ROUTES.cart} />;
  if (!address && !processing) return <Redirect href={ROUTES.delivery} />;

  const { totals } = cart;
  const choose = (id: PaymentMethod) => {
    setMethod(id);
    setErrors({});
    checkout.patch({ paymentMethod: id });
  };

  const validate = () => {
    let errs: Errors = {};
    if (method === 'card')
      errs = { number: validateCardNumber(card.number), expiry: validateExpiry(card.expiry), cvv: validateCvv(card.cvv) };
    if (method === 'upi') errs = { upi: validateUpi(upiId) };
    setErrors(errs);
    return !Object.values(errs).some(Boolean);
  };

  const pay = async () => {
    if (paying.current || !address || !validate()) return;
    paying.current = true;
    setProcessing(true);
    setErrors({});
    try {
      await cart.flush(); // the server places the cart it has
      const order = await placeOrder({
        addressId: address.id,
        deliveryPhone: checkout.deliveryPhone || address.phone,
        payment: toPaymentBody(method, { card, upiId, saveCard: save }),
        idempotencyKey: ensureIdempotencyKey(),
      });
      successHaptic();
      cart.reload(); // the server emptied it
      checkout.reset({ lastOrderId: order.id, paymentMethod: method });
      router.replace(ROUTES.paymentSuccess(order.id));
    } catch (err) {
      const e = err as { code?: string; field?: string; message: string };
      if (e.code === 'idempotency_conflict') checkout.renewIdempotencyKey();
      paying.current = false;
      setProcessing(false);
      const slot = e.field ? FIELD_ERRORS[e.field] : undefined;
      setErrors({ form: e.message, ...(slot ? { [slot]: e.message } : {}) });
      toast.show(e.code === 'card_declined' ? 'Payment declined' : 'Payment could not be completed', { tone: 'error' });
    }
  };

  const payLabel = method === 'cod' ? `Place order · ${formatSAR(totals.total)}` : `Pay ${formatSAR(totals.total)}`;

  return (
    <Screen
      header={<ScreenHeader title="Payment" backFallback={ROUTES.delivery} />}
      keyboard
      bottomBar={
        <BottomBar>
          <View style={styles.totalRow}>
            <Text color="muted">
              Total · {totals.count} {totals.count === 1 ? 'item' : 'items'}
            </Text>
            <Text weight={700} style={styles.total}>
              {formatSAR(totals.total)}
            </Text>
          </View>
          <Button block leftIcon={method === 'cod' ? undefined : Lock} loading={processing} onPress={pay}>
            {payLabel}
          </Button>
        </BottomBar>
      }
    >
      <CheckoutSteps current={2} />
      <Text variant="h3" accessibilityRole="header" style={styles.title}>
        Payment method
      </Text>
      {errors.form ? (
        <View style={styles.formError} accessibilityRole="alert">
          <TriangleAlert size={20} color={colors.hotpink} strokeWidth={1.8} />
          <Text style={styles.formErrorText}>{errors.form}</Text>
        </View>
      ) : null}

      <View accessibilityRole="radiogroup" accessibilityLabel="Payment method" style={styles.methods}>
        {METHODS.map((m) => {
          const checked = method === m.id;
          return (
            <View key={m.id} style={[styles.method, checked ? styles.methodChecked : null]}>
              <Pressable
                onPress={() => choose(m.id)}
                disabled={processing}
                accessibilityRole="radio"
                accessibilityState={{ checked, disabled: processing }}
                accessibilityLabel={`${m.title}, ${m.subtitle}`}
                style={styles.methodRow}
              >
                <RadioDot checked={checked} />
                <View style={styles.methodIcon}>
                  {m.icon ? (
                    <m.icon size={21} color={colors.maroon} strokeWidth={1.8} />
                  ) : (
                    <Text weight={700} color="maroon" style={styles.upi}>
                      {m.text}
                    </Text>
                  )}
                </View>
                <View style={styles.flex}>
                  <Text weight={700} style={styles.methodTitle}>
                    {m.title}
                  </Text>
                  <Text variant="small" color="muted">
                    {m.subtitle}
                  </Text>
                </View>
              </Pressable>

              {checked && m.id === 'card' ? (
                <Animated.View entering={FadeIn.duration(180)} style={styles.methodBody}>
                  <Field
                    label="Card number"
                    icon={CreditCard}
                    keyboardType="number-pad"
                    autoComplete="cc-number"
                    textContentType="creditCardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={card.number}
                    onChangeText={(t) => setCard((c) => ({ ...c, number: formatCardNumber(t) }))}
                    trailing={<Lock size={18} color={colors.ink} strokeWidth={1.8} />}
                    error={errors.number}
                    disabled={processing}
                  />
                  <View style={styles.cardRow}>
                    <Field
                      label="Expiry"
                      keyboardType="number-pad"
                      autoComplete="cc-exp"
                      placeholder="MM / YY"
                      value={card.expiry}
                      onChangeText={(t) => setCard((c) => ({ ...c, expiry: formatExpiry(t, c.expiry) }))}
                      error={errors.expiry}
                      disabled={processing}
                      style={styles.flex}
                    />
                    <Field
                      label="CVV"
                      keyboardType="number-pad"
                      autoComplete="cc-csc"
                      secureTextEntry
                      placeholder="•••"
                      maxLength={4}
                      value={card.cvv}
                      onChangeText={(t) => setCard((c) => ({ ...c, cvv: onlyDigits(t).slice(0, 4) }))}
                      error={errors.cvv}
                      disabled={processing}
                      style={styles.flex}
                    />
                  </View>
                  <View style={styles.saveRow}>
                    <Text weight={600} style={styles.flex}>
                      Save this card for next time
                    </Text>
                    <Toggle value={save} onChange={setSave} label="Save this card for next time" disabled={processing} />
                  </View>
                </Animated.View>
              ) : null}

              {checked && m.id === 'upi' ? (
                <Animated.View entering={FadeIn.duration(180)} style={styles.methodBody}>
                  <Field
                    label="UPI ID"
                    placeholder="name@bank"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={upiId}
                    disabled={processing}
                    onChangeText={setUpiId}
                    error={errors.upi}
                    helper="You will approve the payment in your UPI app."
                  />
                </Animated.View>
              ) : null}

              {checked && m.id === 'cod' ? (
                <Animated.View entering={FadeIn.duration(180)} style={styles.methodBody}>
                  <Text variant="small" color="muted">
                    Please keep {formatSAR(totals.total)} ready. The courier carries change and a card machine.
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          );
        })}
      </View>

      {delivery ? (
        <DeliveryFromCard style={styles.delivery} icon="store" branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
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
  upi: { fontSize: 13 },
  methodTitle: { fontSize: 16, lineHeight: 22 },
  methodBody: { paddingHorizontal: 16, paddingBottom: 16 },
  cardRow: { marginTop: 16, flexDirection: 'row', gap: 12 },
  saveRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  delivery: { marginTop: 20 },
  totalRow: { marginBottom: 12, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  total: { fontSize: 18, fontVariant: ['tabular-nums'] },
});
