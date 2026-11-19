import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronDown, MapPin, Plus } from '@/components/icons';
import { BottomSheet, IconTile, RadioDot, Skeleton, Tag, Text, TextLink } from '@/components/ui';
import { useAddresses } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useCheckout } from '@/context/CheckoutContext';
import { useToast } from '@/context/ToastContext';
import { deliverToLabel, deliveryAddress, formatAddress } from '@/domain';
import { ROUTES } from '@/lib/routes';
import { colors, radii } from '@/theme/theme';
import type { Address } from '@/types/api';
import { t } from '@/i18n';

/**
 * The address we deliver to, shared by Home and checkout (checkout draft → default → first).
 * Choosing one on Home also makes it the default, so the choice is still there next time (web: same).
 */
export function useDeliveryAddress() {
  const { addresses, loaded, setDefault } = useAddresses();
  const checkout = useCheckout();
  const toast = useToast();
  const address = deliveryAddress(addresses, checkout.addressId) as Address | null;

  const choose = useCallback(
    (id: string, { makeDefault = false }: { makeDefault?: boolean } = {}) => {
      checkout.patch({ addressId: id });
      const target = addresses.find((a) => a.id === id);
      if (makeDefault && target && !target.isDefault) {
        setDefault(id).catch((err: Error) => toast.show(err.message, { tone: 'error' }));
      }
    },
    [addresses, checkout, setDefault, toast],
  );

  return { address, addresses, loaded, choose };
}

/** Address radio card (PDF 13): radio · label + Default tag · address · "Name · phone". */
export function AddressOption({ address, checked, onSelect }: { address: Address; checked: boolean; onSelect: (id: string) => void }) {
  const { user } = useAuth();
  return (
    <Pressable
      onPress={() => onSelect(address.id)}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={`${address.label}${address.isDefault ? ', default' : ''}. ${formatAddress(address)}`}
      style={[styles.option, checked ? styles.optionChecked : null]}
    >
      <RadioDot checked={checked} />
      <View style={styles.flex}>
        <View style={styles.optionTitle}>
          <Text weight={700} style={styles.label} numberOfLines={1}>
            {address.label}
          </Text>
          {address.isDefault ? <Tag tone="dark">{t('Default')}</Tag> : null}
        </View>
        <Text color="copy" style={styles.optionLine}>
          {formatAddress(address)}
        </Text>
        <Text variant="label" weight={400} color="muted" style={styles.optionLine}>
          {address.contactName || user?.name}
        </Text>
      </View>
    </Pressable>
  );
}

/** Dashed "+ Add new address" tile (PDF 13). */
export function AddAddressTile({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('Add new address')}
      style={({ pressed }) => [styles.add, pressed && styles.addPressed, style]}
    >
      <Plus size={20} color={colors.maroon} strokeWidth={2} />
      <Text weight={700} color="maroon" style={styles.addText}>{t('Add new address')}</Text>
    </Pressable>
  );
}

/** Opens Add address and comes back to `returnTo` (Delivery or Home), which then delivers there. */
export function useAddAddress(returnTo: string) {
  const router = useRouter();
  return () => router.push({ pathname: '/addresses/new', params: { returnTo } });
}

/** Home: "Deliver to / Home · Al Rakah, Al Khobar ⌄" — opens the address sheet (or Add address). */
export function DeliverToBar({
  address,
  loaded,
  onOpen,
  style,
}: {
  address: Address | null;
  loaded: boolean;
  onOpen: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const addAddress = useAddAddress(ROUTES.home as string);
  const empty = loaded && !address;
  const text = empty ? t('Add a delivery address') : deliverToLabel(address);
  return (
    <Pressable
      onPress={empty ? addAddress : onOpen}
      disabled={!loaded}
      accessibilityRole="button"
      accessibilityLabel={loaded ? t('Deliver to {text}', { text }) : t('Deliver to, loading your address')}
      accessibilityHint={empty ? undefined : t('Choose another saved address')}
      style={({ pressed }) => [styles.bar, pressed && styles.barPressed, style]}
    >
      <IconTile icon={MapPin} size={40} iconSize={19} />
      <View style={styles.flex}>
        <Text variant="label" weight={400} color="muted">{t('Deliver to')}</Text>
        {!loaded ? (
          <Skeleton style={styles.barSkeleton} />
        ) : (
          <View style={styles.barValue}>
            <Text weight={700} numberOfLines={1} style={styles.barText}>
              {text}
            </Text>
            {empty ? (
              <Plus size={18} color={colors.maroon} strokeWidth={2} />
            ) : (
              <ChevronDown size={18} color={colors.maroon} strokeWidth={2} />
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** "Deliver to" sheet: saved addresses as radio cards, add, manage. Choosing closes it. */
export function DeliverToSheet({
  open,
  onClose,
  selectedId,
  addresses,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  selectedId: string | undefined;
  addresses: Address[];
  onChoose: (id: string) => void;
}) {
  const router = useRouter();
  const addAddress = useAddAddress(ROUTES.home as string);
  const leaveTo = (go: () => void) => {
    onClose();
    go();
  };
  return (
    <BottomSheet open={open} onClose={onClose} title={t('Deliver to')}>
      <Text variant="small" color="muted">{t('The branch nearest to this address prepares your order.')}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('Delivery address')} style={styles.options}>
        {addresses.map((a) => (
          <AddressOption
            key={a.id}
            address={a}
            checked={a.id === selectedId}
            onSelect={(id) => {
              onChoose(id);
              onClose();
            }}
          />
        ))}
      </View>
      <AddAddressTile onPress={() => leaveTo(addAddress)} style={styles.addInSheet} />
      <View style={styles.manage}>
        <TextLink onPress={() => leaveTo(() => router.push(ROUTES.addresses))}>{t('Manage saved addresses')}</TextLink>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  option: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    backgroundColor: colors.surface,
    padding: 16,
  },
  optionChecked: { borderWidth: 1.5, borderColor: colors.maroon },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, lineHeight: 22, flexShrink: 1 },
  optionLine: { marginTop: 4 },
  add: {
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
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, borderRadius: radii.xl },
  barPressed: { opacity: 0.7 },
  barValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barText: { fontSize: 15, lineHeight: 20, flexShrink: 1 },
  barSkeleton: { marginTop: 4, height: 16, width: 176, borderRadius: 4 },
  options: { marginTop: 16, gap: 12 },
  addInSheet: { marginTop: 12 },
  manage: { marginTop: 16, marginBottom: 8, alignItems: 'center' },
});
