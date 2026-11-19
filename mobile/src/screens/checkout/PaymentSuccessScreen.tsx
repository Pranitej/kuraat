import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from '@/components/icons';
import { PaymentDueCard } from '@/components/checkout/PaymentDueCard';
import { Button, Card, CirclePattern, ProgressBar, Text, WhatsAppIcon } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useOrder } from '@/context/OrderContext';
import { CARD_PAYMENT, PICKUP, PENDING_BRANCH, awaitingPayment, formatDateTime, formatSAR, paymentLabel } from '@/domain';
import { useBackToHome } from '@/hooks';
import { useOrderPayment } from '@/hooks/orderPayment';
import { colors, layout } from '@/theme/theme';

/**
 * 15 · Payment successful — then confirms the order with the branch before continuing.
 * A card order is paid on RSOF's secure payment page after it is placed (19 Nov 2026): until RSOF says it is paid,
 * this screen is "Complete your payment" and checks again each time the app comes back to the front.
 */
export default function PaymentSuccessScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { order, loading, refresh } = useOrder(orderId);
  const payment = useOrderPayment(order, { onPaid: refresh });
  const waiting = awaitingPayment(order) as boolean;
  const [progress, setProgress] = useState(8);
  const confirmed = progress >= 100;
  useBackToHome();

  useEffect(() => {
    if (!order?.id || waiting) return undefined;
    const steps: [number, number][] = [
      [500, 34],
      [1200, 58],
      [2000, 76],
      [2900, 100],
    ];
    const timers = steps.map(([t, v]) => setTimeout(() => setProgress(v), t));
    return () => timers.forEach(clearTimeout);
  }, [order?.id, waiting]);

  if (!order && loading) return <View style={styles.root} />;
  if (!order || !order.payment) return <Redirect href={ROUTES.orders} />;
  // Cash on delivery and pay at the branch: placed now, paid later.
  const later = order.payment.method === 'cod' || order.payment.method === 'branch';

  if (waiting) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <StatusBar style="dark" />
        <View style={styles.pattern}>
          <CirclePattern variant="sand" fade="down" />
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <Text variant="title" align="center" accessibilityRole="header">
            {CARD_PAYMENT.waitingTitle}
          </Text>
          <Text color="muted" align="center" style={styles.subtitle}>
            Order #{order.number}
          </Text>
          <PaymentDueCard order={order} payment={payment} style={styles.card} />
          <View style={styles.bottom}>
            <Button block variant="ghost" onPress={() => router.replace(ROUTES.order(order.id))}>
              View my order
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  const rows: [string, string][] = later
    ? [
        ['Order number', `#${order.number}`],
        ['Date', formatDateTime(order.createdAt)],
        ['Method', paymentLabel(order.payment)],
        ['Amount due', formatSAR(order.total)],
      ]
    : [
        // Paid on RSOF's page: RSOF keeps the card and the transaction; older payments still have their id.
        order.payment.transactionId ? ['Transaction ID', order.payment.transactionId] : ['Order number', `#${order.number}`],
        ['Date', formatDateTime(order.payment.paidAt || order.createdAt)],
        ['Method', paymentLabel(order.payment)],
        ['Amount', formatSAR(order.total)],
      ];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <StatusBar style="dark" />
      <View style={styles.pattern}>
        <CirclePattern variant="sand" fade="down" />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 72, paddingBottom: Math.max(24, insets.bottom + 12) }]}
      >
        <View style={styles.ring}>
          <Animated.View entering={ZoomIn.duration(360).delay(120)} style={styles.circle}>
            <Check size={56} color={colors.white} strokeWidth={2.6} />
          </Animated.View>
        </View>
        <Text variant="title" align="center" accessibilityRole="header" style={styles.title}>
          {later ? 'Order placed' : 'Payment successful'}
        </Text>
        <Text color="muted" align="center" style={styles.subtitle}>
          {order.payment.method === 'branch'
            ? PICKUP.paidLater(formatSAR(order.total))
            : later
              ? `Pay ${formatSAR(order.total)} in cash when your order arrives`
              : order.payment.last4
                ? `${formatSAR(order.total)} paid with ${paymentLabel(order.payment)}`
                : CARD_PAYMENT.paidBody(formatSAR(order.total))}
        </Text>

        <Card style={styles.card}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text color="muted">{label}</Text>
              <Text weight={700} align="right" style={styles.value}>
                {value}
              </Text>
            </View>
          ))}
        </Card>

        <View style={styles.receipt}>
          <WhatsAppIcon size={20} color={colors.muted} />
          {/* RSOF messages the customer about the order on WhatsApp; it sends no payment receipt (19 Nov 2026). */}
          <Text color="copy">Your order details have been sent to your WhatsApp</Text>
        </View>

        <View style={styles.bottom}>
          <Text color="muted" align="center" accessibilityLiveRegion="polite">
            {confirmed ? (order.branch ? `Confirmed by ${order.branch.name}` : PENDING_BRANCH.sent) : 'Confirming your order with the branch…'}
          </Text>
          <View style={styles.progress}>
            <ProgressBar value={progress} label="Confirming with the branch" />
          </View>
          <Button block disabled={!confirmed} onPress={() => router.replace(ROUTES.orderConfirmed(order.id))} style={styles.continue}>
            Continue
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  pattern: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  content: { flexGrow: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 20 },
  ring: {
    alignSelf: 'center',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(234,213,210,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: { width: 124, height: 124, borderRadius: 62, backgroundColor: colors.maroon, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 32 },
  subtitle: { marginTop: 8 },
  card: { marginTop: 24, paddingHorizontal: 16, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingVertical: 8 },
  value: { flexShrink: 1, fontSize: 15, fontVariant: ['tabular-nums'] },
  receipt: { marginTop: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bottom: { marginTop: 'auto', paddingTop: 40 },
  progress: { marginTop: 12 },
  continue: { marginTop: 20 },
});
