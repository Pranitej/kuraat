import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { OrderItemImage, OrderTimeline, RefreshButton, StatusTag, branchLabel, type StatusView, type TimelineRow } from '@/components/account/OrderParts';
import { Screen, ScreenHeader } from '@/components/layout';
import { ChevronDown, ChevronUp, Navigation, PackageSearch, PackageX, Phone, Store } from '@/components/icons';
import { Button, Card, ConfirmDialog, EmptyState, MaroonPanel, SummaryRow, Text, WhatsAppIcon } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useOrder, useOrders } from '@/context/OrderContext';
import { useToast } from '@/context/ToastContext';
import { PENDING_BRANCH, PICKUP, cancelRefundText, directionsUrl, formatAddress, isPickup, formatPhone, formatSAR, orderHistoryView, orderStatusView, orderTimelineView, paymentLabel, telUrl } from '@/domain';
import { useCountdown } from '@/hooks';
import { useOpenUrl } from '@/lib/linking';
import { colors, radii } from '@/theme/theme';
import type { Order } from '@/types/api';
import { t } from '@/i18n';

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
      toast.show(t('We sent the delivery code again on WhatsApp'));
    } catch (err) {
      toast.show((err as Error).message, { tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  const disabled = !order.canResendCode || sending || left > 0;
  const label = left > 0 ? t('Resend in 0:{seconds}', { seconds: String(left).padStart(2, '0') }) : sending ? t('Sending…') : t('Resend code');
  return (
    <View style={styles.code}>
      <WhatsAppIcon size={20} color={colors.maroon} />
      <View style={styles.flex}>
        <Text color="copy" style={styles.codeText}>{t('Your delivery code is sent on WhatsApp. Share it with the courier when your order arrives.')}</Text>
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
  const [showHistory, setShowHistory] = useState(false);

  if (!order) {
    return (
      <Screen header={<ScreenHeader title={t('Order')} backFallback={ROUTES.orders} />}>
        {!loading ? (
          <EmptyState
            icon={PackageSearch}
            title={t('Order not found')}
            message={t('We could not find this order on your account.')}
            actionLabel={t('View my orders')}
            onAction={() => router.replace(ROUTES.orders)}
          />
        ) : null}
      </Screen>
    );
  }

  const status = orderStatusView(order) as StatusView;
  const steps = orderTimelineView(order, now) as TimelineRow[];
  const history = orderHistoryView(order, now) as { id: string; title: string; cancelled: boolean; note: string; time: string }[];
  const branch = order.branch;
  const pickup = isPickup(order);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancel();
      toast.show(t('Order cancelled'), { tone: 'info' });
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
        <ScreenHeader title={t('Order #{number}', { number: order.number })} backFallback={ROUTES.orders} right={<RefreshButton onRefresh={() => refresh({ force: true })} />} />
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
          {/* The full history is already in this order's reply: the button only shows it, it asks for nothing. */}
          {history.length > 1 ? (
            <>
              {/* Same look as the web: a divider, then a centred "View full history" with the arrow beside it. */}
              <View style={styles.historyToggle}>
                <Button variant="ghost" size="xs" block rightIcon={showHistory ? ChevronUp : ChevronDown} onPress={() => setShowHistory((v) => !v)}>
                  {showHistory ? t('Hide full history') : t('View full history')}
                </Button>
              </View>
              {showHistory ? (
                <View style={styles.historyRows} accessibilityLabel={t('Order history')}>
                  {history.map((h) => (
                    <View key={h.id}>
                      <View style={styles.historyRow}>
                        <Text weight={600} color={h.cancelled ? 'hotpink' : 'ink'} style={styles.flex}>
                          {h.title}
                        </Text>
                        <Text variant="label" weight={400} color="muted">
                          {h.time}
                        </Text>
                      </View>
                      {h.note ? (
                        <Text variant="label" weight={400} color="muted">
                          {h.note}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </Card>

        {pickup && status.ongoing ? (
          // Branch pickup: the number to show at the counter (the dashboard's pickup counter searches by order number or phone).
          <Card style={styles.counter}>
            <Text variant="label" weight={400} color="muted" align="center">
              {PICKUP.counterTitle}
            </Text>
            <Text variant="title" color="maroon" align="center" style={styles.counterNumber}>
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
                  <Button variant="glass" size="sm" leftIcon={Phone} onPress={() => openUrl(telUrl(branch.phone as string))}>{t('Call branch')}</Button>
                ) : null}
                {branch.location ? (
                  <Button variant="glass" size="sm" leftIcon={Navigation} onPress={() => openUrl(directionsUrl(branch.location))}>{t('Directions')}</Button>
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
                accessibilityLabel={t('{name}, quantity {qty}, {v3}', { name: item.name, qty: item.qty, v3: item.price == null ? '' : formatSAR(item.price * item.qty) })}
                style={styles.item}
              >
                <View style={styles.thumb}>
                  <OrderItemImage productId={item.productId} />
                </View>
                <View style={styles.flex}>
                  <Text weight={600} numberOfLines={1} style={styles.itemName}>
                    {item.name}
                  </Text>
                  <Text variant="label" weight={400} color="muted">{t('Qty {qty}', { qty: item.qty })}</Text>
                </View>
                <Text weight={700} style={styles.itemPrice}>
                  {item.price == null ? '' : formatSAR(item.price * item.qty)}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.divider} />
          <View style={styles.summary}>
            <SummaryRow label={t('Total')} value={order.total == null ? '—' : formatSAR(order.total)} />
          </View>
        </Card>

        <Card style={[styles.pad, styles.info]}>
          {(
            [
              pickup ? [PICKUP.collectFrom, branch?.name ?? PENDING_BRANCH.title] : [t('Deliver to'), formatAddress(order.address)],
              [t('Phone'), formatPhone(order.deliveryPhone)],
              ...(order.payment ? [[t('Payment'), paymentLabel(order.payment)]] : []),
              // RSOF's own payment status (Paid / Payment pending / Payment failed …), shown as it comes
              ...(order.paymentStatus ? [[t('Payment status'), t(order.paymentStatus.label)]] : []),
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
          <Button variant="secondary" block onPress={() => setConfirmCancel(true)}>{t('Cancel order')}</Button>
        ) : null}
      </View>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={doCancel}
        loading={cancelling}
        icon={PackageX}
        title={t('Cancel this order?')}
        message={`${t('You can cancel until the branch starts preparing it.')} ${cancelRefundText(order)}`}
        confirmLabel={t('Cancel order')}
        cancelLabel={t('Keep order')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row' },
  counter: { padding: 16, alignItems: 'center', gap: 4 },
  counterNumber: { marginTop: 4 },
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: 12 },
  pad: { padding: 16 },
  historyToggle: { marginTop: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  historyRows: { marginTop: 12, gap: 12 },
  historyRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 },
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
