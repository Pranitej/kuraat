import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CheckoutSteps } from '@/components/checkout/CheckoutParts';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { ChevronRight, Store } from '@/components/icons';
import { AddAddressTile, AddressOption, useAddAddress } from '@/components/shop/DeliverTo';
import { DeliveryFromCard } from '@/components/shop/DeliveryFromCard';
import { Button, InfoBanner, PhoneField, Segmented, Text, TextLink } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAddresses } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useCheckout } from '@/context/CheckoutContext';
import { PICKUP, deliveryAddress, validateMobile } from '@/domain';
import { useDeliveryQuote } from '@/hooks/quote';
import { offeredMethod } from '@/services/orderService.js';
import type { Address, Fulfilment, PaymentMethod } from '@/types/api';

/** 13 · Delivery details (and, for branch pickup, Pickup details) */
export default function DeliveryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, status: cartStatus } = useCart();
  const { addresses } = useAddresses();
  const checkout = useCheckout();
  const selected = deliveryAddress(addresses, checkout.addressId) as Address | null;
  const addAddress = useAddAddress(ROUTES.delivery as string);
  const [typedPhone, setTypedPhone] = useState<string | null>(checkout.deliveryPhone || null);
  const [errors, setErrors] = useState<{ address?: string; phone?: string }>({});
  const productIds = useMemo(() => items.map((i) => i.productId), [items]);
  const pickup = checkout.fulfilment === 'pickup';
  const { quote: delivery, error: quoteError } = useDeliveryQuote({
    addressId: pickup ? null : selected?.id,
    productIds,
    fulfilment: pickup ? 'pickup' : 'delivery',
  });

  // Follows the selected address's phone (pickup: the account phone) until the customer edits the field (web behaviour).
  const phone = typedPhone ?? (pickup ? user?.phone : selected?.phone) ?? user?.phone ?? '';

  // Right after start the cart is still on its way from the server: wait instead of bouncing to the cart.
  if (!items.length && (cartStatus === 'loading' || cartStatus === 'idle')) return <Screen>{null}</Screen>;
  if (!items.length) return <Redirect href={ROUTES.cart} />;

  const select = (id: string) => {
    checkout.patch({ addressId: id });
    setErrors((e) => ({ ...e, address: '' }));
  };

  // Delivery or pickup: the payment methods differ, so a remembered one that the other way does not
  // offer falls back to card.
  const chooseFulfilment = (value: Fulfilment) => {
    setErrors({});
    checkout.patch({ fulfilment: value, paymentMethod: offeredMethod(checkout.paymentMethod, value) as PaymentMethod });
  };

  const next = () => {
    const errs = { address: pickup || selected ? '' : 'Choose a delivery address', phone: validateMobile(phone) as string };
    setErrors(errs);
    if (errs.address || errs.phone || (!pickup && !selected)) return;
    checkout.patch(pickup ? { deliveryPhone: phone } : { addressId: selected!.id, deliveryPhone: phone });
    router.push(ROUTES.payment);
  };

  return (
    <Screen
      header={<ScreenHeader title={pickup ? 'Pickup details' : 'Delivery details'} backFallback={ROUTES.cart} />}
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
      <Segmented
        label={PICKUP.switchLabel}
        options={[
          { value: 'delivery', label: PICKUP.delivery },
          { value: 'pickup', label: PICKUP.pickup },
        ]}
        value={checkout.fulfilment}
        onChange={chooseFulfilment}
        style={styles.switch}
      />

      {pickup ? (
        <>
          <InfoBanner icon={Store} style={styles.add}>
            {PICKUP.note}
          </InfoBanner>
          <PhoneField
            label={PICKUP.phoneLabel}
            value={phone}
            onChange={(v) => {
              setTypedPhone(v);
              setErrors((e) => ({ ...e, phone: '' }));
            }}
            error={errors.phone}
            helper={PICKUP.phoneHelper}
            style={styles.phone}
          />
          {delivery?.branch ? (
            <DeliveryFromCard style={styles.delivery} icon="store" label={PICKUP.likely} branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.titleRow}>
            <Text variant="h3" accessibilityRole="header">
              Deliver to
            </Text>
            <TextLink onPress={() => router.push(ROUTES.addresses)}>Manage</TextLink>
          </View>

          <View accessibilityRole="radiogroup" accessibilityLabel="Delivery address" style={styles.addresses}>
            {addresses.map((a) => (
              <AddressOption key={a.id} address={a} checked={a.id === selected?.id} onSelect={select} />
            ))}
          </View>
          {errors.address ? (
            <Text variant="label" color="hotpink" style={styles.error}>
              {errors.address}
            </Text>
          ) : null}

          <AddAddressTile onPress={addAddress} style={styles.add} />

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

          {delivery?.branch ? (
            <DeliveryFromCard style={styles.delivery} icon="store" branch={delivery.branch} distanceKm={delivery.distanceKm} showDistance />
          ) : null}
        </>
      )}
      {quoteError ? (
        <Text variant="label" color="hotpink" style={styles.delivery} accessibilityRole="alert">
          {quoteError.message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { marginTop: 16 },
  titleRow: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addresses: { marginTop: 12, gap: 12 },
  error: { marginTop: 8 },
  add: { marginTop: 12 },
  phone: { marginTop: 24 },
  delivery: { marginTop: 20 },
});
