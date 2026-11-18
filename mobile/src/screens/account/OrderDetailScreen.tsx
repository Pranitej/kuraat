import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { OrderTimeline, RefreshButton, StatusTag, branchLabel, type StatusView, type TimelineRow } from '@/components/account/OrderParts';
import { Screen, ScreenHeader } from '@/components/layout';
import { Navigation, PackageSearch, PackageX, Phone, Store } from '@/components/icons';
import { Button, Card, ConfirmDialog, EmptyState, MaroonPanel, SummaryRow, Text, WhatsAppIcon } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useOrder, useOrders } from '@/context/OrderContext';
import { useToast } from '@/context/ToastContext';
import { PENDING_BRANCH, PICKUP, directionsUrl, formatAddress, isPickup, formatPhone, formatSAR, orderStatusView, orderTimelineView, paymentLabel, telUrl } from '@/domain';
import { useCountdown } from '@/hooks';
import { useOpenUrl } from '@/lib/linking';
import { colors, radii } from '@/theme/theme';
import type { Order } from '@/types/api';

function refundText(order: Order): string {
  if (!order.payment || order.payment.method === 'cod') return 'Nothing has been charged.';
  return `We will refund ${formatSAR(order.total)} to ${paymentLabel(order.payment)}.`;
}

/** "Your delivery code is sent on WhatsApp" + Resend (only while RSOF says out for delivery). */
function DeliveryCodeNote({ order, onResend }: { order: Order; onResend: () => Promise<{ resendAt: string }> }) {
  const [resendAt, setResendAt] = useState(0);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const left = useCountdown(resendAt);

  const resend = async () => {
    setSending(true);
    try {
      const result = await onResend();
      setResendAt(Date.parse(result.resendAt));
      toast.show('We sent the delivery code again on WhatsApp');
    } catch (err) {
      toast.show((err as Error).message, { tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  const disabled = !order.canResendCode || sending || left > 0;
  const label = left > 0 ? `Resend in 0:${String(left).padStart(2, '0')}` : sending ? 'Sending…' : 'Resend code';
  return (
    <View style={styles.code}>
      <WhatsAppIcon size={20} color={colors.maroon} />
      <View style={styles.flex}>
        <Text color="copy" style={styles.codeText}>
          Your delivery code is sent on WhatsApp. Share it with the courier when your order arrives.
        </Text>
        <Pressable
          onPress={resend}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          hitSlop={8}
          style={styles.resend}
        >
          <Text weight={700} color="maroon" style={[styles.codeText, disabled && styles.dim]}>
            {label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 22 · Order detail / tracking (re-read every 30 s while on its way; pull to refresh). */
export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const openUrl = useOpenUrl();
  const { now } = useOrders();
  const { order, loading, cancel, resendCode, refresh } = useOrder(orderId);
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!order) {
    return (
      <Screen header={<ScreenHeader title="Order" backFallback={ROUTES.orders} />}>
        {!loading ? (
          <EmptyState
            icon={PackageSearch}
            title="Order not found"
            message="We could not find this order on your account."
            actionLabel="View my orders"
            onAction={() => router.replace(ROUTES.orders)}
          />
        ) : null}
      </Screen>
    );
  }

  const status = orderStatusView(order) as StatusView;
  const steps = orderTimelineView(order, now) as TimelineRow[];
  const branch = order.branch;
  const pickup = isPickup(order);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancel();
      toast.show('Order cancelled', { tone: 'info' });
    } catch (err) {
      toast.show((err as Error).message, { tone: 'error' });
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  return (
    <Screen
      header={
        <ScreenHeader title={`Order #${order.number}`} backFallback={ROUTES.orders} right={<RefreshButton onRefresh={() => refresh({ force: true })} />} />
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
          tintColor={colors.maroon}
          colors={[colors.maroon]}
        />
      }
    >
      <View style={styles.stack}>
        {/* The tag sits here, not in the header, so the order number keeps its room (same as the web on phones). */}
        <View style={styles.statusRow}>
          <StatusTag status={status} />
        </View>
        <Card style={styles.pad}>
          <OrderTimeline steps={steps} />
          {status.id === 'out_for_delivery' ? <DeliveryCodeNote order={order} onResend={resendCode} /> : null}
        </Card>

        {pickup && status.ongoing ? (
          // Branch pickup: the number to show at the counter (the dashboard's pickup counter searches by order number or phone).
          <Card style={styles.counter}>
            <Text variant="label" weight={400} color="muted" align="center">
              {PICKUP.counterTitle}
            </Text>
            <Text weight={700} color="maroon" align="center" style={styles.counterNumber}>
              #{order.number}
            </Text>
            <Text variant="small" color="muted" align="center">
              {PICKUP.counterHelp(order.number)}
            </Text>
          </Card>
        ) : null}

        {branch ? (
          <MaroonPanel style={styles.branch}>
            <View style={styles.branchTop}>
              <View style={styles.branchIcon}>
                <Store size={20} color={colors.white} strokeWidth={1.8} />
              </View>
              <View style={styles.flex}>
                <Text variant="label" weight={400} color="white80">
                  {branchLabel(status, order)}
                </Text>
                <Pressable onPress={() => router.push(ROUTES.branch(branch.id))} accessibilityRole="link" hitSlop={6}>
                  <Text weight={700} color="white" numberOfLines={1} style={styles.branchName}>
                    {branch.name}
                  </Text>
                </Pressable>
              </View>
            </View>
            {branch.address ? (
              <Text variant="small" style={styles.branchAddress}>
                {branch.address}
              </Text>
            ) : null}
            {branch.phone || branch.location ? (
              <View style={styles.branchActions}>
                {branch.phone ? (
                  <Button variant="glass" size="sm" leftIcon={Phone} onPress={() => openUrl(telUrl(branch.phone as string))}>
                    Call branch
                  </Button>
                ) : null}
                {branch.location ? (
                  <Button variant="glass" size="sm" leftIcon={Navigation} onPress={() => openUrl(directionsUrl(branch.location))}>
                    Directions
                  </Button>
                ) : null}
              </View>
            ) : null}
          </MaroonPanel>
        ) : !status.cancelled ? (
          // ROF has not assigned a branch yet: the same maroon card, without its buttons (design 2026-11-18 §5.2).
          <MaroonPanel style={styles.branch}>
            <View style={styles.branchTop}>
              <View style={styles.branchIcon}>
                <Store size={20} color={colors.white} strokeWidth={1.8} />
              </View>
              <View style={styles.flex}>
                <Text variant="label" weight={400} color="white80">
                  {branchLabel(status, order)}
                </Text>
                <Text weight={700} color="white" numberOfLines={1} style={styles.branchName}>
                  {PENDING_BRANCH.title}
                </Text>
              </View>
            </View>
            <Text variant="small" style={styles.branchAddress}>
              {PENDING_BRANCH.body}
            </Text>
          </MaroonPanel>
        ) : null}

        <Card style={styles.pad}>
          <View style={styles.items}>
            {order.items.map((item) => (
              <Pressable
                key={item.productId}
                onPress={() => router.push(ROUTES.product(item.productId))}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, quantity ${item.qty}, ${formatSAR(item.price * item.qty)}`}
                style={styles.item}
              >
                <View style={styles.thumb}>
                  {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                </View>
                <View style={styles.flex}>
                  <Text weight={600} numberOfLines={1} style={styles.itemName}>
                    {item.name}
                  </Text>
                  <Text variant="label" weight={400} color="muted">
                    Qty {item.qty}
                  </Text>
                </View>
                <Text weight={700} style={styles.itemPrice}>
                  {formatSAR(item.price * item.qty)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.divider} />
          <View style={styles.summary}>
            {order.discount > 0 ? <SummaryRow label={`Discount (${order.promoCode})`} value={`− ${formatSAR(order.discount)}`} /> : null}
            {pickup ? null : <SummaryRow label="Delivery" value={order.deliveryFee === 0 ? 'Free' : formatSAR(order.deliveryFee)} />}
            <SummaryRow label="Total (incl. VAT)" value={formatSAR(order.total)} />
          </View>
        </Card>

        <Card style={[styles.pad, styles.info]}>
          {(
            [
              pickup ? [PICKUP.collectFrom, branch?.name ?? PENDING_BRANCH.title] : ['Deliver to', formatAddress(order.address)],
              ['Phone', formatPhone(order.deliveryPhone)],
              ['Payment', paymentLabel(order.payment)],
            ] as [string, string][]
          ).map(([label, value]) => (
            <View key={label} style={styles.infoRow}>
              <Text color="muted">{label}</Text>
              <Text weight={600} align="right" style={styles.infoValue}>
                {value}
              </Text>
            </View>
          ))}
        </Card>

        {order.canCancel ? (
          <Button variant="secondary" block onPress={() => setConfirmCancel(true)}>
            Cancel order
          </Button>
        ) : null}
      </View>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={doCancel}
        loading={cancelling}
        icon={PackageX}
        title="Cancel this order?"
        message={`You can cancel until the branch starts preparing it. ${refundText(order)}`}
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row' },
  counter: { padding: 16, alignItems: 'center', gap: 4 },
  counterNumber: { fontSize: 28, lineHeight: 36 },
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: 12 },
  pad: { padding: 16 },
  code: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.sand,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeText: { fontSize: 15, lineHeight: 22 },
  resend: { marginTop: 4, alignSelf: 'flex-start' },
  dim: { opacity: 0.6 },
  branch: { borderRadius: radii.xl, padding: 16 },
  branchTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  branchIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchName: { fontSize: 18, lineHeight: 24 },
  branchAddress: { marginTop: 10, color: 'rgba(255,255,255,0.9)' },
  branchActions: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  items: { gap: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 56, height: 56, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.sand },
  itemName: { fontSize: 16 },
  itemPrice: { fontSize: 15, fontVariant: ['tabular-nums'] },
  divider: { marginVertical: 14, height: 1, backgroundColor: colors.divider },
  summary: { gap: 10 },
  info: { gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24 },
  infoValue: { flexShrink: 1, fontSize: 15, lineHeight: 21 },
});
