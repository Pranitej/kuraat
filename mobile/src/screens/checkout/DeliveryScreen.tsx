import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CheckoutSteps } from '@/components/checkout/CheckoutParts';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { ChevronRight, Plus } from '@/components/icons';
import { DeliveryFromCard } from '@/components/shop/DeliveryFromCard';
import { Button, PhoneField, RadioDot, Tag, Text, TextLink } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { useAddresses } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { formatAddress, formatPhone, validateMobile } from '@/domain';
import { useDeliveryQuote } from '@/hooks/quote';
import { colors, radii } from '@/theme/theme';

/** 13 · Delivery details */
export default function DeliveryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, status: cartStatus } = useCart();
  const { addresses, defaultAddress } = useAddresses();
  const checkout = useCheckout();

  const selectedId = addresses.some((a) => a.id === checkout.addressId) ? checkout.addressId : defaultAddress?.id;
  const selected = addresses.find((a) => a.id === selectedId) || null;
  const [typedPhone, setTypedPhone] = useState<string | null>(checkout.deliveryPhone || null);
  const [errors, setErrors] = useState<{ address?: string; phone?: string }>({});
  const productIds = useMemo(() => items.map((i) => i.productId), [items]);
  const { quote: delivery, error: quoteError } = useDeliveryQuote({ addressId: selected?.id, productIds });

  // Follows the selected address's phone until the customer edits the field (web behaviour).
  const phone = typedPhone ?? selected?.phone ?? user?.phone ?? '';

  // Right after start the cart is still on its way from the server: wait instead of bouncing to the cart.
  if (!items.length && (cartStatus === 'loading' || cartStatus === 'idle')) return <Screen>{null}</Screen>;
  if (!items.length) return <Redirect href={ROUTES.cart} />;

  const select = (id: string) => {
    checkout.patch({ addressId: id });
    setErrors((e) => ({ ...e, address: '' }));
  };

  const next = () => {
    const errs = { address: selected ? '' : 'Choose a delivery address', phone: validateMobile(phone) as string };
    setErrors(errs);
    if (errs.address || errs.phone || !selected) return;
    checkout.patch({ addressId: selected.id, deliveryPhone: phone });
    router.push(ROUTES.payment);
  };

  return (
    <Screen
      header={<ScreenHeader title="Delivery details" backFallback={ROUTES.cart} />}
      keyboard
      bottomBar={
        <BottomBar>
          <Button block rightIcon={ChevronRight} onPress={next}>
            Continue to payment
          </Button>
        </BottomBar>
      }
    >
      <CheckoutSteps current={1} />
      <View style={styles.titleRow}>
        <Text variant="h3" accessibilityRole="header">
          Deliver to
        </Text>
        <TextLink onPress={() => router.push(ROUTES.addresses)}>Manage</TextLink>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Delivery address" style={styles.addresses}>
        {addresses.map((a) => {
          const checked = a.id === selectedId;
          return (
            <Pressable
              key={a.id}
              onPress={() => select(a.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={`${a.label}${a.isDefault ? ', default' : ''}. ${formatAddress(a)}`}
              style={[styles.address, checked ? styles.addressChecked : null]}
            >
              <RadioDot checked={checked} />
              <View style={styles.flex}>
                <View style={styles.addressTitle}>
                  <Text weight={700} style={styles.label}>
                    {a.label}
                  </Text>
                  {a.isDefault ? <Tag tone="dark">Default</Tag> : null}
                </View>
                <Text color="copy" style={styles.addressLine}>
                  {formatAddress(a)}
                </Text>
                <Text variant="label" weight={400} color="muted" style={styles.addressLine}>
                  {a.contactName || user?.name} · {formatPhone(a.phone)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {errors.address ? (
        <Text variant="label" color="hotpink" style={styles.error}>
          {errors.address}
        </Text>
      ) : null}

      <Pressable
        onPress={() => router.push(`${ROUTES.addressNew}?returnTo=${encodeURIComponent(ROUTES.delivery)}`)}
        accessibilityRole="button"
        accessibilityLabel="Add new address"
        style={({ pressed }) => [styles.add, pressed && styles.addPressed]}
      >
        <Plus size={20} color={colors.maroon} strokeWidth={2} />
        <Text weight={700} color="maroon" style={styles.addText}>
          Add new address
        </Text>
      </Pressable>

      <PhoneField
        label="Phone number for this delivery"
        value={phone}
        onChange={(v) => {
          setTypedPhone(v);
          setErrors((e) => ({ ...e, phone: '' }));
        }}
        error={errors.phone}
        helper="The courier will call this number on arrival."
        style={styles.phone}
      />

      {delivery ? (
        <DeliveryFromCard style={styles.delivery} icon="store" branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />
      ) : null}
      {quoteError ? (
        <Text variant="label" color="hotpink" style={styles.delivery} accessibilityRole="alert">
          {quoteError.message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  titleRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addresses: { marginTop: 12, gap: 12 },
  address: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    backgroundColor: colors.surface,
    padding: 16,
  },
  addressChecked: { borderWidth: 1.5, borderColor: colors.maroon },
  addressTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, lineHeight: 22 },
  addressLine: { marginTop: 4 },
  error: { marginTop: 8 },
  add: {
    marginTop: 12,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D9C1B5',
  },
  addPressed: { backgroundColor: 'rgba(255,255,255,0.6)' },
  addText: { fontSize: 16 },
  phone: { marginTop: 24 },
  delivery: { marginTop: 20 },
});
