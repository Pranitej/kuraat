import { Image } from 'expo-image';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Clock, MapPin, Store } from '@/components/icons';
import { Button, Card, Dialog, DialogLink, IconTile, MaroonPanel, Text } from '@/components/ui';
import { ROUTES } from '@/config/routes.js';
import { useOrder } from '@/context/OrderContext';
import { formatAddress, formatDistance, formatOrderDate, formatSAR, formatWindow } from '@/domain';
import { useBackToHome } from '@/hooks';
import { session } from '@/lib/storage.js';
import { colors, layout, radii } from '@/theme/theme';

/** 16 · Order confirmed + "delivered from" branch popup (once per order). */
export default function OrderConfirmedScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { order, loading } = useOrder(orderId);
  const popupKey = `branch-popup-seen:${orderId}`;
  const [popup, setPopup] = useState(() => !session.read(popupKey));
  useBackToHome();

  if (!order && loading) return <View style={styles.root} />;
  if (!order) return <Redirect href={ROUTES.orders} />;
  const branch = order.branch || { id: null, name: 'the branch', address: '' };
  const closePopup = () => {
    session.write(popupKey, true);
    setPopup(false);
  };
  // Leave the finished checkout: back to the Home already in the stack, then on from there.
  const toHome = () => router.dismissTo(ROUTES.home);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} bounces={false}>
        <MaroonPanel style={[styles.header, { paddingTop: insets.top + 48 }]}>
          <Animated.View entering={ZoomIn.duration(300)} style={styles.check}>
            <Check size={34} color={colors.maroon} strokeWidth={2.6} />
          </Animated.View>
          <Text variant="title" color="white" align="center" accessibilityRole="header" style={styles.title}>
            Order confirmed!
          </Text>
          <Text color="white80" align="center" style={styles.meta}>
            Order #{order.number} · {formatOrderDate(order.createdAt)}
          </Text>
        </MaroonPanel>

        <View style={styles.sheet}>
          <View style={styles.column}>
            <View style={styles.eta}>
              <IconTile icon={Clock} tone="white" />
              <View>
                <Text variant="label" weight={400} color="muted">
                  Estimated delivery
                </Text>
                <Text variant="h3">{formatWindow(order.window.start, order.window.end)}</Text>
              </View>
            </View>

            <Text variant="h3" accessibilityRole="header" style={styles.section}>
              Your items
            </Text>
            <View style={styles.items}>
              {order.items.map((item) => (
                <View key={item.productId} style={styles.item}>
                  <View style={styles.thumb}>
                    {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text weight={700} numberOfLines={1} style={styles.itemName}>
                      {item.name}
                    </Text>
                    <Text variant="label" weight={400} color="muted">
                      Qty {item.qty}
                    </Text>
                  </View>
                  <Text weight={600} style={styles.price}>
                    {formatSAR(item.price * item.qty)}
                  </Text>
                </View>
              ))}
            </View>

            <Card style={styles.to}>
              <IconTile icon={MapPin} size={40} iconSize={19} />
              <View style={styles.flex}>
                <Text variant="label" weight={400} color="muted">
                  Delivering to
                </Text>
                <Text weight={600} style={styles.toText}>
                  {formatAddress(order.address)}
                </Text>
              </View>
            </Card>

            <View style={styles.actions}>
              <Button
                variant="secondary"
                block
                style={styles.flex}
                onPress={() => {
                  toHome();
                  router.push(ROUTES.order(order.id));
                }}
              >
                Track order
              </Button>
              <Button block style={styles.flex} onPress={toHome}>
                Back to home
              </Button>
            </View>
          </View>
        </View>
      </ScrollView>

      <Dialog open={popup} onClose={closePopup}>
        <View style={styles.popup}>
          <IconTile icon={Store} size={72} iconSize={30} />
          <Text color="muted" align="center" style={styles.popupLead}>
            Your order will be delivered from
          </Text>
          <Text weight={700} align="center" accessibilityRole="header" style={styles.popupName}>
            {branch.name}
          </Text>
          {branch.address ? (
            <Text color="muted" align="center" style={styles.popupAddress}>
              {branch.address}
            </Text>
          ) : null}
          <View style={styles.popupNote}>
            <MapPin size={20} color={colors.maroon} strokeWidth={1.8} />
            <Text color="copy" style={styles.popupNoteText}>
              Chosen for your delivery address, {formatDistance(order.distanceKm)} away. Stock confirmed at this branch.
            </Text>
          </View>
          <Button block onPress={closePopup} style={styles.gotIt}>
            Got it
          </Button>
          {branch.id ? (
            <DialogLink
              label="View branch details"
              onPress={() => {
                closePopup();
                router.push(ROUTES.branch(branch.id as string));
              }}
            />
          ) : null}
        </View>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1, minWidth: 0 },
  header: { alignItems: 'center', paddingBottom: 64, paddingHorizontal: 24 },
  check: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 20 },
  meta: { marginTop: 4 },
  sheet: { marginTop: -28, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.cream },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24 },
  eta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.sand,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  section: { marginTop: 24 },
  items: { marginTop: 12, gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 56, height: 56, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.sand },
  itemName: { fontSize: 15 },
  price: { fontSize: 15, fontVariant: ['tabular-nums'] },
  to: { marginTop: 20, flexDirection: 'row', gap: 14, padding: 16 },
  toText: { fontSize: 15, lineHeight: 21 },
  actions: { marginTop: 24, flexDirection: 'row', gap: 12 },
  popup: { alignItems: 'center' },
  popupLead: { marginTop: 20 },
  popupName: { marginTop: 4, fontSize: 22, lineHeight: 28 },
  popupAddress: { marginTop: 6 },
  popupNote: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
    borderRadius: radii.lg,
    backgroundColor: colors.sand,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  popupNoteText: { flex: 1, fontSize: 15, lineHeight: 22 },
  gotIt: { marginTop: 24, alignSelf: 'stretch' },
});
